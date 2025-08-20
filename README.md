# gasless-core

> ⚠️ **Early Development Warning**: This package is in very early stages of development. The API is subject to significant changes and many features are not yet implemented. Use at your own risk in production environments.

A TypeScript SDK for enabling gasless token transfers on Mantle EVM using meta-transactions and permit-based approvals.

## Features

- 🚫⛽ **Gasless Transactions**: Enable users to transfer tokens without holding native tokens for gas
- 🔐 **EIP-2612 Permit Support**: Leverage permit-based approvals for enhanced UX
- 🌉 **Meta-Transaction Framework**: Built on top of meta-transaction patterns
- 📝 **TypeScript First**: Full type safety and excellent developer experience
- 🧪 **Thoroughly Tested**: Comprehensive test suite with Jest

## Installation

```bash
npm install gasless-core
```

```bash
yarn add gasless-core
```

```bash
pnpm add gasless-core
```

## Quick Start

```typescript
import { GaslessSDK } from 'gasless-core'
import { createPublicClient, createWalletClient, http } from 'viem'

// Initialize the SDK
const config = {
  chainId: 5000, // Mantle Network
  rpcUrl: 'https://rpc.mantle.xyz',
  relayerUrl: 'https://your-relayer.com',
  forwarderAddress: '0x...' // Your forwarder contract address
}

const publicClient = createPublicClient({
  transport: http(config.rpcUrl)
})

const sdk = new GaslessSDK(config, publicClient)

// Set wallet client for signing
const walletClient = createWalletClient({
  transport: http(config.rpcUrl)
})
sdk.setWalletClient(walletClient)

// Perform a gasless transfer (mock implementation)
const result = await sdk.transferGasless({
  token: '0x...', // Token contract address
  to: '0x...', // Recipient address
  amount: 1000000000000000000n, // Amount in wei
  userAddress: '0x...' // Sender address
})

console.log('Transfer result:', result)
```

## API Reference

### GaslessSDK

The main SDK class for interacting with gasless transactions.

#### Constructor

```typescript
new GaslessSDK(config: GaslessConfig, publicClient: PublicClient)
```

#### Methods

##### `setWalletClient(walletClient: WalletClient): void`
Sets the wallet client for transaction signing.

##### `transferGasless(params: GaslessTransferParams): Promise<TransactionResult>`
Executes a gasless token transfer (currently mock implementation).

##### `getTokenInfo(tokenAddress: Address): Promise<TokenInfo>`
Retrieves token information (not yet implemented).

##### `estimateGas(params: GaslessTransferParams): Promise<bigint>`
Estimates gas for a gasless transfer (not yet implemented).

##### `getUserNonce(userAddress: Address): Promise<bigint>`
Gets the current nonce for a user (not yet implemented).

##### `helloWorld(): string`
Returns a hello world message for testing.

##### `getConfig(): GaslessConfig`
Returns a copy of the current configuration.

### EIP2612Permit

Utility class for EIP-2612 permit functionality.

```typescript
import { EIP2612Permit } from 'gasless-core'

const permit = new EIP2612Permit(
  tokenAddress,
  tokenName,
  tokenVersion,
  chainId
)

// Get typed data for permit signing
const typedData = permit.getTypedData(permitData)
```

### Utility Functions

```typescript
import {
  validateAddress,
  validateAmount,
  formatTokenAmount,
  parseTokenAmount
} from 'gasless-core'

// Validate Ethereum address
const validAddress = validateAddress('0x...')

// Validate transfer amount
validateAmount(1000000000000000000n)

// Format token amounts for display
const formatted = formatTokenAmount(1000000000000000000n, 18) // "1"

// Parse user input to token amount
const amount = parseTokenAmount('1.5', 18) // 1500000000000000000n
```

## Types

The package exports comprehensive TypeScript types:

```typescript
import type {
  GaslessConfig,
  TokenInfo,
  GaslessTransferParams,
  TransactionResult,
  PermitSignature,
  EIP712Domain
} from 'gasless-core'
```

### GaslessConfig

```typescript
interface GaslessConfig {
  readonly chainId: number
  readonly rpcUrl: string
  readonly relayerUrl: string
  readonly forwarderAddress: Address
}
```

### GaslessTransferParams

```typescript
interface GaslessTransferParams {
  readonly token: Address
  readonly to: Address
  readonly amount: bigint
  readonly userAddress: Address
}
```

## Development Status

### ✅ Implemented
- Core SDK structure
- Type definitions
- Utility functions
- EIP-2612 permit structure
- Comprehensive testing setup

### 🚧 In Progress / Planned
- Actual gasless transfer implementation
- Relayer integration
- Gas estimation
- Nonce management
- Token info retrieval
- Meta-transaction forwarder
- Complete permit signing flow

## Requirements

- Node.js >= 16.0.0
- TypeScript >= 5.0.0
- Viem >= 1.19.9

## Contributing

This project is in early development. Contributions are welcome but please be aware that the API may change significantly.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Testing

```bash
npm test          # Run tests
npm run test:watch # Run tests in watch mode
npm run lint      # Run linter
npm run type-check # Run TypeScript compiler
```

## License

MIT

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/MrRaccxxn)
- Email: buildraccoon@gmail.com

---

**Note**: This package is designed specifically for the Mantle EVM ecosystem. For other EVM chains, configuration adjustments may be required.