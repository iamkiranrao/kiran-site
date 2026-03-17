---
title: learning-langchain-and-langgraph-through-hands-on-projects
session_id: 860e9632-d7cc-4eba-9e89-176f2fcf864e
source: claude-ai-export
captured_at: 2026-03-12T03:23:16Z
session_type: chat
session_start: 2026-02-10T01:10:14.703914Z
session_end: 2026-02-10T01:18:02.738226Z
message_count: 4
user_messages: 2
assistant_messages: 2
total_words: 1418
---

# Session: Learning LangChain and LangGraph through hands-on projects

**Date range:** 2026-02-10 01:10:14 UTC → 2026-02-10 01:18:02 UTC
**Messages:** 2 from Kiran, 2 from Claude
**Total words:** 1,418

---

### Kiran `01:10`

Explain lang chain and lang graph in a easy to understand way. I’m technical or mathematical- also give me a project so I can learn by doing.

---

### Claude `01:10`

# LangChain & LangGraph

## LangChain

Think of LangChain as a **composable function pipeline for LLMs**. If you've worked with Unix pipes or functional composition (f ∘ g ∘ h), it's the same idea:

**Input → Prompt Template → LLM Call → Output Parser → Result**

Each stage is a "link" in the chain. The key abstractions:

- **Chains**: Deterministic sequences of operations (like a DAG with no cycles). Input flows through transforms linearly or with simple branching.
- **Retrievers / Tools**: Side-effect modules — vector DB lookups, API calls, calculators — that the LLM can invoke mid-chain.
- **Memory**: State that persists across invocations (conversation history, essentially a sliding window over past (input, output) pairs appended to the prompt).

Mathematically, a chain is just: `result = parser(llm(template(input)))` — function composition with some I/O glue.

## LangGraph

LangGraph extends this from a **DAG to a cyclic graph** (i.e., a state machine / finite automaton). This is the critical difference.

In LangChain, execution flows in one direction. In LangGraph:

- You define **nodes** (functions that transform state) and **edges** (transitions, which can be conditional).
- The graph can **loop** — meaning an agent can reason, act, observe, and then *decide to go back and reason again*.
- There's a global **State** object (think: a typed dict) that gets passed through and mutated at each node.

Formally, it's a tuple **(S, N, E, s₀)** where S is the state space, N are node functions `f: S → S`, E are edges (possibly conditional: `S → next_node`), and s₀ is the initial state. Execution is just repeated state transitions until you hit an `END` node.

**Why does this matter?** A ReAct agent (Reason → Act → Observe → repeat) is inherently cyclic. You can't express it cleanly as a chain — you need a graph with a loop.

---

## Learn-by-Doing Project: Research Agent with Tool Use

**Goal**: Build an agent that takes a research question, searches the web, reads pages, decides if it has enough info, and writes a summary. This naturally requires a cycle (search → read → evaluate → maybe search again).

### Architecture

```
         ┌──────────────────────┐
         ▼                      │
    [Plan/Reason] → [Search] → [Read] → [Evaluate] ──enough?──→ [Summarize] → END
                                              │
                                              └── not enough ──→ [Plan/Reason]
```

### Steps

**1. Setup**
```bash
pip install langgraph langchain langchain-openai tavily-python
```

**2. Define State**
```python
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI

class ResearchState(TypedDict):
    question: str
    search_queries: list[str]
    sources: list[dict]        # {url, content}
    evaluation: str            # "sufficient" or "insufficient"
    summary: str
    iteration: int
```

**3. Define Nodes**
```python
llm = ChatOpenAI(model="gpt-4o-mini")

def plan_node(state: ResearchState) -> ResearchState:
    """LLM generates search queries based on question + what we know so far."""
    existing = "\n".join(s["url"] for s in state.get("sources", []))
    resp = llm.invoke(f"Question: {state['question']}\nAlready found: {existing}\nGenerate 2 new search queries as a comma-separated list.")
    state["search_queries"] = [q.strip() for q in resp.content.split(",")]
    return state

def search_node(state: ResearchState) -> ResearchState:
    """Execute searches (use Tavily, or mock it)."""
    from tavily import TavilyClient
    client = TavilyClient()
    for query in state["search_queries"]:
        results = client.search(query, max_results=2)
        for r in results["results"]:
            state.setdefault("sources", []).append({"url": r["url"], "content": r["content"]})
    return state

def evaluate_node(state: ResearchState) -> ResearchState:
    """LLM decides: do we have enough info?"""
    sources_text = "\n\n".join(s["content"][:500] for s in state["sources"])
    resp = llm.invoke(f"Question: {state['question']}\nSources:\n{sources_text}\n\nDo we have enough info? Reply ONLY 'sufficient' or 'insufficient'.")
    state["evaluation"] = resp.content.strip().lower()
    state["iteration"] = state.get("iteration", 0) + 1
    return state

def summarize_node(state: ResearchState) -> ResearchState:
    sources_text = "\n\n".join(s["content"][:500] for s in state["sources"])
    resp = llm.invoke(f"Question: {state['question']}\nSources:\n{sources_text}\n\nWrite a comprehensive summary.")
    state["summary"] = resp.content
    return state
```

