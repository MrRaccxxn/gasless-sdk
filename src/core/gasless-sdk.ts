import {
  type Address,
  type PublicClient,
  type WalletClient,
  type Hex,
  createPublicClient,
  http,
} from 'viem'
import type {
  ChainPreset,
  ChainConfig,
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
      let relayerServiceUrl = config.relayerServiceUrl ?? config.localRelayerUrl ?? chainConfig.relayerServiceUrl
      
      const result: ResolvedConfig = {
        chainId: config.chainId ?? chainConfig.chainId,
        rpcUrl: config.rpcUrl ?? chainConfig.rpcUrl,
        gaslessRelayerAddress: config.gaslessRelayerAddress ?? chainConfig.gaslessRelayerAddress,
        relayerServiceUrl,
        environment,
      }
      return result
    }

    if (!config.chainId || !config.rpcUrl || !config.gaslessRelayerAddress) {
      throw new Error('When not using a preset, chainId, rpcUrl, and gaslessRelayerAddress are required')
    }

    const result: ResolvedConfig = {
      chainId: config.chainId,
      rpcUrl: config.rpcUrl,
      gaslessRelayerAddress: config.gaslessRelayerAddress,
      relayerServiceUrl: config.relayerServiceUrl ?? config.localRelayerUrl ?? '',
      environment,
    }
    return result
  }

  public setWalletClient(walletClient: WalletClient): void {
    this._walletClient = walletClient
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
      this._walletClient = {
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

  public async transfer(params: SimpleTransferParams): Promise<TransactionResult> {
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

    const userAddress = this._walletClient.account.address
    const deadline =
      params.deadline || BigInt(Math.floor(Date.now() / 1000) + 3600)
    const fee = params.fee || 0n

    const [userNonce, tokenNonce, tokenInfo] = await Promise.all([
      this.getUserNonce(userAddress),
      getTokenNonce(params.token, userAddress, this._publicClient),
      getTokenInfo(params.token, this._publicClient),
    ])

    const metaTx: MetaTransfer = {
      owner: userAddress,
      token: params.token,
      recipient: params.to,
      amount: params.amount,
      fee,
      nonce: userNonce,
      deadline,
    }

    const permitRequest: EIP2612Permit = {
      owner: userAddress,
      spender: this.config.gaslessRelayerAddress,
      value: params.amount + fee,
      nonce: tokenNonce,
      deadline,
    }

    const permitDomain = createPermitDomain(
      params.token,
      this.config.chainId,
      tokenInfo.name
    )

    const relayerDomain: EIP712Domain = {
      name: 'GaslessRelayer',
      version: '1',
      chainId: this.config.chainId,
      verifyingContract: this.config.gaslessRelayerAddress,
    }

    const [permitData, metaTxHash] = await Promise.all([
      signPermit(this._walletClient, permitDomain, permitRequest),
      Promise.resolve(createMetaTransferHash(relayerDomain, metaTx)),
    ])

    const metaTxSignature = await this._walletClient.signMessage({
      account: this._walletClient.account,
      message: { raw: metaTxHash },
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

      const response = await fetch(
        `${this.config.relayerServiceUrl}/relay-transaction`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            metaTx: {
              ...metaTx,
              amount: metaTx.amount.toString(),
              fee: metaTx.fee.toString(),
              nonce: metaTx.nonce.toString(),
              deadline: metaTx.deadline.toString(),
            },
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
