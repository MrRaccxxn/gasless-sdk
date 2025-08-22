// Paymaster client for gas sponsorship and fee collection

import type { Address, Hex } from 'viem'
import type { UserOperation, PaymasterResult, FeeQuote } from './types'

export interface PaymasterRequest {
  method: string
  params: any[]
  id: number
  jsonrpc: string
}

export interface PaymasterResponse<T = any> {
  jsonrpc: string
  id: number
  result?: T
  error?: {
    code: number
    message: string
    data?: any
  }
}

export interface SponsorUserOperationRequest {
  userOperation: Partial<UserOperation>
  entryPoint: Address
  sponsorshipPolicy?: {
    sponsorshipType: 'free' | 'token_payment'
    tokenPaymasterAddress?: Address
    feeToken?: Address
    maxFeeAmount?: bigint
  }
}

export interface TokenPaymasterRequest {
  userOperation: Partial<UserOperation>
  entryPoint: Address
  tokenAddress: Address
  maxFeeAmount?: bigint
}

export class PaymasterClient {
  private paymasterUrl: string
  private apiKey?: string
  private requestId: number = 1

  constructor(paymasterUrl: string, apiKey?: string) {
    this.paymasterUrl = paymasterUrl
    if (apiKey !== undefined) {
      this.apiKey = apiKey
    }
  }

  // Get sponsorship for free (you pay the gas)
  async sponsorUserOperation(
    userOperation: Partial<UserOperation>,
    entryPoint: Address
  ): Promise<PaymasterResult> {
    const request: SponsorUserOperationRequest = {
      userOperation: this.formatUserOperation(userOperation),
      entryPoint,
      sponsorshipPolicy: {
        sponsorshipType: 'free',
      },
    }

    const response = await this.request<PaymasterResult>(
      'pm_sponsorUserOperation',
      [request]
    )
    return this.parsePaymasterResult(response)
  }

  // Get token paymaster data (user pays in tokens)
  async getTokenPaymasterData(
    userOperation: Partial<UserOperation>,
    entryPoint: Address,
    tokenAddress: Address,
    maxFeeAmount?: bigint
  ): Promise<PaymasterResult> {
    const request: TokenPaymasterRequest = {
      userOperation: this.formatUserOperation(userOperation),
      entryPoint,
      tokenAddress,
      ...(maxFeeAmount && { maxFeeAmount }),
    }

    const response = await this.request<PaymasterResult>(
      'pm_getTokenPaymasterData',
      [request]
    )
    return this.parsePaymasterResult(response)
  }

  // Get fee quote for token payment
  async getFeeQuote(
    userOperation: Partial<UserOperation>,
    entryPoint: Address,
    tokenAddress: Address
  ): Promise<FeeQuote> {
    const response = await this.request<FeeQuote>('pm_getFeeQuote', [
      this.formatUserOperation(userOperation),
      entryPoint,
      tokenAddress,
    ])

    return {
      feeToken: response.feeToken,
      feeAmount: BigInt(response.feeAmount),
      gasPrice: BigInt(response.gasPrice),
      exchangeRate: BigInt(response.exchangeRate),
      validUntil: BigInt(response.validUntil),
    }
  }

  // Get supported tokens for fee payment
  async getSupportedTokens(): Promise<{
    tokens: Array<{
      address: Address
      symbol: string
      decimals: number
      exchangeRate: bigint
    }>
  }> {
    const response = await this.request<any>('pm_getSupportedTokens', [])

    return {
      tokens: response.tokens.map((token: any) => ({
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        exchangeRate: BigInt(token.exchangeRate),
      })),
    }
  }

  // Validate sponsorship policy
  async validateSponsorshipPolicy(
    userOperation: Partial<UserOperation>,
    entryPoint: Address,
    policy: any
  ): Promise<boolean> {
    try {
      const response = await this.request<{ valid: boolean }>(
        'pm_validateSponsorshipPolicy',
        [this.formatUserOperation(userOperation), entryPoint, policy]
      )

      return response.valid
    } catch (error) {
      return false
    }
  }

  private async request<T>(method: string, params: any[]): Promise<T> {
    const requestBody: PaymasterRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.requestId++,
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Add API key to headers (Pimlico format)
    if (this.paymasterUrl.includes('pimlico.io')) {
      // For Pimlico, API key is in URL
      if (!this.paymasterUrl.includes('apikey=')) {
        throw new Error('Pimlico paymaster URL must include apikey parameter')
      }
    } else if (this.apiKey) {
      // For other paymasters, use header
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    try {
      const response = await fetch(this.paymasterUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: PaymasterResponse<T> = await response.json()

      if (data.error) {
        throw new Error(
          `Paymaster error ${data.error.code}: ${data.error.message}`
        )
      }

      if (data.result === undefined) {
        throw new Error('Invalid response from paymaster')
      }

      return data.result
    } catch (error) {
      throw new Error(
        `Paymaster request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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

  private parsePaymasterResult(response: any): PaymasterResult {
    return {
      paymaster: response.paymaster,
      paymasterData: response.paymasterData,
      preVerificationGas: BigInt(response.preVerificationGas),
      verificationGasLimit: BigInt(response.verificationGasLimit),
      callGasLimit: BigInt(response.callGasLimit),
      paymasterVerificationGasLimit: BigInt(
        response.paymasterVerificationGasLimit || 0
      ),
      paymasterPostOpGasLimit: BigInt(response.paymasterPostOpGasLimit || 0),
    }
  }
}

export class PaymasterError extends Error {
  constructor(
    message: string,
    public code?: number,
    public data?: any
  ) {
    super(message)
    this.name = 'PaymasterError'
  }
}
