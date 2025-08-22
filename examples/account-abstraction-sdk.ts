// Account Abstraction approach - No private keys needed!
// Users keep their EOA wallets, but transactions go through smart accounts

import { 
  createSmartAccountClient, 
  ENTRYPOINT_ADDRESS_V07,
  createPimlicoPaymasterClient,
  createPimlicoBundlerClient
} from 'permissionless'
import { signerToSimpleSmartAccount } from 'permissionless/accounts'
import { createPublicClient, http, encodeFunctionData } from 'viem'
import { mantle } from 'viem/chains'

export class AccountAbstractionGaslessSDK {
  private bundlerClient: any
  private paymasterClient: any
  private publicClient: any

  constructor(config: {
    chainId: number
    bundlerUrl: string
    paymasterUrl: string
    rpcUrl: string
  }) {
    this.publicClient = createPublicClient({
      transport: http(config.rpcUrl)
    })

    // Bundler handles transaction execution
    this.bundlerClient = createPimlicoBundlerClient({
      transport: http(config.bundlerUrl),
      entryPoint: ENTRYPOINT_ADDRESS_V07
    })

    // Paymaster sponsors gas fees
    this.paymasterClient = createPimlicoPaymasterClient({
      transport: http(config.paymasterUrl),
      entryPoint: ENTRYPOINT_ADDRESS_V07
    })
  }

  async transferGasless(
    userWallet: any, // User's EOA wallet (MetaMask, etc.)
    params: {
      token: string
      to: string
      amount: bigint
    }
  ) {
    // 1. Create smart account from user's EOA
    const smartAccount = await signerToSimpleSmartAccount(this.publicClient, {
      signer: userWallet,
      entryPoint: ENTRYPOINT_ADDRESS_V07
    })

    // 2. Create smart account client
    const smartAccountClient = createSmartAccountClient({
      account: smartAccount,
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      chain: mantle,
      bundlerTransport: http(this.bundlerClient.transport.url!),
      middleware: {
        // Sponsor gas fees
        sponsorUserOperation: this.paymasterClient.sponsorUserOperation,
        gasPrice: async () => {
          return (await this.bundlerClient.getUserOperationGasPrice()).fast
        }
      }
    })

    // 3. Execute gasless transfer
    const userOpHash = await smartAccountClient.sendUserOperation({
      calls: [{
        to: params.token as `0x${string}`,
        data: encodeFunctionData({
          abi: [
            {
              name: 'transfer',
              type: 'function',
              inputs: [
                { name: 'to', type: 'address' },
                { name: 'amount', type: 'uint256' }
              ]
            }
          ],
          functionName: 'transfer',
          args: [params.to, params.amount]
        })
      }]
    })

    // 4. Wait for transaction
    const receipt = await this.bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash
    })

    return {
      success: true,
      hash: receipt.receipt.transactionHash,
      userOpHash
    }
  }
}

// Usage example
const aaSDK = new AccountAbstractionGaslessSDK({
  chainId: 5000,
  bundlerUrl: 'https://api.pimlico.io/v2/mantle/rpc?apikey=YOUR_KEY',
  paymasterUrl: 'https://api.pimlico.io/v2/mantle/rpc?apikey=YOUR_KEY',
  rpcUrl: 'https://rpc.mantle.xyz'
})

// User keeps their EOA wallet, but gets gasless transactions!
await aaSDK.transferGasless(userWallet, {
  token: '0x...',
  to: '0x...',
  amount: 1000000n
})