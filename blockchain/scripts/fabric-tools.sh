#!/bin/bash
#
# Hyperledger Fabric Tools - Docker Wrapper Functions
# Provides Docker-based replacements for local fabric binaries
#

# Configuration
FABRIC_TOOLS_IMAGE="${FABRIC_TOOLS_IMAGE:-hyperledger/fabric-tools:2.5}"
FABRIC_TOOLS_USER="${FABRIC_TOOLS_USER:-$(id -u):$(id -g)}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker ps &> /dev/null; then
        print_error "Docker daemon is not running or not accessible"
        exit 1
    fi
}

# Pull fabric-tools image if not present
ensure_fabric_tools_image() {
    if ! docker image inspect "$FABRIC_TOOLS_IMAGE" &> /dev/null; then
        print_info "Pulling fabric-tools image: $FABRIC_TOOLS_IMAGE"
        docker pull "$FABRIC_TOOLS_IMAGE"
        if [ $? -eq 0 ]; then
            print_success "Successfully pulled $FABRIC_TOOLS_IMAGE"
        else
            print_error "Failed to pull $FABRIC_TOOLS_IMAGE"
            exit 1
        fi
    fi
}

# Generic function to run fabric tools in Docker
run_fabric_tool() {
    local tool_name="$1"
    shift
    local args="$@"
    
    check_docker
    ensure_fabric_tools_image
    
    print_info "Running $tool_name via Docker..."
    
    docker run --rm \
        -u "$FABRIC_TOOLS_USER" \
        -v "$PWD:/workspace" \
        -w /workspace \
        -e FABRIC_CFG_PATH=/workspace/config \
        "$FABRIC_TOOLS_IMAGE" \
        "$tool_name" $args
    
    return $?
}

# Wrapper functions for specific tools
fabric_cryptogen() {
    run_fabric_tool "cryptogen" "$@"
}

fabric_configtxgen() {
    run_fabric_tool "configtxgen" "$@"
}

fabric_configtxlator() {
    run_fabric_tool "configtxlator" "$@"
}

fabric_peer() {
    run_fabric_tool "peer" "$@"
}

fabric_orderer() {
    run_fabric_tool "orderer" "$@"
}

# Initialize function to set up environment
init_fabric_tools() {
    print_info "Initializing Fabric Tools with Docker..."
    print_info "Using image: $FABRIC_TOOLS_IMAGE"
    print_info "Running as user: $FABRIC_TOOLS_USER"
    
    check_docker
    ensure_fabric_tools_image
    
    print_success "Fabric Tools initialized successfully"
}

# Version information
show_fabric_tools_version() {
    echo "Fabric Tools Docker Wrapper"
    echo "Image: $FABRIC_TOOLS_IMAGE"
    echo "User: $FABRIC_TOOLS_USER"
    echo ""
    run_fabric_tool "peer" "version"
}