**4. Build the Graph (this is the LangGraph part)**
```python
def should_continue(state: ResearchState) -> str:
    if state["evaluation"] == "sufficient" or state.get("iteration", 0) >= 3:
        return "summarize"
    return "plan"

graph = StateGraph(ResearchState)
graph.add_node("plan", plan_node)
graph.add_node("search", search_node)
graph.add_node("evaluate", evaluate_node)
graph.add_node("summarize", summarize_node)

graph.set_entry_point("plan")
graph.add_edge("plan", "search")
graph.add_edge("search", "evaluate")
graph.add_conditional_edges("evaluate", should_continue, {"plan": "plan", "summarize": "summarize"})
graph.add_edge("summarize", END)

app = graph.compile()
```

**5. Run it**
```python
result = app.invoke({"question": "What are the latest advances in test-time compute for LLMs?", "sources": [], "iteration": 0})
print(result["summary"])
```

### What you'll learn

- **LangChain concepts**: LLM wrappers, prompt construction, tool integration
- **LangGraph concepts**: State machines, conditional edges, cycles, the evaluate→loop pattern that makes agents actually useful
- **Key insight**: The `should_continue` function is where agent autonomy lives — it's the conditional edge that decides whether to loop or terminate

### Extensions to try

1. Add a **human-in-the-loop** node (LangGraph has built-in interrupt support)
2. Add **parallel search** (fan-out multiple queries, fan-in results)
3. Persist state with a **checkpointer** so you can resume interrupted research
4. Swap in different tools (calculator, code execution, database queries)

---

### Kiran `01:17`

Explain lang chain and lang graph in a easy to understand way. I’m not technical or mathematical- also give me a project so I can learn by doing.

---

### Claude `01:18`

# LangChain & LangGraph — Plain English

## LangChain

Think of LangChain as a **toolbox for building apps that use AI** (like ChatGPT-style models).

Normally, if you want an AI to do something useful — like answer questions about *your* documents, summarize emails, or chat with a database — you'd have to wire up a lot of plumbing yourself. LangChain gives you ready-made building blocks so you can snap things together, like LEGO.

**Analogy:** Imagine you're building a sandwich shop. LangChain gives you the bread, the condiments, the meats, and a recipe book. You just pick what you want and assemble.

Common building blocks include:
- **Prompts** — templates for how you talk to the AI
- **Chains** — a sequence of steps (ask AI → get answer → do something with it)
- **Memory** — letting the AI remember earlier parts of a conversation
- **Tools** — giving the AI the ability to search the web, do math, look things up, etc.

---

## LangGraph

LangGraph builds on top of LangChain and adds **decision-making and looping**.

A regular LangChain "chain" is like a straight assembly line: Step 1 → Step 2 → Step 3 → Done.

LangGraph lets you build something more like a **flowchart**, where the AI can make decisions, loop back, or take different paths depending on what happens.

**Analogy:** LangChain is like following a recipe step-by-step. LangGraph is like being a chef who *improvises* — "taste the soup, if it needs salt add salt, taste again, if it's good move on to plating."

This is what people mean when they talk about **AI agents** — AI that can think, act, check its work, and try again.

---

## Learn-By-Doing Project: "Ask My Files" Chatbot

**What you'll build:** A chatbot that can answer questions about documents you give it (like PDFs or text files). Think of it as your own personal research assistant.

### What you need (all free)
1. **Python** installed on your computer
2. An **OpenAI API key** (or you can use a free model)
3. A few PDF or text files you want to ask questions about

### Steps (high level)

**Phase 1 — LangChain basics (Week 1)**
1. Install LangChain (`pip install langchain openai`)
2. Write a simple script that sends a question to an AI and prints the answer — this is your first "chain"
3. Add **memory** so it remembers what you said earlier in the conversation
4. Load a document (PDF or text file) and ask the AI questions *about that document*

**Phase 2 — Add LangGraph (Week 2)**
5. Install LangGraph (`pip install langgraph`)
6. Turn your chatbot into an **agent** that can decide: "Do I know the answer, or do I need to look it up in the documents?"
7. Add a **checking step** — after the AI answers, it reviews its own answer and decides if it's good enough or needs to try again

**Phase 3 — Make it yours (Week 3)**
8. Add more documents
9. Give it a simple web interface (using Streamlit — very beginner-friendly)
10. Show it to people and get feedback

### Where to start right now

Go to **python.langchain.com/docs/tutorials** — they have beginner walkthroughs that hold your hand through each step. Start with the "Build a Simple LLM Application" tutorial, then move to "Build a Chatbot," then "Build an Agent."

---

**The key insight:** LangChain = snap together AI building blocks in a line. LangGraph = let the AI make decisions and loop, like a real assistant would. You learn best by building something small and growing it.

---
