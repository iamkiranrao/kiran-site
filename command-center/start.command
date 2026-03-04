#!/bin/bash
# Command Center Launcher
# Double-click this file to start the app!

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start backend in a new terminal tab
osascript -e "
tell application \"Terminal\"
    activate
    do script \"cd '$PROJECT_DIR/backend' && source venv/bin/activate && python -m uvicorn main:app --reload --port 8000\"
end tell
"

# Wait a moment for backend to start
sleep 2

# Start frontend in another new terminal tab
osascript -e "
tell application \"Terminal\"
    activate
    do script \"cd '$PROJECT_DIR/frontend' && npm run dev\"
end tell
"

# Wait for frontend to start
sleep 3

# Open the browser
open http://localhost:3000

echo "Command Center is starting up!"
echo "Close this window whenever you like."
