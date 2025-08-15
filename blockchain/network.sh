#!/bin/bash
#
# Hyperledger Fabric Network Management Script
# Optimized for hackathon use with high availability setup
# Uses Docker-based fabric-tools instead of local binaries
#

set -e

# Configuration
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
COMPOSE_FILE="docker-compose.yaml"
NETWORK_NAME="fabric_network"
CHANNEL_NAME="mychannel"
CHAINCODE_NAME="mycc"
CHAINCODE_VERSION="1.0"

# Source fabric tools utilities
source "$SCRIPT_DIR/scripts/fabric-tools.sh"

# Helper functions
print_help() {
    echo -e "${BLUE}Hyperledger Fabric Network Management (Docker)${NC}"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  up        - Start the network"
    echo "  down      - Stop and cleanup the network"
    echo "  restart   - Restart the network"
    echo "  status    - Show network status"
    echo "  logs      - Show logs for all services"
    echo "  clean     - Clean all artifacts and restart fresh"
    echo "  channel   - Create and join channel"
    echo "  deploy    - Deploy chaincode (requires CHAINCODE_PATH)"
    echo "  generate  - Generate fresh crypto material and artifacts"
    echo "  version   - Show fabric tools version information"
    echo "  help      - Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  CHAINCODE_PATH - Path to chaincode directory (for deploy command)"
    echo "  FABRIC_TOOLS_IMAGE - Docker image for fabric tools (default: hyperledger/fabric-tools:2.5)"
    echo ""
    echo "Examples:"
    echo "  $0 up                                    # Start the network"
    echo "  $0 channel                               # Create and join channel"
    echo "  CHAINCODE_PATH=./my-chaincode $0 deploy  # Deploy chaincode"
    echo "  FABRIC_TOOLS_IMAGE=hyperledger/fabric-tools:latest $0 generate"
    echo ""
    echo "Complete workflow:"
    echo "  1. ./network.sh generate    # Generate crypto material"
    echo "  2. ./network.sh up          # Start network"
    echo "  3. ./network.sh channel     # Create channel"
    echo "  4. CHAINCODE_PATH=./my-chaincode ./network.sh deploy"
}

check_prerequisites() {
    print_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Initialize fabric tools
    init_fabric_tools
    
    print_success "Prerequisites check passed"
}

generate_crypto_material() {
    print_info "Checking crypto material..."
    
    if [ ! -d "organizations" ]; then
        print_info "No existing crypto material found. Generating fresh artifacts..."
        if [ -f "./scripts/generate-artifacts.sh" ]; then
            ./scripts/generate-artifacts.sh
        else
            print_error "scripts/generate-artifacts.sh script not found"
            print_warning "Please run: ./scripts/generate-artifacts.sh"
            exit 1
        fi
    else
        print_success "Existing crypto material found"
    fi
}

network_up() {
    print_info "Starting Hyperledger Fabric network..."
    
    check_prerequisites
    generate_crypto_material
    
    print_info "Starting containers..."
    docker-compose -f $COMPOSE_FILE up -d
    
    # Wait for containers to be ready
    wait_for_containers
    
    print_success "Network started successfully!"
    print_info "Network endpoints:"
    echo "  Orderers: localhost:7050, localhost:8050, localhost:9050"
    echo "  Peers: localhost:7051, localhost:8051, localhost:9051"
    echo "  Operations: localhost:9443-9448 (Prometheus metrics)"
    echo ""
    print_info "Next steps:"
    echo "  1. Create channel: ./network.sh channel"
    echo "  2. Deploy chaincode: CHAINCODE_PATH=./my-chaincode ./network.sh deploy"
    echo "  3. Access CLI: docker exec -it cli bash"
}

network_down() {
    print_info "Stopping Hyperledger Fabric network..."
    
    docker-compose -f $COMPOSE_FILE down
    
    print_success "Network stopped successfully!"
}

