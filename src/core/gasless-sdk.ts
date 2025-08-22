import {
  type Address,
  type PublicClient,
  type WalletClient,
  type Hex,
  createPublicClient,
  http,
} from 'viem'
import type {
  GaslessConfig,
  SimpleTransferParams,
  GaslessTransferParams,
  TransactionResult,
  TokenInfo,
  MetaTransfer,
  PermitData,
  EIP712Domain,
  EIP2612Permit,
  ContractLimits,
  Environment,
} from '../types'
import { createMetaTransferHash } from '../eip712'
import {
  signPermit,
  createPermitDomain,
  getTokenInfo,
  getTokenNonce,
  getTokenVersion,
} from '../permit/eip2612'
import { getChainConfig } from '../config/chains'
import gaslessAbi from '../../abi/gasless.json'

interface ResolvedConfig {
  chainId: number
  rpcUrl: string
  gaslessRelayerAddress: Address
  relayerServiceUrl: string
  environment: Environment
}

export class GaslessSDK {
  private readonly config: ResolvedConfig
  private readonly _publicClient: PublicClient
  private _walletClient: WalletClient | null = null

  constructor(config: GaslessConfig) {
    const resolvedConfig = this.resolveConfig(config)
    this.config = resolvedConfig
    this._publicClient = createPublicClient({
      transport: http(resolvedConfig.rpcUrl),
    })
  }

  private resolveConfig(config: GaslessConfig): ResolvedConfig {
    const environment = config.environment ?? 'production'

    if (config.chainPreset) {
      const chainConfig = getChainConfig(config.chainPreset, environment)

      // Handle custom local URL override
      let relayerServiceUrl =
        config.relayerServiceUrl ??
        config.localRelayerUrl ??
        chainConfig.relayerServiceUrl

      const result: ResolvedConfig = {
        chainId: config.chainId ?? chainConfig.chainId,
        rpcUrl: config.rpcUrl ?? chainConfig.rpcUrl,
        gaslessRelayerAddress:
          config.gaslessRelayerAddress ?? chainConfig.gaslessRelayerAddress,
        relayerServiceUrl,
        environment,
      }
      return result
    }

    if (!config.chainId || !config.rpcUrl || !config.gaslessRelayerAddress) {
      throw new Error(
        'When not using a preset, chainId, rpcUrl, and gaslessRelayerAddress are required'
      )
    }

    const result: ResolvedConfig = {
      chainId: config.chainId,
      rpcUrl: config.rpcUrl,
      gaslessRelayerAddress: config.gaslessRelayerAddress,
      relayerServiceUrl:
        config.relayerServiceUrl ?? config.localRelayerUrl ?? '',
      environment,
    }
    return result
  }

  public setWalletClient(walletClient: WalletClient): void {
    this._walletClient = walletClient
  }

