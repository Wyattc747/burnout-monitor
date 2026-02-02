#!/bin/bash

# ShepHerd Local Development Script
# Run this to test changes before pushing to GitHub

echo "🐑 ShepHerd Local Development"
echo "=============================="

# Check if we're in the right directory
if [ ! -f "package.json" ] && [ ! -d "frontend" ]; then
    echo "❌ Please run this from the burnout-monitor root directory"
    exit 1
fi

case "$1" in
    "backend")
        echo "Starting backend server..."
        cd backend && npm run dev
        ;;
    "frontend")
        echo "Starting frontend server..."
        cd frontend && npm run dev
        ;;
    "both")
        echo "Starting both servers..."
        echo "Backend will run on http://localhost:3001"
        echo "Frontend will run on http://localhost:3000"
        echo ""
        # Run both in background, but keep script running
        cd backend && npm run dev &
        BACKEND_PID=$!
        cd ../frontend && npm run dev &
        FRONTEND_PID=$!

        # Wait for Ctrl+C
        trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
        wait
        ;;
    "test")
        echo "Running tests..."
        cd backend && npm test
        cd ../frontend && npm test
        ;;
    "status")
        echo "Git Status:"
        git status
        echo ""
        echo "Uncommitted changes:"
        git diff --stat
        ;;
    *)
        echo "Usage: ./run-local.sh [command]"
        echo ""
        echo "Commands:"
        echo "  backend   - Start backend server (port 3001)"
        echo "  frontend  - Start frontend server (port 3000)"
        echo "  both      - Start both servers"
        echo "  test      - Run all tests"
        echo "  status    - Show git status and changes"
        echo ""
        echo "After testing, manually push with:"
        echo "  git add -A && git commit -m 'message' && git push"
        ;;
esac
