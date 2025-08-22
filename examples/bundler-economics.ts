// How bundlers like Pimlico make money and get authorization

export class BundlerEconomics {
  
  // 1. HOW PIMLICO GETS PERMISSION
  static getAuthorization() {
    return {
      // Pimlico registers as bundler service
      bundlerAddress: '0x1234...', // Pimlico's wallet that submits transactions
      
      // You authorize Pimlico in your paymaster
      authorizedBundlers: [
        '0x1234...', // Pimlico bundler #1
        '0x5678...', // Pimlico bundler #2
      ],
      
      // Pimlico stakes ETH in EntryPoint contract
      stake: '32 ETH', // Shows they're legitimate
      unstakeDelay: '7 days' // Penalty for misbehavior
    }
  }

  // 2. HOW PIMLICO MAKES MONEY
  static bundlerRevenue() {
    return {
      // Method A: Gas markup
      gasMarkup: {
        userPays: '21000 gas * 20 gwei = 0.00042 ETH',
        actualCost: '21000 gas * 18 gwei = 0.000378 ETH',
        profit: '0.000042 ETH per transaction' // 10% markup
      },

      // Method B: Bundle MEV (Maximal Extractable Value)
      mevOpportunities: {
        arbitrage: 'Reorder transactions for profit',
        liquidations: 'Front-run liquidations',
        sandwichAttacks: 'Extract value from user trades'
      },

      // Method C: Service fees
      serviceFees: {
        apiUsage: '$0.01 per UserOperation',
        premiumFeatures: 'Faster execution, analytics',
        volumeDiscounts: 'Lower fees for high-volume users'
      }
    }
  }

  // 3. PIMLICO'S BUSINESS MODEL
  static pimlicoModel() {
    return {
      // They provide infrastructure
      services: [
        'Bundler network (submit transactions)',
        'Paymaster service (sponsor gas)',
        'APIs and SDKs',
        'Analytics and monitoring'
      ],

      // You pay them
      pricing: {
        bundlerFee: '10% gas markup',
        paymasterFee: '$0.01 per sponsored transaction',
        apiCalls: '$0.001 per call'
      },

      // They handle complexity
      value: [
        'No need to run your own bundler',
        'No need to manage gas prices',
        'No need to handle MEV',
        'Built-in redundancy and reliability'
      ]
    }
  }
}

// EXAMPLE: How permissions flow in practice
class PracticalExample {
  
  async demonstrateFlow() {
    // 1. YOU deploy paymaster and authorize Pimlico
    const paymaster = await deployContract('MyPaymaster', {
      authorizedBundlers: [
        PIMLICO_BUNDLER_1,
        PIMLICO_BUNDLER_2
      ]
    })

    // 2. USER creates smart account
    const smartAccount = await createSmartAccount({
      owner: userEOA, // User's MetaMask
      paymaster: paymaster.address
    })

    // 3. USER signs operation (gives permission for THIS specific action)
    const userOp = {
      sender: smartAccount.address,
      callData: transferUSDC(recipient, amount),
      signature: await userEOA.sign(operationHash)
    }

    // 4. SDK submits to Pimlico
    const response = await fetch('https://api.pimlico.io/v2/mantle/rpc', {
      method: 'POST',
      body: JSON.stringify({
        method: 'eth_sendUserOperation',
        params: [userOp, ENTRYPOINT_ADDRESS]
      })
    })

    // 5. Pimlico's bundler submits transaction
    const tx = await pimlicoWallet.sendTransaction({
      to: ENTRYPOINT_ADDRESS,
      data: encodeUserOperation(userOp),
      gasPrice: currentGasPrice + markup // Pimlico's profit
    })

    // 6. Your paymaster pays Pimlico back (with fee)
    // This happens automatically in the same transaction
  }
}

// SECURITY: What Pimlico CAN'T do
class SecurityLimits {
  static whatPimplicoCantDo() {
    return [
      "❌ Can't access user's private keys",
      "❌ Can't execute operations user didn't sign", 
      "❌ Can't modify the operation user signed",
      "❌ Can't steal funds from smart account",
      "❌ Can't operate without paymaster authorization"
    ]
  }

  static whatPimlicoCanDo() {
    return [
      "✅ Submit user-signed operations to blockchain",
      "✅ Reorder operations for MEV (if not prevented)",
      "✅ Choose gas price (within reasonable bounds)",
      "✅ Bundle multiple operations together",
      "✅ Refuse to submit operations (censorship)"
    ]
  }
}

// YOUR PAYMASTER CONTROLS THE ECONOMICS
class PaymasterControl {
  
  // You decide who pays what
  validatePaymasterUserOp(userOp: UserOperation) {
    // Option 1: You pay for everything
    if (userOp.callData.includes('transfer')) {
      return 'SPONSOR' // Your business covers gas
    }

    // Option 2: User pays in tokens
    if (hasTokenBalance(userOp.sender, MIN_BALANCE)) {
      return 'SPONSOR' // Deduct tokens in postOp
    }

    // Option 3: Subscription model
    if (hasActiveSubscription(userOp.sender)) {
      return 'SPONSOR' // User prepaid
    }

    throw new Error('Not sponsored')
  }

  // You control the fee structure
  postOp(actualGasCost: bigint) {
    const feePercentage = 3 // 3% fee
    const yourFee = (actualGasCost * BigInt(feePercentage)) / 100n
    
    // Deduct tokens from user
    USDC.transferFrom(
      userSmartAccount,
      address(this),
      yourFee // Your revenue 💰
    )
  }
}
```