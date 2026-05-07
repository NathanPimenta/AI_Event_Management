#!/bin/bash
# Image Curator Docker Build Script

set -e

BUILD_TAG="${BUILD_TAG:-image-curator:latest}"
CONTAINER_NAME="image-curator"

build_image() {
    echo "Building Docker image: $BUILD_TAG"
    DOCKER_BUILDKIT=1 docker build -t "$BUILD_TAG" .
    echo "Build complete!"
}

run_container() {
    echo "Starting container: $CONTAINER_NAME"
    docker run -d \
        --name "$CONTAINER_NAME" \
        -p 8005:8005 \
        -v "$(pwd)/curated_output:/app/curated_output:z" \
        -v "$(pwd)/temp_downloads:/app/temp_downloads:z" \
        "$BUILD_TAG"
    echo "Container started! Access at http://localhost:8005/docs"
    echo "Showing logs (Press Ctrl+C to exit logs, container will keep running):"
    docker logs -f "$CONTAINER_NAME"
}

stop_container() {
    if docker ps -a | grep -q "$CONTAINER_NAME"; then
        echo "Stopping container: $CONTAINER_NAME"
        docker stop "$CONTAINER_NAME" || true
        docker rm "$CONTAINER_NAME" || true
        echo "Container stopped!"
    fi
}

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
        docker logs -f "$CONTAINER_NAME"
        ;;
    clean)
        stop_container
        docker image prune -f
        ;;
    help|*)
        echo "Usage: ./docker-build.sh [build|run|stop|logs|clean]"
        ;;
esac
