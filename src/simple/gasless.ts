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
import type { GaslessConfig, TokenInfo } from '../types'
import type { AAGaslessConfig, AATransferParams } from '../aa/types'

export interface SimpleConfig {
  rpcUrl: string
  chainId: number
  relayerAddress: Address
  privateKey?: Hex
  relayerUrl?: string
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
  from?: Hex // private key or will use wallet client
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
      chainId: this.config.chainId,
      rpcUrl: this.config.rpcUrl,
      gaslessRelayerAddress: this.config.relayerAddress,
      ...(this.config.privateKey && { relayerPrivateKey: this.config.privateKey }),
      ...(this.config.relayerUrl && { relayerServiceUrl: this.config.relayerUrl }),
      ...(this.config.apiKey && { apiKey: this.config.apiKey }),
    }

    this.coreSDK = new GaslessSDK(gaslessConfig, this.publicClient)
  }

  private initializeAASDK(): void {
    if (!this.config.bundlerUrl || !this.config.paymasterUrl) {
      throw new Error(
        'bundlerUrl and paymasterUrl required for Account Abstraction'
      )
    }

    const aaConfig: AAGaslessConfig = {
      chainId: this.config.chainId,
      rpcUrl: this.config.rpcUrl,
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

    let walletClient: WalletClient

    if (params.from) {
      walletClient = createWalletClient({
        transport: http(this.config.rpcUrl),
        account: params.from,
      })
    } else {
      throw new Error('Private key required for core transfers')
    }

    this.coreSDK.setWalletClient(walletClient)

    const result = await this.coreSDK.transferGasless({
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

    let walletClient: WalletClient

    if (params.from) {
      walletClient = createWalletClient({
        transport: http(this.config.rpcUrl),
        account: params.from,
      })
    } else {
      throw new Error('Private key required for AA transfers')
    }

    this.aaSDK.setWalletClient(walletClient)

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
