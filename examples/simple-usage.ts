import { Gasless } from 'gasless-core'

// Simple configuration using your original GaslessRelayer contract
const config = {
  rpcUrl: 'https://rpc.mantle.xyz',
  chainId: 5000,
  relayerAddress: '0x1234567890123456789012345678901234567890' as const, // Your deployed GaslessRelayer contract
  relayerUrl: 'https://api.gasless-relayer.com', // Your relayer service
  apiKey: 'your-api-key'
}

// Example 1: Simple transfer
async function simpleTransfer() {
  const gasless = new Gasless(config)
  
  const result = await gasless.transfer({
    token: '0xToken123...',
    to: '0xRecipient456...',
    amount: 1000000n, // 1 USDC (6 decimals)
    from: '0xYourPrivateKey...' // Private key
  })
  
  console.log('Transfer successful:', result.success)
  console.log('Transaction hash:', result.hash)
}

// Example 2: One-line transfer (static method)
async function oneLineTransfer() {
  const result = await Gasless.quickTransfer(config, {
    token: '0xToken123...',
    to: '0xRecipient456...',
    amount: 1000000n,
    from: '0xYourPrivateKey...'
  })
  
  console.log('Quick transfer:', result)
}

// Example 3: Account Abstraction transfer
async function aaTransfer() {
  const aaConfig = {
    ...config,
    useAccountAbstraction: true,
    bundlerUrl: 'https://bundler.example.com',
    paymasterUrl: 'https://paymaster.example.com'
  }
  
  const gasless = new Gasless(aaConfig)
  
  const result = await gasless.transfer({
    token: '0xToken123...',
    to: '0xRecipient456...',
    amount: 1000000n,
    from: '0xYourPrivateKey...',
    feeToken: '0xFeeToken789...' // Pay fees in different token
  })
  
  console.log('AA Transfer:', result)
}

// Example 4: Check balance before transfer
async function checkAndTransfer() {
  const gasless = new Gasless(config)
  
  const balance = await gasless.getBalance(
    '0xToken123...',
    '0xYourAddress...'
  )
  
  if (balance >= 1000000n) {
    const result = await gasless.transfer({
      token: '0xToken123...',
      to: '0xRecipient456...',
      amount: 1000000n,
      from: '0xYourPrivateKey...'
    })
    console.log('Transfer result:', result)
  } else {
    console.log('Insufficient balance')
  }
}

// Example 5: Estimate gas before transfer
async function estimateAndTransfer() {
  const gasless = new Gasless(config)
  
  const gasEstimate = await gasless.estimateGas({
    token: '0xToken123...',
    to: '0xRecipient456...',
    amount: 1000000n,
    from: '0xYourPrivateKey...'
  })
  
  console.log('Estimated gas:', gasEstimate)
  
  // Proceed with transfer
  const result = await gasless.transfer({
    token: '0xToken123...',
    to: '0xRecipient456...',
    amount: 1000000n,
    from: '0xYourPrivateKey...'
  })
  
  console.log('Actual gas used:', result.gasUsed)
}

// Export examples
export {
  simpleTransfer,
  oneLineTransfer,
  aaTransfer,
  checkAndTransfer,
  estimateAndTransfer
}