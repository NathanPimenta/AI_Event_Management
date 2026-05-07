#!/bin/bash

echo "🚀 Starting all Planify AI Event Management Services..."

# Activate Python virtual environment if it exists
if [ -d "venv" ]; then
    echo "📦 Activating virtual environment..."
    source venv/bin/activate
fi

PIDS=()

# Function to run a module in the background
run_module() {
    local dir=$1
    local cmd=$2
    local name=$3
    
    if [ -d "$dir" ]; then
        echo "▶️ Starting $name in ./$dir..."
        (cd "$dir" && $cmd) &
        PIDS+=($!)
    else
        echo "⚠️ Directory $dir not found, skipping $name."
    fi
}

# Start Backend Microservices
run_module "scraper_module" "uvicorn src.main:app --host 0.0.0.0 --port 8001" "Scraper Module (Port 8001)"
run_module "certificate_generator" "uvicorn src.main:app --host 0.0.0.0 --port 8002" "Certificate Generator (Port 8002)"
run_module "poster_generator" "uvicorn main:app --host 0.0.0.0 --port 8003" "Poster Generator (Port 8003)"
run_module "report_generator" "uvicorn src.api:app --host 0.0.0.0 --port 8004" "Report Generator (Port 8004)"
run_module "image_curator" "uvicorn api_server:app --host 0.0.0.0 --port 8005" "Image Curator (Port 8005)"
run_module "team_formation" "uvicorn src.api:app --host 0.0.0.0 --port 8006" "Team Formation (Port 8006)"

# Note: planify_reelmaker/src/main.py is a one-off execution script based on its code, 
# so it's not included in the background services. If there's an api.py for it, it can be added here.
# run_module "planify_reelmaker" "python src/api.py" "ReelMaker API"

# Start Frontend
if [ -d "Planify-main" ]; then
    echo "▶️ Starting Next.js Frontend (Port 3000)..."
    (cd Planify-main && npm run dev) &
    PIDS+=($!)
fi

echo ""
echo "✅ All long-running services started!"
echo "🛑 Press Ctrl+C at any time to stop all services."
echo ""

# Cleanup function to kill all background processes when script exits
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill "${PIDS[@]}" 2>/dev/null
    wait "${PIDS[@]}" 2>/dev/null
    echo "👋 All services stopped. Goodbye!"
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Keep the script running to wait for background processes
wait
