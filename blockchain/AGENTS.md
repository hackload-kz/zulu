# Agent Guidelines - Hyperledger Fabric Network

## Build/Test Commands
- `./network.sh up` - Start the network
- `./network.sh down` - Stop the network  
- `./network.sh status` - Check network status
- `./network.sh logs` - View container logs
- `./network.sh generate` - Generate crypto material
- `./network.sh channel` - Create and join channel (fully implemented)
- `CHAINCODE_PATH=./my-cc ./network.sh deploy` - Deploy chaincode (fully implemented)
- `./network.sh version` - Show fabric tools version
- `docker exec -it cli bash` - Enter CLI container for chaincode operations
- `docker logs <container-name>` - View specific container logs

## Network Architecture
- 3 RAFT orderers (orderer0-2.example.com:7050/8050/9050)
- 3 peers (peer0-2.org1.example.com:7051/8051/9051)
- TLS enabled, Prometheus metrics on ports 9443-9448
- Docker-based fabric tools (hyperledger/fabric-tools:2.5)

## Code Style Guidelines
- Use kebab-case for hostnames (orderer0.example.com)
- YAML files use 2-space indentation
- Shell scripts use bash shebang with `set -e`
- Environment variables in UPPER_CASE
- Container names match service names
- Use meaningful variable names (CHANNEL_NAME, CHAINCODE_VERSION)
- Docker wrapper functions in scripts/fabric-tools.sh

## Development Workflow
1. Generate artifacts: `./scripts/generate-artifacts.sh` (Docker-based)
2. Start network: `./network.sh up`
3. Create channel: `./network.sh channel` (automated)
4. Deploy chaincode: `CHAINCODE_PATH=./my-chaincode ./network.sh deploy` (automated)
5. Monitor with logs and metrics endpoints
6. Use FABRIC_TOOLS_IMAGE env var to specify version

## Complete Workflow Example
```bash
./network.sh generate    # Generate crypto material
./network.sh up          # Start all containers
./network.sh channel     # Create mychannel and join all peers
CHAINCODE_PATH=./my-chaincode ./network.sh deploy  # Deploy chaincode
```