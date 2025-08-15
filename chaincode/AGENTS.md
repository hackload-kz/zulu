# Agent Guidelines for Zulu Chaincode

## Build/Lint/Test Commands

- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check formatting without changes

## Code Style

- **Module System**: ES modules (`type: "module"` in package.json), use `import/export`
- **Imports**: Order by builtin, external, internal, parent, sibling, index with newlines between groups
- **Formatting**: Prettier config - 2 spaces, single quotes, 100 char width, semicolons, trailing commas (ES5)
- **Variables**: Use `const`/`let`, never `var`. Prefer `const` when possible
- **Functions**: Prefer arrow functions, use object shorthand
- **Naming**: PascalCase for classes, camelCase for functions/variables, UPPER_CASE for constants
- **Error Handling**: Throw descriptive Error objects with context (e.g., `throw new Error(\`The asset \${id} does not exist\`)`)
- **Async**: Use async/await, avoid console.log (ESLint warns)

## Hyperledger Fabric Specifics

- Extend `Contract` class from `fabric-contract-api`
- Use deterministic JSON with `json-stringify-deterministic` and `sort-keys-recursive`
- Store state with `ctx.stub.putState(key, Buffer.from(stringify(sortKeysRecursive(data))))`
- Always check asset existence before operations
- Return JSON strings for chaincode responses
