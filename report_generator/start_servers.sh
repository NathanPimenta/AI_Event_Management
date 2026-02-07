#!/bin/bash

# Start FastAPI backend
echo "Starting FastAPI backend..."
uvicorn src.api:app --reload --port 8003 &

# Start frontend server
echo "Starting frontend server..."
python3 -m http.server 8080 &

echo "Services started!"
echo "Frontend: http://localhost:8080"
echo "Backend API: http://localhost:8003"
echo "API Documentation: http://localhost:8003/docs"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for both background processes
wait