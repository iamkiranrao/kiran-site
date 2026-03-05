import os
import glob
import re
from collections import defaultdict
from typing import List, Tuple, Dict, Any
import json

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from anthropic import Anthropic
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Initialize Flask app
app = Flask(__name__, static_folder='static', static_url_path='/static')
CORS(app)

# Configuration
CHUNK_SIZE = 300  # words per chunk
OVERLAP_SIZE = 50  # word overlap between chunks
MAX_CONVERSATION_TURNS = 10
TOP_K_CHUNKS = 3
PORT = 5001

# Global state
class RAGSystem:
    def __init__(self):
        self.chunks: List[Dict[str, str]] = []  # List of {'text': ..., 'source': ...}
        self.vectorizer = None
        self.tfidf_matrix = None
        self.conversations: Dict[str, List[Dict[str, str]]] = defaultdict(list)

    def load_documents(self):
        """Load all .txt files from docs/ directory and chunk them."""
        docs_dir = os.path.join(os.path.dirname(__file__), 'docs')

        if not os.path.exists(docs_dir):
            print(f"Warning: docs directory not found at {docs_dir}")
            return

        txt_files = glob.glob(os.path.join(docs_dir, '*.txt'))
        print(f"Found {len(txt_files)} text files to load")

        all_chunks = []

        for file_path in txt_files:
            file_name = os.path.basename(file_path)
            print(f"Loading {file_name}...")

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Split into words
                words = content.split()

                # Create overlapping chunks
                for i in range(0, len(words), CHUNK_SIZE - OVERLAP_SIZE):
                    chunk_words = words[i:i + CHUNK_SIZE]
                    if len(chunk_words) > 0:
                        chunk_text = ' '.join(chunk_words)
                        all_chunks.append({
                            'text': chunk_text,
                            'source': file_name
                        })
            except Exception as e:
                print(f"Error loading {file_name}: {e}")

        self.chunks = all_chunks
        print(f"Created {len(self.chunks)} chunks total")

        # Build TF-IDF vectorizer and matrix
        if self.chunks:
            chunk_texts = [chunk['text'] for chunk in self.chunks]
            self.vectorizer = TfidfVectorizer(
                max_features=500,
                stop_words='english',
                lowercase=True
            )
            self.tfidf_matrix = self.vectorizer.fit_transform(chunk_texts)
            print("TF-IDF vectorizer built and fitted")

    def retrieve_chunks(self, query: str, k: int = TOP_K_CHUNKS) -> List[Dict[str, str]]:
        """Retrieve top-k most relevant chunks for a query."""
        if not self.vectorizer or self.tfidf_matrix.shape[0] == 0:
            return []

        # Transform query using the fitted vectorizer
        query_vector = self.vectorizer.transform([query])

        # Compute cosine similarity
        similarities = cosine_similarity(query_vector, self.tfidf_matrix).flatten()

        # Get top-k indices
        top_indices = np.argsort(similarities)[::-1][:k]

        # Return chunks with similarity scores
        results = []
        for idx in top_indices:
            if similarities[idx] > 0:  # Only include if there's some similarity
                results.append({
                    'text': self.chunks[idx]['text'],
                    'source': self.chunks[idx]['source'],
                    'similarity': float(similarities[idx])
                })

        return results

    def add_to_conversation(self, session_id: str, role: str, content: str):
        """Add a message to conversation history."""
        self.conversations[session_id].append({
            'role': role,
            'content': content
        })

        # Keep only last MAX_CONVERSATION_TURNS turns
        if len(self.conversations[session_id]) > MAX_CONVERSATION_TURNS * 2:
            self.conversations[session_id] = self.conversations[session_id][-MAX_CONVERSATION_TURNS * 2:]

    def get_conversation(self, session_id: str) -> List[Dict[str, str]]:
        """Get conversation history for a session."""
        return self.conversations[session_id]

# Initialize RAG system
rag_system = RAGSystem()
rag_system.load_documents()

# Initialize Anthropic client (deferred — created on first request)
client = None

def get_client():
    global client
    if client is None:
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")
        client = Anthropic(api_key=api_key)
    return client

# System prompt for Claude
SYSTEM_PROMPT = """You are Onboardly, NovaCorp's HR onboarding assistant. Your role is to help new employees with onboarding questions and information.

You should ONLY answer questions based on the provided context documents. If the answer to a question is not found in the provided context, you should honestly say "I don't have that information in my onboarding documents" or "That's not covered in the materials I have access to."

Be helpful, friendly, and professional. Keep responses concise and clear. If a question requires information outside the provided context, politely direct the user to contact HR or the appropriate department."""

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'chunks_loaded': len(rag_system.chunks)
    }), 200

@app.route('/api/chat', methods=['POST'])
def chat():
    """Chat endpoint that retrieves relevant chunks and responds using Claude."""
    try:
        data = request.get_json()

        if not data or 'message' not in data:
            return jsonify({'error': 'message field is required'}), 400

        user_message = data['message']
        session_id = data.get('session_id', 'default')

        if not user_message.strip():
            return jsonify({'error': 'message cannot be empty'}), 400

        # Retrieve relevant chunks
        relevant_chunks = rag_system.retrieve_chunks(user_message, TOP_K_CHUNKS)

        # Add user message to conversation history
        rag_system.add_to_conversation(session_id, 'user', user_message)

        # Build context from chunks
        context_text = ""
        if relevant_chunks:
            context_text = "Here are the relevant documents:\n\n"
            for i, chunk in enumerate(relevant_chunks, 1):
                context_text += f"[Document {i} - {chunk['source']}]\n{chunk['text']}\n\n"
        else:
            context_text = "No relevant documents found in the knowledge base.\n"

        # Prepare messages for Claude
        conversation_history = rag_system.get_conversation(session_id)

        # Build messages list for API
        messages = []
        for msg in conversation_history[:-1]:  # Exclude the last user message we just added
            messages.append({
                'role': msg['role'],
                'content': msg['content']
            })

        # Add the current user message with context
        messages.append({
            'role': 'user',
            'content': f"{context_text}\nUser question: {user_message}"
        })

        # Call Claude API
        response = get_client().messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=messages
        )

        assistant_message = response.content[0].text

        # Add assistant response to conversation history
        rag_system.add_to_conversation(session_id, 'assistant', assistant_message)

        # Prepare sources
        sources = [
            {
                'file': chunk['source'],
                'snippet': chunk['text'][:200] + '...' if len(chunk['text']) > 200 else chunk['text']
            }
            for chunk in relevant_chunks
        ]

        return jsonify({
            'response': assistant_message,
            'sources': sources
        }), 200

    except Exception as e:
        print(f"Error in /api/chat: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/', methods=['GET'])
def index():
    """Serve index.html from static folder."""
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>', methods=['GET'])
def serve_static(path):
    """Serve static files from static folder."""
    if path and os.path.isfile(os.path.join('static', path)):
        return send_from_directory('static', path)
    # If not a file, try serving index.html (for SPA routing)
    return send_from_directory('static', 'index.html')

def main():
    """Main entry point."""
    print("Initializing HR Onboarding Bot...")

    # Load documents and build RAG system
    rag_system.load_documents()

    print(f"Starting Flask server on port {PORT}...")
    app.run(debug=False, host='0.0.0.0', port=PORT)

if __name__ == '__main__':
    main()
