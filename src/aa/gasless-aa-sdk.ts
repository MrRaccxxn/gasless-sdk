// Main Account Abstraction Gasless SDK

import {
  type Address,
  type Hex,
  type WalletClient,
  type PublicClient,
  encodeFunctionData,
  parseUnits,
  formatUnits,
  erc20Abi,
} from 'viem'

import type {
  AAGaslessConfig,
  AATransferParams,
  AATransactionResult,
  UserOperation,
  SmartAccountInfo,
  FeeQuote,
} from './types'
import type { TokenInfo } from '../types'

import { SmartAccount } from './smart-account'
import { BundlerClient } from './bundler-client'
import { PaymasterClient } from './paymaster-client'
import { getTokenInfo } from '../permit/eip2612'

// Default addresses for Mantle (update these with actual deployed addresses)
const DEFAULT_ENTRYPOINT =
  '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address
const DEFAULT_FACTORY = '0x9406Cc6185a346906296840746125a0E44976454' as Address

export class GaslessAASDK {
  private readonly config: AAGaslessConfig
  private readonly publicClient: PublicClient
  private readonly smartAccount: SmartAccount
  private readonly bundlerClient: BundlerClient
  private readonly paymasterClient: PaymasterClient
  private walletClient: WalletClient | null = null

  constructor(config: AAGaslessConfig, publicClient: PublicClient) {
    this.config = {
      ...config,
      entryPointAddress: config.entryPointAddress || DEFAULT_ENTRYPOINT,
      factoryAddress: config.factoryAddress || DEFAULT_FACTORY,
    }
    this.publicClient = publicClient

    // Initialize clients
    this.smartAccount = new SmartAccount(
      publicClient,
      this.config.factoryAddress!,
      this.config.entryPointAddress!
    )

    this.bundlerClient = new BundlerClient(
      this.config.bundlerUrl,
      this.config.apiKey
    )

    this.paymasterClient = new PaymasterClient(
      this.config.paymasterUrl,
      this.config.apiKey
    )
  }

  public setWalletClient(walletClient: WalletClient): void {
    this.walletClient = walletClient
  }

