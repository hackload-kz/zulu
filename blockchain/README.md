# Hyperledger Fabric Scalable Network

A high-availability, scalable Hyperledger Fabric blockchain network optimized for hackathons and development. Features 3 RAFT orderers and 3 peers for maximum throughput and fault tolerance. **Fully Docker-based** - no local binaries required!

## 🚀 Quick Start

```bash
# Complete automated workflow
./network.sh generate    # Generate crypto material
./network.sh up          # Start network
./network.sh channel     # Create channel and join all peers
CHAINCODE_PATH=./my-chaincode ./network.sh deploy  # Deploy chaincode

# Management commands
./network.sh status      # Check status
./network.sh logs        # View logs
./network.sh down        # Stop network
```

## 📋 Prerequisites

- Docker 20.0+
- Docker Compose 1.29+
- 8GB+ RAM recommended
- **No Fabric binaries needed** - everything runs in Docker containers!

## 🏗 Architecture

### Network Topology

- **1 Organization** (Org1)
- **3 RAFT Orderers** (High Availability + Consensus)
- **3 Peers** (Load Balancing + Fault Tolerance)
- **LevelDB** State Database (Fast, Simple)
- **TLS Enabled** (Security)
- **Prometheus Metrics** (Monitoring)
- **Docker-First Design** (No local binaries, consistent environments)

### Key Features

✅ **Zero Setup** - Only Docker required  
✅ **Automated Everything** - Channel creation, peer joining, chaincode deployment  
✅ **Language Detection** - Auto-detects Go, Node.js, Python chaincode  
✅ **Production Ready** - High availability with 3 orderers + 3 peers  
✅ **Version Flexible** - Switch Fabric versions easily  
✅ **Hackathon Optimized** - Network ready in under 2 minutes

### Port Mapping

```
Orderers:
- orderer0.example.com: 7050 (client), 7053 (admin), 9443 (metrics)
- orderer1.example.com: 8050 (client), 8053 (admin), 9444 (metrics)
- orderer2.example.com: 9050 (client), 9053 (admin), 9445 (metrics)

Peers:
- peer0.org1.example.com: 7051 (client), 9446 (metrics)
- peer1.org1.example.com: 8051 (client), 9447 (metrics)
- peer2.org1.example.com: 9051 (client), 9448 (metrics)
```

## 🛠 Setup Instructions

### Complete Automated Workflow

```bash
# 1. Generate all crypto material and artifacts
./network.sh generate

# 2. Start the network (with automatic container health checks)
./network.sh up

# 3. Create channel and join all peers automatically
./network.sh channel

# 4. Deploy your chaincode (auto-detects language: Go, Node.js, Python)
CHAINCODE_PATH=./my-chaincode ./network.sh deploy
```

That's it! **Everything is automated** - no manual CLI commands needed.

### Individual Commands

```bash
# Network management
./network.sh generate    # Generate crypto material
./network.sh up          # Start all containers
./network.sh down        # Stop network
./network.sh restart     # Restart network
./network.sh clean       # Clean all artifacts
./network.sh status      # Show container status
./network.sh logs        # View all logs

# Channel and chaincode operations
./network.sh channel     # Create mychannel + join all 3 peers + update anchors
CHAINCODE_PATH=./my-cc ./network.sh deploy  # Full chaincode lifecycle

# Utilities
./network.sh version     # Show Fabric tools version
./network.sh help        # Show all commands
```

## 📊 Performance Optimizations

### For High Request Frequency:

1. **Load Balancing**: Distribute requests across all 3 peers
2. **RAFT Consensus**: 3 orderers provide fault tolerance and improved throughput
3. **Resource Limits**: Configured for optimal memory usage
4. **Keepalive Settings**: Optimized for persistent connections
5. **Prometheus Metrics**: Monitor performance in real-time

### Recommended Client Configuration:

```javascript
// Node.js SDK example
const gateway = new Gateway();
await gateway.connect(connectionProfile, {
  wallet: wallet,
  identity: 'user1',
  discovery: {
    enabled: true,
    asLocalhost: true,
  },
  eventHandlerOptions: {
    commitTimeout: 100,
    strategy: DefaultEventHandlerStrategies.MSP_SCOPE_ANYFORTX,
  },
});
```

## 🔧 Management Commands

### Network Management