network_clean() {
    print_info "Cleaning up network artifacts..."
    
    docker-compose -f $COMPOSE_FILE down -v --remove-orphans
    
    # Remove generated artifacts (but keep source configurations)
    rm -rf organizations/ 2>/dev/null || true
    rm -rf system-genesis-block/*.block 2>/dev/null || true
    rm -rf channel-artifacts/*.tx 2>/dev/null || true
    rm -rf channels/*.block channels/*.tx 2>/dev/null || true
    
    # Optionally clean Docker system (commented out to be less aggressive)
    # docker system prune -f
    
    print_success "Network artifacts cleaned successfully!"
    print_info "Run './network.sh generate' to recreate crypto material"
}

network_restart() {
    print_info "Restarting network..."
    network_down
    sleep 5
    network_up
}

network_status() {
    print_info "Network Status:"
    echo ""
    
    if docker network ls | grep -q $NETWORK_NAME; then
        print_success "Network exists"
    else
        print_error "Network does not exist"
    fi
    
    echo ""
    print_info "Container Status:"
    docker-compose -f $COMPOSE_FILE ps
}

show_logs() {
    print_info "Showing network logs..."
    docker-compose -f $COMPOSE_FILE logs -f
}

# Helper functions for CLI operations
check_cli_container() {
    if ! docker ps | grep -q "cli"; then
        print_error "CLI container is not running"
        print_info "Please start the network first: ./network.sh up"
        exit 1
    fi
}

wait_for_containers() {
    print_info "Waiting for all containers to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f $COMPOSE_FILE ps | grep -q "Up"; then
            local unhealthy=$(docker-compose -f $COMPOSE_FILE ps | grep -v "Up" | grep -c "orderer\|peer\|cli" || true)
            if [ "$unhealthy" -eq 0 ]; then
                print_success "All containers are ready"
                return 0
            fi
        fi
        
        print_info "Attempt $attempt/$max_attempts: Waiting for containers..."
        sleep 5
        ((attempt++))
    done
    
    print_error "Containers failed to start properly within timeout"
    return 1
}

exec_cli() {
    local command="$1"
    print_info "Executing: $command"
    docker exec cli bash -c "$command"
}

create_channel() {
    print_info "Creating and joining channel: $CHANNEL_NAME"
    
    # Check prerequisites
    check_cli_container
    
    # Create channel directory if it doesn't exist
    mkdir -p channels
    
    # Check if channel transaction exists
    if [ ! -f "channel-artifacts/${CHANNEL_NAME}.tx" ]; then
        print_error "Channel transaction file not found: channel-artifacts/${CHANNEL_NAME}.tx"
        print_info "Please run: ./network.sh generate"
        exit 1
    fi
    
    # Check if channel already exists
    if [ -f "channels/${CHANNEL_NAME}.block" ]; then
        print_warning "Channel block already exists. Skipping channel creation."
    else
        print_info "Creating channel: $CHANNEL_NAME"
        
        # Create the channel
        exec_cli "peer channel create \
            -o orderer0.example.com:7050 \
            -c $CHANNEL_NAME \
            -f /root/channel-artifacts/${CHANNEL_NAME}.tx \
            --outputBlock /root/channels/${CHANNEL_NAME}.block \
            --tls \
            --cafile /root/organizations/ordererOrganizations/example.com/orderers/orderer0.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
        
        if [ $? -eq 0 ]; then
            print_success "Channel $CHANNEL_NAME created successfully"
        else
            print_error "Failed to create channel $CHANNEL_NAME"
            exit 1
        fi
    fi
    
    print_info "Joining all peers to channel: $CHANNEL_NAME"
    
    # Join peer0 to channel
    print_info "Joining peer0.org1.example.com to channel"
    exec_cli "export CORE_PEER_ADDRESS=peer0.org1.example.com:7051 && \
              export CORE_PEER_TLS_ROOTCERT_FILE=/root/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt && \
              peer channel join -b /root/channels/${CHANNEL_NAME}.block"
    
    # Join peer1 to channel  
    print_info "Joining peer1.org1.example.com to channel"
    exec_cli "export CORE_PEER_ADDRESS=peer1.org1.example.com:8051 && \
              export CORE_PEER_TLS_ROOTCERT_FILE=/root/organizations/peerOrganizations/org1.example.com/peers/peer1.org1.example.com/tls/ca.crt && \
              peer channel join -b /root/channels/${CHANNEL_NAME}.block"
    
    # Join peer2 to channel
    print_info "Joining peer2.org1.example.com to channel"
    exec_cli "export CORE_PEER_ADDRESS=peer2.org1.example.com:9051 && \
              export CORE_PEER_TLS_ROOTCERT_FILE=/root/organizations/peerOrganizations/org1.example.com/peers/peer2.org1.example.com/tls/ca.crt && \
              peer channel join -b /root/channels/${CHANNEL_NAME}.block"
    
    # Update anchor peers
    if [ -f "channel-artifacts/Org1MSPanchors.tx" ]; then
        print_info "Updating anchor peers for Org1"
        exec_cli "export CORE_PEER_ADDRESS=peer0.org1.example.com:7051 && \
                  export CORE_PEER_TLS_ROOTCERT_FILE=/root/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt && \
                  peer channel update \
                    -o orderer0.example.com:7050 \
                    -c $CHANNEL_NAME \
                    -f /root/channel-artifacts/Org1MSPanchors.tx \
                    --tls \
                    --cafile /root/organizations/ordererOrganizations/example.com/orderers/orderer0.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
        
        if [ $? -eq 0 ]; then
            print_success "Anchor peers updated successfully"
        else
            print_warning "Failed to update anchor peers (non-critical)"
        fi
    fi
    
    print_success "Channel setup completed successfully!"
    print_info "All 3 peers have joined channel: $CHANNEL_NAME"
}

deploy_chaincode() {
    if [ -z "$CHAINCODE_PATH" ]; then
        print_error "CHAINCODE_PATH environment variable is required"
        print_info "Usage: CHAINCODE_PATH=./my-chaincode ./network.sh deploy"
        exit 1
    fi
    
    # Check prerequisites
    check_cli_container
    
    if [ ! -d "$CHAINCODE_PATH" ]; then
        print_error "Chaincode directory not found: $CHAINCODE_PATH"
        exit 1
    fi
    
    print_info "Deploying chaincode from: $CHAINCODE_PATH"
    print_info "Chaincode name: $CHAINCODE_NAME"
    print_info "Chaincode version: $CHAINCODE_VERSION"
    
    # Detect chaincode language
    local chaincode_lang="golang"
    if [ -f "$CHAINCODE_PATH/package.json" ]; then
        chaincode_lang="node"
    elif [ -f "$CHAINCODE_PATH/main.go" ] || [ -f "$CHAINCODE_PATH/go.mod" ]; then
        chaincode_lang="golang"
    elif [ -f "$CHAINCODE_PATH/main.py" ] || [ -f "$CHAINCODE_PATH/requirements.txt" ]; then
        chaincode_lang="python"
    fi
    
    print_info "Detected chaincode language: $chaincode_lang"
    
    # Copy chaincode to CLI container
    print_info "Copying chaincode to CLI container..."
    docker cp "$CHAINCODE_PATH" "cli:/root/chaincode/$CHAINCODE_NAME"
    
    # Package chaincode
    print_info "Packaging chaincode..."
    exec_cli "peer lifecycle chaincode package ${CHAINCODE_NAME}.tar.gz \
        --path /root/chaincode/$CHAINCODE_NAME \
        --lang $chaincode_lang \
        --label ${CHAINCODE_NAME}_${CHAINCODE_VERSION}"
    
    if [ $? -ne 0 ]; then
        print_error "Failed to package chaincode"
        exit 1
    fi
    
    print_success "Chaincode packaged successfully"
    
    # Install chaincode on all peers
    print_info "Installing chaincode on all peers..."
    
    # Install on peer0
    print_info "Installing on peer0.org1.example.com"
    exec_cli "export CORE_PEER_ADDRESS=peer0.org1.example.com:7051 && \
              export CORE_PEER_TLS_ROOTCERT_FILE=/root/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt && \
              peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz"
    
    # Install on peer1
    print_info "Installing on peer1.org1.example.com"
    exec_cli "export CORE_PEER_ADDRESS=peer1.org1.example.com:8051 && \
              export CORE_PEER_TLS_ROOTCERT_FILE=/root/organizations/peerOrganizations/org1.example.com/peers/peer1.org1.example.com/tls/ca.crt && \
              peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz"
    
    # Install on peer2
    print_info "Installing on peer2.org1.example.com"
    exec_cli "export CORE_PEER_ADDRESS=peer2.org1.example.com:9051 && \
              export CORE_PEER_TLS_ROOTCERT_FILE=/root/organizations/peerOrganizations/org1.example.com/peers/peer2.org1.example.com/tls/ca.crt && \
              peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz"
    
    print_success "Chaincode installed on all peers"
    
    # Get package ID
    print_info "Retrieving chaincode package ID..."
    local package_id=$(docker exec cli bash -c "peer lifecycle chaincode queryinstalled --output json | jq -r '.installed_chaincodes[] | select(.label==\"${CHAINCODE_NAME}_${CHAINCODE_VERSION}\") | .package_id'")
    
    if [ -z "$package_id" ] || [ "$package_id" = "null" ]; then
        print_error "Failed to retrieve package ID"
        exit 1
    fi
    
    print_success "Package ID: $package_id"
    
    # Approve chaincode for organization
    print_info "Approving chaincode for Org1..."
    exec_cli "export CORE_PEER_ADDRESS=peer0.org1.example.com:7051 && \
              export CORE_PEER_TLS_ROOTCERT_FILE=/root/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt && \
              peer lifecycle chaincode approveformyorg \
                -o orderer0.example.com:7050 \
                --channelID $CHANNEL_NAME \
                --name $CHAINCODE_NAME \
                --version $CHAINCODE_VERSION \
                --package-id $package_id \
                --sequence 1 \
                --tls \
                --cafile /root/organizations/ordererOrganizations/example.com/orderers/orderer0.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
    
    if [ $? -ne 0 ]; then
        print_error "Failed to approve chaincode"
        exit 1
    fi
    
    print_success "Chaincode approved for Org1"
    
    # Check commit readiness
    print_info "Checking commit readiness..."
    exec_cli "peer lifecycle chaincode checkcommitreadiness \
        --channelID $CHANNEL_NAME \
        --name $CHAINCODE_NAME \
        --version $CHAINCODE_VERSION \
        --sequence 1 \
        --tls \
        --cafile /root/organizations/ordererOrganizations/example.com/orderers/orderer0.example.com/msp/tlscacerts/tlsca.example.com-cert.pem \
        --output json"
    
    # Commit chaincode
    print_info "Committing chaincode to channel..."
    exec_cli "export CORE_PEER_ADDRESS=peer0.org1.example.com:7051 && \
              export CORE_PEER_TLS_ROOTCERT_FILE=/root/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt && \
              peer lifecycle chaincode commit \
                -o orderer0.example.com:7050 \
                --channelID $CHANNEL_NAME \
                --name $CHAINCODE_NAME \
                --version $CHAINCODE_VERSION \
                --sequence 1 \
                --tls \
                --cafile /root/organizations/ordererOrganizations/example.com/orderers/orderer0.example.com/msp/tlscacerts/tlsca.example.com-cert.pem \
                --peerAddresses peer0.org1.example.com:7051 \
                --tlsRootCertFiles /root/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
    
    if [ $? -ne 0 ]; then
        print_error "Failed to commit chaincode"
        exit 1
    fi
    
    print_success "Chaincode committed successfully!"
    
    # Query committed chaincodes
    print_info "Verifying chaincode deployment..."
    exec_cli "peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME --name $CHAINCODE_NAME"
    
    print_success "Chaincode deployment completed successfully!"
    print_info "Chaincode '$CHAINCODE_NAME' version '$CHAINCODE_VERSION' is now active on channel '$CHANNEL_NAME'"
}

generate_artifacts() {
    print_info "Generating fresh crypto material and artifacts..."
    
    if [ -f "./scripts/generate-artifacts.sh" ]; then
        ./scripts/generate-artifacts.sh
    else
        print_error "scripts/generate-artifacts.sh script not found"
        exit 1
    fi
}

show_version() {
    show_fabric_tools_version
}

# Main script logic
case "$1" in
    "up")
        network_up
        ;;
    "down")
        network_down
        ;;
    "restart")
        network_restart
        ;;
    "clean")
        network_clean
        ;;
    "status")
        network_status
        ;;
    "logs")
        show_logs
        ;;
    "channel")
        create_channel
        ;;
    "deploy")
        deploy_chaincode
        ;;
    "generate")
        generate_artifacts
        ;;
    "version")
        show_version
        ;;
    "help"|"--help"|"-h")
        print_help
        ;;
    *)
        print_error "Unknown command '$1'"
        echo ""
        print_help
        exit 1
        ;;
esac