  public async connectWallet(): Promise<Address> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error(
        'MetaMask or compatible wallet not found. Please install a wallet extension.'
      )
    }

    const { createWalletClient, custom } = await import('viem')

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      // Create wallet client from window.ethereum
      const walletClient = createWalletClient({
        transport: custom(window.ethereum),
      })

      // Get the currently selected account from MetaMask directly
      const currentAccount = accounts[0] as Address
      if (!currentAccount) {
        throw new Error('No account found. Please connect your wallet.')
      }

      // Set the wallet client with the currently selected account
      this._walletClient = {
        ...walletClient,
        account: { address: currentAccount },
      } as WalletClient

      return currentAccount
    } catch (error) {
      throw new Error(
        `Failed to connect wallet: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  public async transfer(
    params: SimpleTransferParams
  ): Promise<TransactionResult> {
    return this.transferGasless({
      token: params.token,
      to: params.to,
      amount: params.amount,
    })
  }

  public async getTokenInfo(tokenAddress: Address): Promise<TokenInfo> {
    const [tokenData, isWhitelisted] = await Promise.all([
      getTokenInfo(tokenAddress, this._publicClient),
      this.isTokenWhitelisted(tokenAddress),
    ])

    return {
      address: tokenAddress,
      ...tokenData,
      isWhitelisted,
    }
  }

  public async transferGasless(
    params: GaslessTransferParams
  ): Promise<TransactionResult> {
    if (!this._walletClient || !this._walletClient.account) {
      throw new Error('Wallet client not set or no account available')
    }

    // Get the current account from MetaMask to ensure we have the right one
    const currentAccounts = await window.ethereum.request({
      method: 'eth_accounts',
    })
    const currentAccount = currentAccounts[0] as Address

    // Update the wallet client account if it has changed
    if (
      currentAccount &&
      currentAccount !== this._walletClient.account.address
    ) {
      console.log(
        `🔄 Account changed from ${this._walletClient.account.address} to ${currentAccount}`
      )
      this._walletClient = {
        ...this._walletClient,
        account: { address: currentAccount },
      } as WalletClient
    }

    const userAddress = this._walletClient.account.address
    // Use a longer deadline window to avoid timing issues
    const deadline =
      params.deadline || BigInt(Math.floor(Date.now() / 1000) + 7200) // 2 hours instead of 1
    const fee = params.fee || 0n

    const [userNonce, tokenNonce, tokenInfo, tokenVersion] = await Promise.all([
      this.getUserNonce(userAddress),
      getTokenNonce(params.token, userAddress, this._publicClient),
      getTokenInfo(params.token, this._publicClient),
      getTokenVersion(params.token, this._publicClient),
    ])

    const metaTx: MetaTransfer = {
      owner: userAddress,
      token: params.token,
      recipient: params.to,
      amount: params.amount,
      fee,
      deadline,
      nonce: userNonce,
    }

    const permitRequest: EIP2612Permit = {
      owner: userAddress,
      spender: this.config.gaslessRelayerAddress,
      value: params.amount + fee,
      nonce: tokenNonce,
      deadline,
    }

    // Debug logging for permit domain
    if (this.config.environment !== 'production') {
      console.log('🔍 Permit Domain Debug:', {
        token: params.token,
        chainId: this.config.chainId,
        name: tokenInfo.name,
        version: tokenVersion,
      })
    }

    const permitDomain = createPermitDomain(
      params.token,
      this.config.chainId,
      tokenInfo.name,
      tokenVersion // Use dynamically detected version
    )

    const relayerDomain: EIP712Domain = {
      name: 'GaslessRelayer',
      version: '1',
      chainId: this.config.chainId,
      verifyingContract: this.config.gaslessRelayerAddress,
    }

    const [permitData] = await Promise.all([
      signPermit(this._walletClient, permitDomain, permitRequest),
    ])

    // Check wallet chain ID vs SDK config
    const walletChainId = await this._walletClient.getChainId()

    // Debug logging for EIP-712 data
    console.log('🔍 SDK EIP-712 Debug - SIGNING VALUES:', {
      domain: {
        name: relayerDomain.name,
        version: relayerDomain.version,
        chainId: walletChainId,
        verifyingContract: relayerDomain.verifyingContract,
      },
      signingMessage: {
        owner: metaTx.owner,
        token: metaTx.token,
        recipient: metaTx.recipient,
        amount: metaTx.amount,
        fee: metaTx.fee,
        deadline: metaTx.deadline,
        nonce: metaTx.nonce,
      },
      messageTypes: {
        amount: typeof metaTx.amount,
        fee: typeof metaTx.fee,
        deadline: typeof metaTx.deadline,
        nonce: typeof metaTx.nonce,
      },
      userAddress: this._walletClient.account.address,
      walletChainId,
      configChainId: this.config.chainId,
      chainIdMatch: walletChainId === this.config.chainId,
    })

    if (walletChainId !== this.config.chainId) {
      console.error(
        '❌ CHAIN ID MISMATCH! Wallet is on chain',
        walletChainId,
        'but SDK expects',
        this.config.chainId
      )
    }

    const metaTxSignature = await this._walletClient.signTypedData({
      account: this._walletClient.account,
      domain: {
        name: relayerDomain.name,
        version: relayerDomain.version,
        chainId: 5003, // Force to exact value the contract expects
        verifyingContract: relayerDomain.verifyingContract,
      },
      types: {
        MetaTransfer: [
          { name: 'owner', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'recipient', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'fee', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
        ],
      },
      primaryType: 'MetaTransfer',
      message: {
        owner: metaTx.owner,
        token: metaTx.token,
        recipient: metaTx.recipient,
        amount: metaTx.amount,
        fee: metaTx.fee,
        deadline: metaTx.deadline,
        nonce: metaTx.nonce,
      },
    })

    // Log environment for debugging
    if (this.config.environment !== 'production') {
      console.log(`🔧 Gasless SDK running in ${this.config.environment} mode`)
      console.log(`📡 Relayer URL: ${this.config.relayerServiceUrl}`)
    }

    // Always use backend service - this is the secure way
    if (this.config.relayerServiceUrl && this.config.relayerServiceUrl !== '') {
      return this.executeTransferViaService(metaTx, permitData, metaTxSignature)
    }

    throw new Error(
      `No relayer service URL configured for ${this.config.environment} environment. Please ensure your backend relayer service is running.`
    )
  }

  public async estimateGas(_params: GaslessTransferParams): Promise<bigint> {
    if (!this._walletClient || !this._walletClient.account) {
      throw new Error('Wallet client not set or no account available')
    }

    // For now, return a fixed gas estimate
    // In a real implementation, this would simulate the transaction
    return 200000n
  }

  public async getUserNonce(userAddress: Address): Promise<bigint> {
    try {
      const result = await this._publicClient.readContract({
        address: this.config.gaslessRelayerAddress,
        abi: gaslessAbi,
        functionName: 'getNonce',
        args: [userAddress],
      })

      return result as bigint
    } catch (error) {
      throw new Error(
        `Failed to get user nonce: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  public async isTokenWhitelisted(tokenAddress: Address): Promise<boolean> {
    try {
      const result = await this._publicClient.readContract({
        address: this.config.gaslessRelayerAddress,
        abi: gaslessAbi,
        functionName: 'isTokenWhitelisted',
        args: [tokenAddress],
      })

      return result as boolean
    } catch (error) {
      throw new Error(
        `Failed to check token whitelist: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  public async getContractLimits(): Promise<ContractLimits> {
    try {
      const [maxTransferAmount, maxFeeAmount] = await Promise.all([
        this._publicClient.readContract({
          address: this.config.gaslessRelayerAddress,
          abi: gaslessAbi,
          functionName: 'maxTransferAmount',
        }),
        this._publicClient.readContract({
          address: this.config.gaslessRelayerAddress,
          abi: gaslessAbi,
          functionName: 'maxFeeAmount',
        }),
      ])

      return {
        maxTransferAmount: maxTransferAmount as bigint,
        maxFeeAmount: maxFeeAmount as bigint,
      }
    } catch (error) {
      throw new Error(
        `Failed to get contract limits: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  public async isContractPaused(): Promise<boolean> {
    try {
      const result = await this._publicClient.readContract({
        address: this.config.gaslessRelayerAddress,
        abi: gaslessAbi,
        functionName: 'paused',
      })

      return result as boolean
    } catch (error) {
      throw new Error(
        `Failed to check contract pause status: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  public helloWorld(): string {
    return 'Hello World from Gasless SDK! 🚀'
  }

  private async executeTransferViaService(
    metaTx: MetaTransfer,
    permitData: PermitData,
    signature: Hex
  ): Promise<TransactionResult> {
    if (!this.config.relayerServiceUrl) {
      throw new Error('Relayer service URL not configured')
    }

    if (!this._walletClient?.account) {
      throw new Error('Wallet client not available')
    }

    try {
      const userAddress = this._walletClient.account.address
      const timestamp = Math.floor(Date.now() / 1000)

      // Create user signature for additional security
      const authMessage = `Gasless transfer request\nTimestamp: ${timestamp}\nUser: ${userAddress}`
      const userSignature = await this._walletClient.signMessage({
        account: this._walletClient.account,
        message: authMessage,
      })

      const payloadMetaTx = {
        ...metaTx,
        amount: metaTx.amount.toString(),
        fee: metaTx.fee.toString(),
        nonce: metaTx.nonce.toString(),
        deadline: metaTx.deadline.toString(),
      }

      console.log('🔍 SDK EIP-712 Debug - SENDING TO BACKEND:', {
        payloadMetaTx,
        originalMetaTx: metaTx,
        conversions: {
          amount: `${metaTx.amount} -> "${metaTx.amount.toString()}"`,
          fee: `${metaTx.fee} -> "${metaTx.fee.toString()}"`,
          nonce: `${metaTx.nonce} -> "${metaTx.nonce.toString()}"`,
          deadline: `${metaTx.deadline} -> "${metaTx.deadline.toString()}"`,
        },
      })

      const response = await fetch(
        `${this.config.relayerServiceUrl}/relay-transaction`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            metaTx: payloadMetaTx,
            permitData: {
              ...permitData,
              value: permitData.value.toString(),
              deadline: permitData.deadline.toString(),
            },
            signature,
            chainId: this.config.chainId,
            userAddress,
            timestamp,
            userSignature,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Relayer service request failed')
      }

      const result = await response.json()
      return {
        hash: result.hash,
        success: result.success,
        ...(result.gasUsed && { gasUsed: BigInt(result.gasUsed) }),
        metaTxHash: result.metaTxHash,
      }
    } catch (error) {
      throw new Error(
        `Relayer service error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  public getConfig(): ResolvedConfig {
    return { ...this.config }
  }
}
