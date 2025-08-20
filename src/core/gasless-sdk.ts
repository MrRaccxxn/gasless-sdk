import type { Address, PublicClient, WalletClient } from 'viem'
import type {
  GaslessConfig,
  GaslessTransferParams,
  TransactionResult,
  TokenInfo,
} from '../types'

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

  public async getTokenInfo(_tokenAddress: Address): Promise<TokenInfo> {
    // TODO: Implement token info retrieval
    throw new Error('Not implemented')
  }

  public async transferGasless(
    params: GaslessTransferParams
  ): Promise<TransactionResult> {
    // Mock implementation for testing
    // eslint-disable-next-line no-console
    console.log('Hello, this is a mock transfer from gasless-sdk!')
    // eslint-disable-next-line no-console
    console.log('Transfer params:', {
      token: params.token,
      to: params.to,
      amount: params.amount.toString(),
      userAddress: params.userAddress,
    })

    // Return mock success result
    return {
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
      success: true,
      gasUsed: 21000n,
    }
  }

  public async estimateGas(_params: GaslessTransferParams): Promise<bigint> {
    // TODO: Implement gas estimation
    throw new Error('Not implemented')
  }

  public async getUserNonce(_userAddress: Address): Promise<bigint> {
    // TODO: Implement nonce retrieval
    throw new Error('Not implemented')
  }

  public helloWorld(): string {
    return 'Hello World from Gasless SDK! 🚀'
  }

  public getConfig(): GaslessConfig {
    return { ...this.config }
  }
}
