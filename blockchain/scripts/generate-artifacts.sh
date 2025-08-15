#!/bin/bash
#
# Hyperledger Fabric Crypto Material and Channel Artifacts Generation Script
# Generates everything needed for a 3 RAFT orderers + 3 peers network
# Uses Docker-based fabric-tools instead of local binaries
#

set -e

# Configuration
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CHANNEL_NAME=${CHANNEL_NAME:-mychannel}

# Source fabric tools utilities
source "$SCRIPT_DIR/fabric-tools.sh"

echo -e "${BLUE}Hyperledger Fabric Artifacts Generation (Docker)${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Initialize fabric tools and check prerequisites
print_info "Initializing Docker-based Fabric tools..."
init_fabric_tools

print_info "Checking configuration files..."

if [ ! -f "./config/crypto-config.yaml" ]; then
    print_error "crypto-config.yaml not found in ./config/"
    exit 1
fi

if [ ! -f "./config/configtx.yaml" ]; then
    print_error "configtx.yaml not found in ./config/"
    exit 1
fi

print_success "Prerequisites check passed"

# Clean up existing artifacts
print_info "Cleaning up existing artifacts..."
rm -rf ./organizations 2>/dev/null || true
rm -rf ./system-genesis-block/*.block 2>/dev/null || true
rm -rf ./channel-artifacts/*.tx 2>/dev/null || true

# Ensure output directories exist
mkdir -p ./system-genesis-block
mkdir -p ./channel-artifacts

print_success "Cleanup completed"

# Generate crypto material
print_info "Generating crypto material using Docker-based cryptogen..."
fabric_cryptogen generate --config=./config/crypto-config.yaml --output=./organizations

if [ $? -eq 0 ]; then
    print_success "Crypto material generated successfully"
else
    print_error "Failed to generate crypto material"
    exit 1
fi

# Verify crypto material structure
print_info "Verifying crypto material structure..."
if [ -d "./organizations/ordererOrganizations/example.com/orderers/orderer0.example.com" ] && \
   [ -d "./organizations/ordererOrganizations/example.com/orderers/orderer1.example.com" ] && \
   [ -d "./organizations/ordererOrganizations/example.com/orderers/orderer2.example.com" ] && \
   [ -d "./organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com" ] && \
   [ -d "./organizations/peerOrganizations/org1.example.com/peers/peer1.org1.example.com" ] && \
   [ -d "./organizations/peerOrganizations/org1.example.com/peers/peer2.org1.example.com" ]; then
    print_success "Crypto material structure verified (3 orderers + 3 peers)"
else
    print_error "Crypto material structure verification failed"
    exit 1
fi

# Generate genesis block
print_info "Generating genesis block for system channel..."
fabric_configtxgen -profile OrdererGenesis -channelID system-channel -outputBlock ./system-genesis-block/genesis.block

if [ $? -eq 0 ]; then
    print_success "Genesis block generated successfully"
else
    print_error "Failed to generate genesis block"
    exit 1
fi

# Generate channel creation transaction
print_info "Generating channel creation transaction..."
fabric_configtxgen -profile ChannelProfile -outputCreateChannelTx ./channel-artifacts/${CHANNEL_NAME}.tx -channelID ${CHANNEL_NAME}

if [ $? -eq 0 ]; then
    print_success "Channel creation transaction generated successfully"
else
    print_error "Failed to generate channel creation transaction"
    exit 1
fi

# Generate anchor peer update transaction
print_info "Generating anchor peer update transaction..."
fabric_configtxgen -profile ChannelProfile -outputAnchorPeersUpdate ./channel-artifacts/Org1MSPanchors.tx -channelID ${CHANNEL_NAME} -asOrg Org1MSP

if [ $? -eq 0 ]; then
    print_success "Anchor peer update transaction generated successfully"
else
    print_error "Failed to generate anchor peer update transaction"
    exit 1
fi

# Summary
echo ""
echo -e "${GREEN}🎉 All artifacts generated successfully!${NC}"
echo ""
echo -e "${BLUE}Generated Files:${NC}"
echo "  📁 organizations/                     - Crypto material for all nodes"
echo "  📄 system-genesis-block/genesis.block - Genesis block for orderers"
echo "  📄 channel-artifacts/${CHANNEL_NAME}.tx        - Channel creation transaction"
echo "  📄 channel-artifacts/Org1MSPanchors.tx - Anchor peer update"
echo ""
echo -e "${BLUE}Network Overview:${NC}"
echo "  🔧 3 RAFT Orderers: orderer0, orderer1, orderer2"
echo "  🔧 3 Peers: peer0, peer1, peer2 (Org1)"
echo "  🔒 TLS Enabled with generated certificates"
echo "  📊 Ready for deployment with docker-compose"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Start the network: ../network.sh up"
echo "  2. Create channel and deploy chaincode"
echo "  3. Start developing your application!"
echo ""

# Optional: Display file sizes for verification
echo -e "${BLUE}Artifact Sizes:${NC}"
du -sh ./organizations 2>/dev/null || echo "  organizations/: N/A"
du -sh ./system-genesis-block/genesis.block 2>/dev/null || echo "  genesis.block: N/A" 
du -sh ./channel-artifacts/${CHANNEL_NAME}.tx 2>/dev/null || echo "  ${CHANNEL_NAME}.tx: N/A"
du -sh ./channel-artifacts/Org1MSPanchors.tx 2>/dev/null || echo "  Org1MSPanchors.tx: N/A"
echo ""

print_success "Artifact generation completed successfully!"