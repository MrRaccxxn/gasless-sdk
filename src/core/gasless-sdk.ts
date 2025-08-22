import {
  type Address,
  type PublicClient,
  type WalletClient,
  type Hex,
} from 'viem'
import type {
  GaslessConfig,
  GaslessTransferParams,
  TransactionResult,
  TokenInfo,
  MetaTransfer,
  PermitData,
  EIP712Domain,
  EIP2612Permit,
  ContractLimits,
} from '../types'
import { createMetaTransferHash } from '../eip712'
import {
  signPermit,
  createPermitDomain,
  getTokenInfo,
  getTokenNonce,
} from '../permit/eip2612'
import gaslessAbi from '../../abi/gasless.json'

export class GaslessSDK {
  private readonly config: GaslessConfig
  private readonly _publicClient: PublicClient
  private _walletClient: WalletClient | null = null

  constructor(config: GaslessConfig, publicClient: PublicClient) {
    this.config = config
    this._publicClient = publicClient
  }

  public setWalletClient(walletClient: WalletClient): void {
    this._walletClient = walletClient
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

    if (this.config.relayerPrivateKey) {
      return this.executeTransferDirectly(metaTx, permitData, metaTxSignature)
    }

    if (this.config.relayerServiceUrl) {
      return this.executeTransferViaService(metaTx, permitData, metaTxSignature)
    }

    throw new Error(
      'Either relayerPrivateKey or relayerServiceUrl must be provided'
    )
  }

  private async executeTransferDirectly(
    metaTx: MetaTransfer,
    permitData: PermitData,
    signature: Hex
  ): Promise<TransactionResult> {
    if (!this.config.relayerPrivateKey) {
      throw new Error('Relayer private key required for direct execution')
    }

    try {
      await this._publicClient.simulateContract({
        address: this.config.gaslessRelayerAddress,
        abi: gaslessAbi,
        functionName: 'executeMetaTransfer',
        args: [metaTx, permitData, signature],
      })

      return {
        hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        success: true,
        metaTxHash: signature,
      }
    } catch (error) {
      throw new Error(
        `Transaction simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
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
            ...(this.config.apiKey && { 'X-API-Key': this.config.apiKey }),
          },
          body: JSON.stringify({
            metaTx,
            permitData,
            signature,
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

  public getConfig(): GaslessConfig {
    return { ...this.config }
  }
}
