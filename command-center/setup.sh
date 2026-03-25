#!/bin/bash
# Command Center — Local Setup Script
# Run this from the command-center/ directory

set -e

echo "========================================"
echo "  Command Center — Local Setup"
echo "========================================"
echo ""

# ── Check prerequisites ────────────────────────────────────
echo "Checking prerequisites..."

check_cmd() {
  if ! command -v "$1" &> /dev/null; then
    echo "  ✗ $1 not found. $2"
    return 1
  else
    echo "  ✓ $1 found: $($1 --version 2>&1 | head -1)"
    return 0
  fi
}

MISSING=0
check_cmd "node" "Install from https://nodejs.org (v18+)" || MISSING=1
check_cmd "npm" "Comes with Node.js" || MISSING=1
check_cmd "python3" "Install from https://python.org (v3.10+)" || MISSING=1
check_cmd "pip3" "Comes with Python" || MISSING=1
check_cmd "git" "Install from https://git-scm.com" || MISSING=1

if [ $MISSING -eq 1 ]; then
  echo ""
  echo "Please install the missing tools above and re-run this script."
  exit 1
fi

echo ""
echo "All prerequisites found."
echo ""

# ── Backend setup ──────────────────────────────────────────
echo "Setting up backend..."

cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
  echo "  Creating Python virtual environment..."
  python3 -m venv venv
fi

echo "  Activating virtual environment..."
source venv/bin/activate

echo "  Installing Python dependencies..."
pip install -r requirements.txt -q

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
  echo "  Creating .env from template..."
  cp .env.example .env
  echo "  ⚠  Edit backend/.env to add your GITHUB_PAT (for git publishing)"
fi

cd ..

# ── Frontend setup ─────────────────────────────────────────
echo ""
echo "Setting up frontend..."

cd frontend

echo "  Installing Node dependencies..."
npm install --silent

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
  echo "  Creating .env.local from template..."
  cp .env.local.example .env.local
  echo ""
  echo "  ⚠  You need to set up GitHub OAuth:"
  echo "     1. Go to https://github.com/settings/developers"
  echo "     2. Click 'New OAuth App'"
  echo "     3. Set Homepage URL:     http://localhost:3000"
  echo "     4. Set Callback URL:     http://localhost:3000/api/auth/callback/github"
  echo "     5. Copy Client ID and Client Secret into frontend/.env.local"
  echo "     6. Generate AUTH_SECRET:  openssl rand -base64 32"
fi

cd ..

echo ""
echo "========================================"
echo "  Setup complete!"
echo "========================================"
echo ""
echo "To start the app, open TWO terminal windows:"
echo ""
echo "  Terminal 1 (backend):"
echo "    cd command-center/backend"
echo "    source venv/bin/activate"
echo "    python main.py"
echo "    # Runs on http://localhost:8000"
echo ""
echo "  Terminal 2 (frontend):"
echo "    cd command-center/frontend"
echo "    npm run dev"
echo "    # Runs on http://localhost:3000"
echo ""
echo "Then open http://localhost:3000 in your browser."
echo ""
echo "⚠  Before first use:"
echo "  1. Complete the GitHub OAuth setup (see above)"
echo "  2. Fill in frontend/.env.local with your OAuth credentials"
echo "  3. Optionally add GITHUB_PAT in backend/.env for git publishing"
echo ""
