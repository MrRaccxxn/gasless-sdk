import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type WalletClient,
  type PublicClient,
} from 'viem'
import { GaslessSDK } from '../core/gasless-sdk'
import { GaslessAASDK } from '../aa/gasless-aa-sdk'
import type {
  ChainPreset,
  GaslessConfig,
  TokenInfo,
  Environment,
} from '../types'
import type { AAGaslessConfig, AATransferParams } from '../aa/types'

export interface SimpleConfig {
  chainPreset?: ChainPreset
  environment?: Environment
  rpcUrl?: string
  chainId?: number
  relayerAddress?: Address
  relayerUrl?: string
  localRelayerUrl?: string
  apiKey?: string
  // AA-specific (optional) - disabled by default for simplicity
  bundlerUrl?: string
  paymasterUrl?: string
  useAccountAbstraction?: boolean
}

export interface SimpleTransferParams {
  token: Address
  to: Address
  amount: bigint
  feeToken?: Address // for AA only
}

export interface SimpleResult {
  success: boolean
  hash: string
  gasUsed?: bigint
}

export class Gasless {
  private publicClient: PublicClient
  private coreSDK?: GaslessSDK
  private aaSDK?: GaslessAASDK
  private config: SimpleConfig

  constructor(config: SimpleConfig) {
    this.config = config
    this.publicClient = createPublicClient({
      transport: http(config.rpcUrl),
    })

    // Default to core SDK (your original GaslessRelayer contract) for simplicity
    if (config.useAccountAbstraction === true) {
      this.initializeAASDK()
    } else {
      this.initializeCoreSDK()
    }
  }

  private initializeCoreSDK(): void {
    const gaslessConfig: GaslessConfig = {
      ...(this.config.chainPreset && { chainPreset: this.config.chainPreset }),
      ...(this.config.environment && { environment: this.config.environment }),
      ...(this.config.chainId && { chainId: this.config.chainId }),
      ...(this.config.rpcUrl && { rpcUrl: this.config.rpcUrl }),
      ...(this.config.relayerAddress && {
        gaslessRelayerAddress: this.config.relayerAddress,
      }),
      ...(this.config.relayerUrl && {
        relayerServiceUrl: this.config.relayerUrl,
      }),
      ...(this.config.localRelayerUrl && {
        localRelayerUrl: this.config.localRelayerUrl,
      }),
      ...(this.config.apiKey && { apiKey: this.config.apiKey }),
    }

    this.coreSDK = new GaslessSDK(gaslessConfig)
  }

  private initializeAASDK(): void {
    if (!this.config.bundlerUrl || !this.config.paymasterUrl) {
      throw new Error(
        'bundlerUrl and paymasterUrl required for Account Abstraction'
      )
    }

    const aaConfig: AAGaslessConfig = {
      chainId: this.config.chainId!,
      rpcUrl: this.config.rpcUrl!,
      bundlerUrl: this.config.bundlerUrl!,
      paymasterUrl: this.config.paymasterUrl!,
      ...(this.config.apiKey && { apiKey: this.config.apiKey }),
    }

    this.aaSDK = new GaslessAASDK(aaConfig, this.publicClient)
  }

  async transfer(params: SimpleTransferParams): Promise<SimpleResult> {
    if (this.config.useAccountAbstraction) {
      return this.transferAA(params)
    } else {
      return this.transferCore(params)
    }
  }

  private async transferCore(
    params: SimpleTransferParams
  ): Promise<SimpleResult> {
    if (!this.coreSDK) throw new Error('Core SDK not initialized')

    if (!this.coreSDK) {
      throw new Error(
        'Wallet client required for permit signing. Call setWalletClient() first.'
      )
    }

    const result = await this.coreSDK.transfer({
      token: params.token,
      to: params.to,
      amount: params.amount,
    })

    return {
      success: result.success,
      hash: result.hash,
      ...(result.gasUsed && { gasUsed: result.gasUsed }),
    }
  }

  private async transferAA(
    params: SimpleTransferParams
  ): Promise<SimpleResult> {
    if (!this.aaSDK) throw new Error('AA SDK not initialized')

    if (!this.aaSDK) {
      throw new Error(
        'Wallet client required for AA transfers. Call setWalletClient() first.'
      )
    }

    const aaParams: AATransferParams = {
      token: params.token,
      to: params.to,
      amount: params.amount,
      ...(params.feeToken && { feeToken: params.feeToken }),
    }

    const result = await this.aaSDK.transferGasless(aaParams)

    return {
      success: result.success,
      hash: result.transactionHash || '',
      ...(result.gasUsed && { gasUsed: result.gasUsed }),
    }
  }

  // Set wallet client for signing permits
  public setWalletClient(walletClient: WalletClient): void {
    if (this.coreSDK) {
      this.coreSDK.setWalletClient(walletClient)
    }
    if (this.aaSDK) {
      this.aaSDK.setWalletClient(walletClient)
    }
  }

  // Connect to browser wallet (MetaMask, etc.)
  public async connectWallet(): Promise<Address> {
    if (this.coreSDK) {
      return await this.coreSDK.connectWallet()
    }
    if (this.aaSDK) {
      return await this.aaSDK.connectWallet()
    }
    throw new Error('No SDK initialized')
  }

  // Utility methods - simplified API
  async getBalance(token: Address, account: Address): Promise<bigint> {
    return (await this.publicClient.readContract({
      address: token,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ],
      functionName: 'balanceOf',
      args: [account],
    })) as bigint
  }

  async getTokenInfo(token: Address): Promise<TokenInfo> {
    if (this.coreSDK) {
      return await this.coreSDK.getTokenInfo(token)
    }
    if (this.aaSDK) {
      return await this.aaSDK.getTokenInfo(token)
    }
    throw new Error('No SDK initialized')
  }

  async estimateGas(params: SimpleTransferParams): Promise<bigint> {
    if (this.config.useAccountAbstraction && this.aaSDK) {
      const aaParams: AATransferParams = {
        token: params.token,
        to: params.to,
        amount: params.amount,
        ...(params.feeToken && { feeToken: params.feeToken }),
      }
      const estimate = await this.aaSDK.estimateGas(aaParams)
      return estimate.totalGas
    } else if (this.coreSDK) {
      return await this.coreSDK.estimateGas({
        token: params.token,
        to: params.to,
        amount: params.amount,
      })
    }
    throw new Error('No SDK initialized')
  }

  // Static helper for one-line usage
  static async quickTransfer(
    config: SimpleConfig,
    params: SimpleTransferParams
  ): Promise<SimpleResult> {
    const gasless = new Gasless(config)
    return await gasless.transfer(params)
  }
}
