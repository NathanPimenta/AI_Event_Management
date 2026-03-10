#!/bin/bash

# Team Formation Docker Build Script
# This script provides convenient commands for building and managing Docker images

set -e

BUILD_TAG="${BUILD_TAG:-team-formation:latest}"
REGISTRY="${REGISTRY:-}"
CONTAINER_NAME="team-formation"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to build the image
build_image() {
    print_info "Building Docker image: $BUILD_TAG"
    DOCKER_BUILDKIT=1 docker build -t "$BUILD_TAG" .
    print_info "Build complete!"
}

# Function to run the container
run_container() {
    print_info "Starting container: $CONTAINER_NAME"
    docker run -d \
        --name "$CONTAINER_NAME" \
        -p 8000:8000 \
        -v "$(pwd)/data:/app/data:z" \
        -v "$(pwd)/output:/app/output:z" \
        "$BUILD_TAG"
    print_info "Container started! Access at http://localhost:8000/docs"
}

# Function to stop the container
stop_container() {
    if docker ps -a | grep -q "$CONTAINER_NAME"; then
        print_info "Stopping container: $CONTAINER_NAME"
        docker stop "$CONTAINER_NAME" || true
        docker rm "$CONTAINER_NAME" || true
        print_info "Container stopped!"
    else
        print_warn "Container $CONTAINER_NAME is not running"
    fi
}

# Function to view logs
view_logs() {
    print_info "Showing logs for: $CONTAINER_NAME"
    docker logs -f "$CONTAINER_NAME"
}

# Function to push to registry
push_image() {
    if [ -z "$REGISTRY" ]; then
        print_error "REGISTRY environment variable not set"
        return 1
    fi
    
    local remote_tag="$REGISTRY/$BUILD_TAG"
    print_info "Tagging image: $remote_tag"
    docker tag "$BUILD_TAG" "$remote_tag"
    
    print_info "Pushing to registry: $remote_tag"
    docker push "$remote_tag"
    print_info "Push complete!"
}

# Function to clean up
cleanup() {
    print_info "Cleaning up Docker resources..."
    stop_container
    docker image prune -f
    print_info "Cleanup complete!"
}

# Main script logic
case "${1:-build}" in
    build)
        build_image
        ;;
    run)
        stop_container
        build_image
        run_container
        ;;
    stop)
        stop_container
        ;;
    logs)
        view_logs
        ;;
    shell)
        print_info "Accessing container shell..."
        docker exec -it "$CONTAINER_NAME" /bin/bash
        ;;
    push)
        push_image
        ;;
    clean)
        cleanup
        ;;
    all)
        build_image
        stop_container
        run_container
        print_info "Everything ready! View logs with: ./docker-build.sh logs"
        ;;
    help)
        cat << EOF
Usage: ./docker-build.sh [COMMAND]

Commands:
    build       Build the Docker image (default)
    run         Build and run the container
    stop        Stop and remove the container
    logs        View container logs
    shell       Access container shell
    push        Push image to registry (requires REGISTRY env var)
    clean       Clean up all Docker resources
    all         Build and run everything
    help        Show this help message

Environment Variables:
    BUILD_TAG   Docker image tag (default: team-formation:latest)
    REGISTRY    Docker registry URL for push command

Examples:
    ./docker-build.sh build
    ./docker-build.sh run
    BUILD_TAG=team-formation:v1.0 ./docker-build.sh build
    REGISTRY=docker.io/username ./docker-build.sh push
EOF
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Run './docker-build.sh help' for usage information"
        exit 1
        ;;
esac
