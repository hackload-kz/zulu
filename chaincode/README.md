# Hyperledger Fabric Node.js Smart Contract Development Project

A minimal, production-ready Node.js/JavaScript project structure for developing Hyperledger Fabric smart contracts (chaincode).

## 🏗️ Project Structure

```
project-root/
├── contracts/
│   └── asset-transfer-javascript/    # Sample JavaScript chaincode
│       ├── package.json
│       ├── index.js                  # Chaincode entry point
│       └── lib/
│           └── assetTransfer.js      # Business logic
├── package.json                     # Root package.json with ES modules
├── .eslintrc.json                   # ESLint configuration
├── .prettierrc.json                 # Prettier configuration
├── jsconfig.json                    # TypeScript intellisense support
└── README.md
```

## ⚡ Quick Start

### Prerequisites

Ensure you have the following installed:

- **Node.js v16+** and **npm**

### Chaincode Development

The project starts with the official `asset-transfer-javascript` sample chaincode that includes:

- **Asset creation, reading, updating, and deletion**
- **Asset ownership transfer**
- **Ledger initialization**
- **Query all assets functionality**

## 📦 Available Scripts

### Root Package Scripts

- `npm run lint` - Run ESLint on all JavaScript files
- `npm run format` - Format code with Prettier

## 🛠️ Development Tools

### Code Quality

- **ESLint** - Linting with modern JavaScript rules
- **Prettier** - Code formatting
- **jsconfig.json** - TypeScript intellisense for better IDE support

### Debugging

- **Node.js Inspector** - Debug chaincode with Chrome DevTools
- **Comprehensive logging** - Detailed operation logs

## 📚 Resources

- [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/)
- [Fabric Node.js Chaincode API](https://hyperledger.github.io/fabric-chaincode-node/main/api/)
- [fabric-samples Repository](https://github.com/hyperledger/fabric-samples)
- [Chaincode-as-a-Service Tutorial](https://github.com/hyperledger/fabric-samples/blob/main/test-network/CHAINCODE_AS_A_SERVICE_TUTORIAL.md)

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

