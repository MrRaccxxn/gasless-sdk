import { Gasless } from './src'

// Example of PRODUCTION setup with backend relayer service
async function main() {
  // Initialize SDK with preset chain - uses backend relayer service (SECURE!)
  const gasless = new Gasless({
    chainPreset: 'mantle-mainnet',
    environment: 'production', // Uses production relayer service
    apiKey: 'your-api-key' // Authenticates with your backend relayer service
  })
  // Private keys are safely stored in your backend service, NOT in client code!

  // Connect to user's browser wallet (MetaMask, etc.) - NO PRIVATE KEYS NEEDED!
  try {
    const userAddress = await gasless.connectWallet()
    console.log('Connected wallet:', userAddress)
  } catch (error) {
    console.error('Failed to connect wallet:', error)
    return
  }

  // Simple transfer - only to, amount, and token required
  // The SDK will:
  // 1. Prompt user to sign permit in MetaMask (giving permission to transfer tokens)
  // 2. Send signed permit to your secure backend relayer service
  // 3. Backend service executes transaction using securely stored private keys
  const result = await gasless.transfer({
    to: '0xRecipientAddress',
    amount: 1000000n, // Amount in wei/token units
    token: '0xTokenAddress'
  })

  console.log('Transfer result:', result)
  console.log('Transaction hash:', result.hash) // Actual on-chain transaction hash
}

// Example with error handling and local development
async function secureTransfer() {
  const gasless = new Gasless({ 
    chainPreset: 'mantle-sepolia',
    environment: 'local' // Uses localhost:3001 - great for development!
  })
  
  try {
    // Step 1: Connect wallet (shows MetaMask popup)
    const userAddress = await gasless.connectWallet()
    console.log('✅ Wallet connected:', userAddress)
    
    // Step 2: Check token balance
    const balance = await gasless.getBalance('0xTokenAddress', userAddress)
    console.log('Token balance:', balance)
    
    // Step 3: Execute gasless transfer
    const result = await gasless.transfer({
      to: '0xRecipientAddress',
      amount: 1000000n,
      token: '0xTokenAddress'
    })
    
    console.log('✅ Transfer successful!')
    console.log('Transaction hash:', result.hash)
    
  } catch (error) {
    console.error('❌ Transfer failed:', error)
  }
}

// Alternative: Using the advanced SDK directly
import { GaslessSDK } from './src'

async function advancedExample() {
  // Direct SDK usage with preset - relayer private key is built-in!
  const sdk = new GaslessSDK({
    chainPreset: 'mantle-sepolia'
  })

  // Connect browser wallet - NO PRIVATE KEYS!
  const userAddress = await sdk.connectWallet()
  console.log('Connected:', userAddress)

  // Use the simplified transfer method
  const result = await sdk.transfer({
    to: '0xRecipientAddress',
    amount: 1000000n,
    token: '0xTokenAddress'
  })

  console.log('Transfer result:', result)
  console.log('Actual blockchain transaction:', result.hash)
}

// React/Next.js example
async function reactExample() {
  const gasless = new Gasless({ chainPreset: 'mantle-mainnet' })
  
  const handleConnect = async () => {
    try {
      const address = await gasless.connectWallet()
      console.log('Connected:', address)
      // Update your React state here
    } catch (error) {
      console.error('Connection failed:', error)
    }
  }

  const handleTransfer = async (to: string, amount: bigint, token: string) => {
    try {
      const result = await gasless.transfer({ to, amount, token })
      console.log('Success:', result.hash)
      // Update your UI to show success
    } catch (error) {
      console.error('Transfer failed:', error)
      // Show error message to user
    }
  }
}

// Available chain presets:
// - 'mantle-sepolia' (testnet) - includes built-in relayer private key
// - 'mantle-mainnet' (mainnet) - includes built-in relayer private key

// Key benefits:
// 1. ✅ ZERO private key management for users
// 2. ✅ MetaMask/wallet popup integration  
// 3. ✅ Secure backend relayer service handles gas payments
// 4. ✅ Real on-chain transactions
// 5. ✅ Private keys safely stored in backend (never exposed to clients)
// 6. ✅ Secure permit-based authorization

// 🔒 SECURITY ARCHITECTURE:
// Frontend (Browser) → Backend Relayer Service → Blockchain
//      ↓                        ↓                    ↓
// 1. Sign permits         2. Store private keys   3. Execute transactions
// 2. Send to backend      3. Execute securely     4. Pay gas fees
// ❌ NO private keys      ✅ Secure storage       ✅ Real transactions

export { main, secureTransfer, advancedExample, reactExample }