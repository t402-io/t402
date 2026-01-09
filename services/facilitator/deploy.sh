#!/bin/bash
set -e

# T402 Facilitator Deployment Script
# Usage: ./deploy.sh [build|pull|up|down|logs|status]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env.prod exists
check_env() {
    if [ ! -f .env.prod ]; then
        log_error ".env.prod file not found!"
        log_info "Creating from template..."
        cp .env.example .env.prod
        log_warn "Please edit .env.prod with your configuration:"
        log_warn "  - EVM_PRIVATE_KEY (required)"
        log_warn "  - RPC endpoints"
        exit 1
    fi
}

# Build the Docker image locally
build() {
    log_info "Building facilitator Docker image..."
    docker compose -f docker-compose.prod.yaml build
    log_info "Build complete!"
}

# Pull the latest image (if using registry)
pull() {
    log_info "Pulling latest facilitator image..."
    docker compose -f docker-compose.prod.yaml pull
    log_info "Pull complete!"
}

# Start the services
up() {
    check_env
    log_info "Starting facilitator services..."
    docker compose -f docker-compose.prod.yaml up -d
    log_info "Services started!"
    log_info ""
    log_info "Facilitator is now running at:"
    log_info "  - HTTP:  http://localhost:8080"
    log_info "  - HTTPS: https://facilitator.t402.io (if DNS configured)"
    log_info ""
    log_info "Check status with: ./deploy.sh status"
    log_info "View logs with:    ./deploy.sh logs"
}

# Stop the services
down() {
    log_info "Stopping facilitator services..."
    docker compose -f docker-compose.prod.yaml down
    log_info "Services stopped!"
}

# View logs
logs() {
    docker compose -f docker-compose.prod.yaml logs -f "${@:2}"
}

# Check status
status() {
    log_info "Service Status:"
    docker compose -f docker-compose.prod.yaml ps
    echo ""
    log_info "Health Check:"
    curl -s http://localhost:8080/health 2>/dev/null && echo "" || log_warn "Facilitator not responding"
    echo ""
    log_info "Supported Networks:"
    curl -s http://localhost:8080/supported 2>/dev/null | jq . 2>/dev/null || log_warn "Could not fetch supported networks"
}

# Restart services
restart() {
    log_info "Restarting facilitator services..."
    docker compose -f docker-compose.prod.yaml restart
    log_info "Services restarted!"
}

# Update and redeploy
update() {
    log_info "Updating facilitator..."
    git pull
    build
    docker compose -f docker-compose.prod.yaml up -d --force-recreate
    log_info "Update complete!"
}

# Show help
help() {
    echo "T402 Facilitator Deployment Script"
    echo ""
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  build    Build the Docker image locally"
    echo "  pull     Pull the latest image from registry"
    echo "  up       Start the services"
    echo "  down     Stop the services"
    echo "  restart  Restart the services"
    echo "  update   Pull latest code, rebuild, and restart"
    echo "  logs     View service logs (add service name to filter)"
    echo "  status   Check service status and health"
    echo "  help     Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh up              # Start all services"
    echo "  ./deploy.sh logs facilitator # View facilitator logs only"
    echo "  ./deploy.sh status          # Check health"
}

# Main entry point
case "${1:-help}" in
    build)
        build
        ;;
    pull)
        pull
        ;;
    up)
        up
        ;;
    down)
        down
        ;;
    restart)
        restart
        ;;
    update)
        update
        ;;
    logs)
        logs "$@"
        ;;
    status)
        status
        ;;
    help|*)
        help
        ;;
esac
