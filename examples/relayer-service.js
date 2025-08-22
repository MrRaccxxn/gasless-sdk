// Example Node.js Relayer Service
// This should run on your backend server, NOT in the browser

const express = require('express')
const { createWalletClient, createPublicClient, http } = require('viem')
const { privateKeyToAccount } = require('viem/accounts')
const { mantle } = require('viem/chains')
const gaslessAbi = require('../abi/gasless.json')

const app = express()
app.use(express.json())

// Environment variables (never expose these)
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY
const RPC_URL = process.env.RPC_URL || 'https://rpc.mantle.xyz'
const GASLESS_CONTRACT_ADDRESS = process.env.GASLESS_CONTRACT_ADDRESS
const PORT = process.env.PORT || 3001

// Initialize clients
const account = privateKeyToAccount(RELAYER_PRIVATE_KEY)
const publicClient = createPublicClient({
  chain: mantle,
  transport: http(RPC_URL)
})

const walletClient = createWalletClient({
  account,
  chain: mantle,
  transport: http(RPC_URL)
})

// Rate limiting and security middleware
const rateLimit = require('express-rate-limit')
const helmet = require('helmet')

app.use(helmet())
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}))

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS')
  next()
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Main relayer endpoint
app.post('/relay-transaction', async (req, res) => {
  try {
    const { metaTx, permitData, signature, userAddress } = req.body

    // 1. Validate request structure
    if (!metaTx || !permitData || !signature || !userAddress) {
      return res.status(400).json({ 
        error: 'Missing required fields: metaTx, permitData, signature, userAddress' 
      })
    }

    // 2. Security validations
    await validateRequest(metaTx, permitData, signature, userAddress)

    // 3. Check contract limits and balances
    await validateContractState(metaTx)

    // 4. Simulate transaction first
    const simulation = await publicClient.simulateContract({
      address: GASLESS_CONTRACT_ADDRESS,
      abi: gaslessAbi,
      functionName: 'executeMetaTransfer',
      args: [metaTx, permitData, signature],
      account
    })

    // 5. Execute the actual transaction
    const hash = await walletClient.writeContract({
      address: GASLESS_CONTRACT_ADDRESS,
      abi: gaslessAbi,
      functionName: 'executeMetaTransfer',
      args: [metaTx, permitData, signature],
      account
    })

    // 6. Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    // 7. Log transaction for monitoring
    console.log(`Transaction executed: ${hash}`, {
      userAddress,
      tokenAddress: metaTx.token,
      amount: metaTx.amount.toString(),
      gasUsed: receipt.gasUsed.toString()
    })

    res.json({
      success: true,
      hash,
      gasUsed: receipt.gasUsed.toString(),
      metaTxHash: signature
    })

  } catch (error) {
    console.error('Relayer error:', error)
    
    // Don't expose internal errors to client
    const userError = error.message.includes('revert') 
      ? error.message 
      : 'Transaction failed'
      
    res.status(500).json({ 
      success: false, 
      error: userError 
    })
  }
})

// Security validation functions
async function validateRequest(metaTx, permitData, signature, userAddress) {
  // 1. Validate addresses
  if (!isValidAddress(metaTx.owner) || !isValidAddress(metaTx.token) || !isValidAddress(metaTx.recipient)) {
    throw new Error('Invalid addresses in metaTx')
  }

  if (metaTx.owner.toLowerCase() !== userAddress.toLowerCase()) {
    throw new Error('MetaTx owner must match user address')
  }

  // 2. Validate amounts (prevent overflow, minimum amounts)
  if (metaTx.amount <= 0n || metaTx.fee < 0n) {
    throw new Error('Invalid amount or fee')
  }

  // 3. Validate deadline
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (metaTx.deadline <= now) {
    throw new Error('Transaction deadline expired')
  }

  // 4. Check if token is whitelisted
  const isWhitelisted = await publicClient.readContract({
    address: GASLESS_CONTRACT_ADDRESS,
    abi: gaslessAbi,
    functionName: 'isTokenWhitelisted',
    args: [metaTx.token]
  })

  if (!isWhitelisted) {
    throw new Error('Token not whitelisted')
  }

  // 5. Validate signature length
  if (signature.length !== 132) {
    throw new Error('Invalid signature format')
  }
}

async function validateContractState(metaTx) {
  // 1. Check contract is not paused
  const isPaused = await publicClient.readContract({
    address: GASLESS_CONTRACT_ADDRESS,
    abi: gaslessAbi,
    functionName: 'paused'
  })

  if (isPaused) {
    throw new Error('Contract is paused')
  }

  // 2. Check contract limits
  const [maxTransfer, maxFee] = await Promise.all([
    publicClient.readContract({
      address: GASLESS_CONTRACT_ADDRESS,
      abi: gaslessAbi,
      functionName: 'maxTransferAmount'
    }),
    publicClient.readContract({
      address: GASLESS_CONTRACT_ADDRESS,
      abi: gaslessAbi,
      functionName: 'maxFeeAmount'
    })
  ])

  if (metaTx.amount > maxTransfer) {
    throw new Error(`Transfer amount exceeds limit: ${maxTransfer}`)
  }

  if (metaTx.fee > maxFee) {
    throw new Error(`Fee amount exceeds limit: ${maxFee}`)
  }

  // 3. Check relayer has enough ETH for gas
  const relayerBalance = await publicClient.getBalance({
    address: account.address
  })

  const minBalance = parseEther('0.01') // 0.01 ETH minimum
  if (relayerBalance < minBalance) {
    throw new Error('Relayer insufficient gas balance')
  }
}

function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  process.exit(0)
})

app.listen(PORT, () => {
  console.log(`Relayer service running on port ${PORT}`)
  console.log(`Contract address: ${GASLESS_CONTRACT_ADDRESS}`)
  console.log(`Relayer address: ${account.address}`)
})

module.exports = app