```bash
./network.sh generate  # Generate crypto material and artifacts
./network.sh up        # Start network
./network.sh down      # Stop network
./network.sh restart   # Restart network
./network.sh clean     # Clean and restart
./network.sh status    # Show status
./network.sh logs      # Show logs
```

### Development Workflow

```bash
# Complete development cycle
./network.sh generate && ./network.sh up && ./network.sh channel
CHAINCODE_PATH=./my-chaincode ./network.sh deploy

# Monitor specific container logs
./network.sh logs                    # All containers
docker logs -f peer0.org1.example.com  # Specific peer
docker logs -f orderer0.example.com     # Specific orderer

# Manual CLI access (if needed)
docker exec -it cli bash
```

## 📈 Monitoring

Access Prometheus metrics:

- Orderer0: http://localhost:9443/metrics
- Orderer1: http://localhost:9444/metrics
- Orderer2: http://localhost:9445/metrics
- Peer0: http://localhost:9446/metrics
- Peer1: http://localhost:9447/metrics
- Peer2: http://localhost:9448/metrics

## 🐛 Troubleshooting

### Common Issues:

1. **Port Conflicts**: Change ports in docker-compose.yaml
2. **Memory Issues**: Reduce container limits in .env
3. **TLS Errors**: Regenerate crypto material
4. **Network Issues**: Check Docker network: `docker network ls`

### Logs Analysis:

```bash
# View specific container logs
docker logs orderer0.example.com
docker logs peer0.org1.example.com

# Follow logs in real-time
docker logs -f cli
```

### Reset Network:

```bash
# Complete reset (removes all artifacts)
./network.sh clean

# Restart fresh
./network.sh generate && ./network.sh up
```

## 🎯 Hackathon Tips

1. **Lightning Fast Setup**: Everything automated - network ready in under 2 minutes
2. **No Dependencies**: Docker-only setup eliminates "it works on my machine" issues
3. **Smart Deployment**: Auto-detects chaincode language (Go/Node.js/Python)
4. **Production Ready**: 3 orderers + 3 peers = high availability out of the box
5. **Easy Monitoring**: Built-in Prometheus metrics + centralized logging
6. **Version Control**: Switch Fabric versions easily with `FABRIC_TOOLS_IMAGE=hyperledger/fabric-tools:latest`

## 📁 Project Structure

```
blockchain/
├── docker-compose.yaml           # Main network definition
├── network.sh                   # Main management script (does everything!)
├── scripts/
│   ├── generate-artifacts.sh    # Crypto generation script
│   └── fabric-tools.sh          # Docker wrapper functions
├── .fabric-tools.env           # Docker tools configuration
├── README.md                   # This file
├── connection-profile.json    # Connection profile for external apps
├── config/                     # Configuration files
│   ├── crypto-config.yaml     # Cryptogen configuration
│   └── configtx.yaml          # Network configuration
├── organizations/              # Generated crypto material (auto-created)
├── system-genesis-block/       # Genesis block (auto-created)
├── channel-artifacts/          # Channel creation artifacts (auto-created)
└── channels/                   # Channel blocks (auto-created)
```

**Note**: No `bin/` directory needed - all tools run in Docker containers!

## 📚 Quick Reference

### Essential Commands
```bash
# Start fresh
./network.sh generate && ./network.sh up && ./network.sh channel

# Deploy chaincode  
CHAINCODE_PATH=./my-chaincode ./network.sh deploy

# Development cycle
./network.sh clean && ./network.sh generate && ./network.sh up
```

### Environment Variables
```bash
FABRIC_TOOLS_IMAGE=hyperledger/fabric-tools:2.5    # Fabric version
CHAINCODE_PATH=./my-chaincode                       # Chaincode location
CHANNEL_NAME=mychannel                              # Channel name (default)
```

### Network Endpoints
- **Orderers**: `localhost:7050`, `localhost:8050`, `localhost:9050`  
- **Peers**: `localhost:7051`, `localhost:8051`, `localhost:9051`  
- **Metrics**: `localhost:9443-9448` (Prometheus)

## 🔗 Integration

This network is designed for external application integration:

- **Connection Profile**: Use provided `connection-profile.json`
- **Crypto Material**: Located in `organizations/` directory
- **Channel**: Default `mychannel` with all 3 peers joined
- **Chaincode**: Deploy via `CHAINCODE_PATH=./path ./network.sh deploy`
