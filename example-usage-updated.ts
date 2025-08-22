import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mantle } from 'viem/chains'
import { GaslessSDK } from './src'
import type { GaslessConfig } from './src'

async function main() {
  // Configuration
  const config: GaslessConfig = {
    chainId: 5000, // Mantle Mainnet
    rpcUrl: 'https://rpc.mantle.xyz',
    gaslessRelayerAddress: '0x...' // Your deployed GaslessRelayer contract address
  }

  // Create clients
  const publicClient = createPublicClient({
    chain: mantle,
    transport: http(config.rpcUrl)
  })

  const account = privateKeyToAccount('0x...' as `0x${string}`) // User's private key
  const walletClient = createWalletClient({
    account,
    chain: mantle,
    transport: http(config.rpcUrl)
  })

  // Initialize SDK
  const gaslessSDK = new GaslessSDK(config, publicClient)
  gaslessSDK.setWalletClient(walletClient)

  try {
    // Check if token is whitelisted
    const tokenAddress = '0x...' // ERC20 token address
    const tokenInfo = await gaslessSDK.getTokenInfo(tokenAddress)
    console.log('Token info:', tokenInfo)

    if (!tokenInfo.isWhitelisted) {
      console.log('Token is not whitelisted for gasless transfers')
      return
    }

    // Check contract limits
    const limits = await gaslessSDK.getContractLimits()
    console.log('Contract limits:', limits)

    // Get user's current nonce
    const userNonce = await gaslessSDK.getUserNonce(account.address)
    console.log('User nonce:', userNonce)

    // Estimate gas for the transfer
    const transferParams = {
      token: tokenAddress,
      to: '0x...' as `0x${string}`, // Recipient address
      amount: 1000000n, // 1 USDC (assuming 6 decimals)
      fee: 0n // No fee for this example
    }

    const estimatedGas = await gaslessSDK.estimateGas(transferParams)
    console.log('Estimated gas:', estimatedGas)

    // Execute gasless transfer
    console.log('Executing gasless transfer...')
    const result = await gaslessSDK.transferGasless(transferParams)
    console.log('Transfer result:', result)

    if (result.success) {
      console.log('✅ Gasless transfer completed successfully!')
      console.log('Transaction hash:', result.hash)
      console.log('Meta-transaction hash:', result.metaTxHash)
    } else {
      console.log('❌ Transfer failed')
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

// Example with fee
async function transferWithFee() {
  // ... setup code same as above ...
  
  const transferParams = {
    token: '0x...' as `0x${string}`,
    to: '0x...' as `0x${string}`,
    amount: 1000000n, // 1 USDC
    fee: 10000n // 0.01 USDC fee for relayer
  }

  try {
    const result = await gaslessSDK.transferGasless(transferParams)
    console.log('Transfer with fee completed:', result)
  } catch (error) {
    console.error('Transfer failed:', error)
  }
}

// Example with custom deadline
async function transferWithDeadline() {
  const transferParams = {
    token: '0x...' as `0x${string}`,
    to: '0x...' as `0x${string}`,
    amount: 1000000n,
    fee: 0n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 1800) // 30 minutes from now
  }

  try {
    const result = await gaslessSDK.transferGasless(transferParams)
    console.log('Transfer with custom deadline completed:', result)
  } catch (error) {
    console.error('Transfer failed:', error)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { main, transferWithFee, transferWithDeadline }