  public async connectWallet(): Promise<Address> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask or compatible wallet not found. Please install a wallet extension.')
    }

    const { createWalletClient, custom } = await import('viem')
    
    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      
      // Create wallet client from window.ethereum
      const walletClient = createWalletClient({
        transport: custom(window.ethereum),
      })

      // Get the connected account
      const [account] = await walletClient.getAddresses()
      if (!account) {
        throw new Error('No account found. Please connect your wallet.')
      }

      // Set the wallet client with the connected account
      this.walletClient = {
        ...walletClient,
        account: { address: account },
      } as WalletClient

      return account
    } catch (error) {
      throw new Error(
        `Failed to connect wallet: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  // Get or create smart account for user
  async getSmartAccountInfo(salt: bigint = 0n): Promise<SmartAccountInfo> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet client not set or no account available')
    }

    return await this.smartAccount.getSmartAccountInfo(
      this.walletClient.account.address,
      salt
    )
  }

  // Execute gasless token transfer
  async transferGasless(
    params: AATransferParams
  ): Promise<AATransactionResult> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet client not set or no account available')
    }

    try {
      // 1. Get smart account info
      const smartAccountInfo = await this.getSmartAccountInfo()

      // 2. Get token info for validation
      const tokenInfo = await this.getTokenInfo(params.token)

      // 3. Create transfer call data
      const transferCallData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [params.to, params.amount],
      })

      // 4. Create smart account execute call data
      const executeCallData = this.smartAccount.createExecuteCallData(
        params.token,
        0n, // No ETH value
        transferCallData
      )

      // 5. Build user operation
      const userOperation = await this.buildUserOperation(
        smartAccountInfo,
        executeCallData,
        params
      )

      // 6. Sign user operation
      const signature = await this.smartAccount.signUserOperation(
        this.walletClient,
        userOperation
      )

      const signedUserOp: UserOperation = {
        ...userOperation,
        signature,
      }

      // 7. Submit to bundler
      const userOpHash = await this.bundlerClient.sendUserOperation(
        signedUserOp,
        this.config.entryPointAddress!
      )

      // 8. Wait for receipt
      const receipt =
        await this.bundlerClient.waitForUserOperationReceipt(userOpHash)

      return {
        success: receipt.success,
        userOpHash,
        transactionHash: receipt.receipt.transactionHash,
        receipt: receipt.receipt,
        gasUsed: receipt.actualGasUsed,
        feeCharged: receipt.actualGasCost,
        feeToken: params.feeToken || params.token,
      }
    } catch (error) {
      throw new Error(
        `Gasless transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  // Get fee quote for transfer
  async getFeeQuote(params: AATransferParams): Promise<FeeQuote> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet client not set or no account available')
    }

    const smartAccountInfo = await this.getSmartAccountInfo()

    const transferCallData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [params.to, params.amount],
    })

    const executeCallData = this.smartAccount.createExecuteCallData(
      params.token,
      0n,
      transferCallData
    )

    // Build minimal user operation for estimation
    const tempUserOp = await this.buildUserOperation(
      smartAccountInfo,
      executeCallData,
      params,
      true // isEstimation
    )

    return await this.paymasterClient.getFeeQuote(
      tempUserOp,
      this.config.entryPointAddress!,
      params.feeToken || params.token
    )
  }

  // Check if user can afford transfer + fees
  async canAffordTransfer(params: AATransferParams): Promise<{
    canAfford: boolean
    requiredBalance: bigint
    currentBalance: bigint
    feeAmount: bigint
  }> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet client not set or no account available')
    }

    const smartAccountInfo = await this.getSmartAccountInfo()
    const feeQuote = await this.getFeeQuote(params)

    // Get user's token balance
    const balance = (await this.publicClient.readContract({
      address: params.token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [smartAccountInfo.address],
    })) as bigint

    const requiredBalance = params.amount + feeQuote.feeAmount

    return {
      canAfford: balance >= requiredBalance,
      requiredBalance,
      currentBalance: balance,
      feeAmount: feeQuote.feeAmount,
    }
  }

  // Get supported tokens for fee payment
  async getSupportedTokens(): Promise<
    Array<{
      address: Address
      symbol: string
      decimals: number
      exchangeRate: bigint
    }>
  > {
    const result = await this.paymasterClient.getSupportedTokens()
    return result.tokens
  }

  // Estimate gas for operation
  async estimateGas(params: AATransferParams): Promise<{
    totalGas: bigint
    gasPrice: bigint
    estimatedCost: bigint
  }> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet client not set or no account available')
    }

    const smartAccountInfo = await this.getSmartAccountInfo()

    const transferCallData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [params.to, params.amount],
    })

    const executeCallData = this.smartAccount.createExecuteCallData(
      params.token,
      0n,
      transferCallData
    )

    const tempUserOp = await this.buildUserOperation(
      smartAccountInfo,
      executeCallData,
      params,
      true
    )

    const gasEstimate = await this.bundlerClient.estimateUserOperationGas(
      tempUserOp,
      this.config.entryPointAddress!
    )

    const totalGas =
      BigInt(gasEstimate.callGasLimit) +
      BigInt(gasEstimate.verificationGasLimit) +
      BigInt(gasEstimate.preVerificationGas)

    const gasPrice = await this.publicClient.getGasPrice()
    const estimatedCost = totalGas * gasPrice

    return {
      totalGas,
      gasPrice,
      estimatedCost,
    }
  }

  // Get token information
  async getTokenInfo(tokenAddress: Address): Promise<TokenInfo> {
    const basicInfo = await getTokenInfo(tokenAddress, this.publicClient)
    return {
      address: tokenAddress,
      ...basicInfo,
      isWhitelisted: false, // Would need to implement whitelist check
    }
  }

  // Get configuration
  getConfig(): AAGaslessConfig {
    return { ...this.config }
  }

  // Build user operation from parameters
  private async buildUserOperation(
    smartAccountInfo: SmartAccountInfo,
    callData: Hex,
    params: AATransferParams,
    isEstimation: boolean = false
  ): Promise<Omit<UserOperation, 'signature'>> {
    // Get gas prices
    const gasPrice = await this.publicClient.getGasPrice()
    const maxFeePerGas = (gasPrice * 120n) / 100n // 20% buffer
    const maxPriorityFeePerGas = (gasPrice * 110n) / 100n // 10% buffer

    // Base user operation
    const baseUserOp: Omit<UserOperation, 'signature'> = {
      sender: smartAccountInfo.address,
      nonce: smartAccountInfo.nonce,
      callData,
      callGasLimit: 200000n, // Will be updated by estimation
      verificationGasLimit: 150000n, // Will be updated by estimation
      preVerificationGas: 21000n, // Will be updated by estimation
      maxFeePerGas,
      maxPriorityFeePerGas,
    }

    // For estimation, return basic user operation
    if (isEstimation) {
      return baseUserOp
    }

    // Get paymaster data for fee payment
    let paymasterResult

    if (params.feeToken && params.feeToken !== params.token) {
      // User wants to pay fees in different token
      paymasterResult = await this.paymasterClient.getTokenPaymasterData(
        baseUserOp,
        this.config.entryPointAddress!,
        params.feeToken
      )
    } else {
      // User pays fees in same token as transfer
      paymasterResult = await this.paymasterClient.getTokenPaymasterData(
        baseUserOp,
        this.config.entryPointAddress!,
        params.token
      )
    }

    // Update user operation with paymaster data and gas estimates
    return {
      ...baseUserOp,
      callGasLimit: paymasterResult.callGasLimit,
      verificationGasLimit: paymasterResult.verificationGasLimit,
      preVerificationGas: paymasterResult.preVerificationGas,
      paymaster: paymasterResult.paymaster,
      paymasterVerificationGasLimit:
        paymasterResult.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: paymasterResult.paymasterPostOpGasLimit,
      paymasterData: paymasterResult.paymasterData,
    }
  }

  // Format amounts for display
  formatAmount(amount: bigint, decimals: number): string {
    return formatUnits(amount, decimals)
  }

  // Parse amounts from strings
  parseAmount(amount: string, decimals: number): bigint {
    return parseUnits(amount, decimals)
  }
}

export * from './types'
export { SmartAccount } from './smart-account'
export { BundlerClient } from './bundler-client'
export { PaymasterClient } from './paymaster-client'
