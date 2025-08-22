// Bundler client for submitting UserOperations

import type { Address, Hash, Hex } from 'viem'
import type { UserOperation, AATransactionResult } from './types'

export interface BundlerResponse<T = any> {
  jsonrpc: string
  id: number
  result?: T
  error?: {
    code: number
    message: string
    data?: any
  }
}

export interface GasEstimate {
  preVerificationGas: Hex
  verificationGasLimit: Hex
  callGasLimit: Hex
  paymasterVerificationGasLimit?: Hex
  paymasterPostOpGasLimit?: Hex
}

export interface UserOperationReceipt {
  userOpHash: Hash
  entryPoint: Address
  sender: Address
  nonce: bigint
  paymaster?: Address
  actualGasCost: bigint
  actualGasUsed: bigint
  success: boolean
  logs: any[]
  receipt: {
    transactionHash: Hash
    transactionIndex: number
    blockHash: Hash
    blockNumber: bigint
    gasUsed: bigint
    status: 'success' | 'reverted'
  }
}

export class BundlerClient {
  private bundlerUrl: string
  private apiKey?: string
  private requestId: number = 1

  constructor(bundlerUrl: string, apiKey?: string) {
    this.bundlerUrl = bundlerUrl
    if (apiKey !== undefined) {
      this.apiKey = apiKey
    }
  }

  async sendUserOperation(
    userOperation: UserOperation,
    entryPoint: Address
  ): Promise<Hash> {
    const response = await this.request<Hash>('eth_sendUserOperation', [
      this.formatUserOperation(userOperation),
      entryPoint,
    ])

    return response
  }

  async estimateUserOperationGas(
    userOperation: Omit<UserOperation, 'signature'>,
    entryPoint: Address
  ): Promise<GasEstimate> {
    const response = await this.request<GasEstimate>(
      'eth_estimateUserOperationGas',
      [this.formatUserOperation(userOperation), entryPoint]
    )

    return response
  }

  async getUserOperationByHash(
    userOpHash: Hash
  ): Promise<UserOperation | null> {
    const response = await this.request<UserOperation | null>(
      'eth_getUserOperationByHash',
      [userOpHash]
    )

    return response
  }

  async getUserOperationReceipt(
    userOpHash: Hash
  ): Promise<UserOperationReceipt | null> {
    const response = await this.request<UserOperationReceipt | null>(
      'eth_getUserOperationReceipt',
      [userOpHash]
    )

    return response
  }

  async waitForUserOperationReceipt(
    userOpHash: Hash,
    timeout: number = 60000
  ): Promise<UserOperationReceipt> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const receipt = await this.getUserOperationReceipt(userOpHash)

      if (receipt) {
        return receipt
      }

      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    throw new Error(`UserOperation receipt not found after ${timeout}ms`)
  }

  async getSupportedEntryPoints(): Promise<Address[]> {
    const response = await this.request<Address[]>(
      'eth_supportedEntryPoints',
      []
    )
    return response
  }

  async getChainId(): Promise<number> {
    const response = await this.request<Hex>('eth_chainId', [])
    return parseInt(response, 16)
  }

  private async request<T>(method: string, params: any[]): Promise<T> {
    const requestBody = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.requestId++,
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Add API key to headers (Pimlico format)
    if (this.bundlerUrl.includes('pimlico.io')) {
      // For Pimlico, API key is in URL
      if (!this.bundlerUrl.includes('apikey=')) {
        throw new Error('Pimlico bundler URL must include apikey parameter')
      }
    } else if (this.apiKey) {
      // For other bundlers, use header
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    try {
      const response = await fetch(this.bundlerUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: BundlerResponse<T> = await response.json()

      if (data.error) {
        throw new Error(
          `Bundler error ${data.error.code}: ${data.error.message}`
        )
      }

      if (data.result === undefined) {
        throw new Error('Invalid response from bundler')
      }

      return data.result
    } catch (error) {
      throw new Error(
        `Bundler request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private formatUserOperation(userOp: Partial<UserOperation>): any {
    return {
      sender: userOp.sender,
      nonce: userOp.nonce ? `0x${userOp.nonce.toString(16)}` : '0x0',
      callData: userOp.callData || '0x',
      callGasLimit: userOp.callGasLimit
        ? `0x${userOp.callGasLimit.toString(16)}`
        : '0x0',
      verificationGasLimit: userOp.verificationGasLimit
        ? `0x${userOp.verificationGasLimit.toString(16)}`
        : '0x0',
      preVerificationGas: userOp.preVerificationGas
        ? `0x${userOp.preVerificationGas.toString(16)}`
        : '0x0',
      maxFeePerGas: userOp.maxFeePerGas
        ? `0x${userOp.maxFeePerGas.toString(16)}`
        : '0x0',
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas
        ? `0x${userOp.maxPriorityFeePerGas.toString(16)}`
        : '0x0',
      paymaster: userOp.paymaster || undefined,
      paymasterVerificationGasLimit: userOp.paymasterVerificationGasLimit
        ? `0x${userOp.paymasterVerificationGasLimit.toString(16)}`
        : undefined,
      paymasterPostOpGasLimit: userOp.paymasterPostOpGasLimit
        ? `0x${userOp.paymasterPostOpGasLimit.toString(16)}`
        : undefined,
      paymasterData: userOp.paymasterData || undefined,
      signature: userOp.signature || '0x',
    }
  }
}

export class BundlerError extends Error {
  constructor(
    message: string,
    public code?: number,
    public data?: any
  ) {
    super(message)
    this.name = 'BundlerError'
  }
}
