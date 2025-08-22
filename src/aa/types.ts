// Account Abstraction specific types

import type { Address, Hash, Hex } from 'viem'

export interface AAGaslessConfig {
  readonly chainId: number
  readonly rpcUrl: string
  readonly bundlerUrl: string
  readonly paymasterUrl: string
  readonly apiKey?: string
  readonly entryPointAddress?: Address
  readonly factoryAddress?: Address
}

export interface UserOperation {
  readonly sender: Address
  readonly nonce: bigint
  readonly callData: Hex
  readonly callGasLimit: bigint
  readonly verificationGasLimit: bigint
  readonly preVerificationGas: bigint
  readonly maxFeePerGas: bigint
  readonly maxPriorityFeePerGas: bigint
  readonly paymaster?: Address
  readonly paymasterVerificationGasLimit?: bigint
  readonly paymasterPostOpGasLimit?: bigint
  readonly paymasterData?: Hex
  readonly signature: Hex
}

export interface SmartAccountInfo {
  readonly address: Address
  readonly owner: Address
  readonly isDeployed: boolean
  readonly nonce: bigint
}

export interface AATransferParams {
  readonly token: Address
  readonly to: Address
  readonly amount: bigint
  readonly feeToken?: Address // Token to pay fees in (default: same as transfer token)
  readonly maxFeePercentage?: number // Max fee as percentage (default: 5%)
}

export interface AATransactionResult {
  readonly success: boolean
  readonly userOpHash: Hash
  readonly transactionHash?: Hash
  readonly receipt?: any
  readonly gasUsed?: bigint
  readonly feeCharged?: bigint
  readonly feeToken?: Address
}

export interface PaymasterResult {
  readonly paymaster: Address
  readonly paymasterData: Hex
  readonly preVerificationGas: bigint
  readonly verificationGasLimit: bigint
  readonly callGasLimit: bigint
  readonly paymasterVerificationGasLimit: bigint
  readonly paymasterPostOpGasLimit: bigint
}

export interface AATokenInfo {
  readonly address: Address
  readonly name: string
  readonly symbol: string
  readonly decimals: number
  readonly isWhitelisted: boolean
  readonly priceInETH?: bigint // Price for gas calculations
  readonly isSupported?: boolean // Supported by paymaster
}

export interface FeeQuote {
  readonly feeToken: Address
  readonly feeAmount: bigint
  readonly gasPrice: bigint
  readonly exchangeRate: bigint
  readonly validUntil: bigint
}
