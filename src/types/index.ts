import type { Address, Hash, Hex } from 'viem'

export type ChainPreset = 'mantle-sepolia'

export interface ChainConfig {
  readonly chainId: number
  readonly rpcUrl: string
  readonly gaslessRelayerAddress: Address
  readonly relayerServiceUrl: string
}

export type Environment = 'local' | 'development' | 'staging' | 'production' | 'test'

export interface GaslessConfig {
  readonly chainPreset?: ChainPreset
  readonly environment?: Environment
  readonly chainId?: number
  readonly rpcUrl?: string
  readonly gaslessRelayerAddress?: Address
  readonly relayerServiceUrl?: string
  readonly localRelayerUrl?: string
}

export interface TokenInfo {
  readonly address: Address
  readonly name: string
  readonly symbol: string
  readonly decimals: number
  readonly isWhitelisted: boolean
}

export interface MetaTransfer {
  readonly owner: Address
  readonly token: Address
  readonly recipient: Address
  readonly amount: bigint
  readonly fee: bigint
  readonly deadline: bigint
  readonly nonce: bigint
}

export interface PermitData {
  readonly value: bigint
  readonly deadline: bigint
  readonly v: number
  readonly r: Hex
  readonly s: Hex
}

export interface GaslessTransferParams {
  readonly token: Address
  readonly to: Address
  readonly amount: bigint
  readonly fee?: bigint
  readonly deadline?: bigint
}

export interface SimpleTransferParams {
  readonly to: Address
  readonly amount: bigint
  readonly token: Address
}

export interface TransactionResult {
  readonly hash: Hash
  readonly success: boolean
  readonly gasUsed?: bigint
  readonly metaTxHash?: Hex
}

export interface EIP712Domain {
  readonly name: string
  readonly version: string
  readonly chainId: number
  readonly verifyingContract: Address
}

export interface EIP712MetaTransfer {
  readonly owner: Address
  readonly token: Address
  readonly recipient: Address
  readonly amount: bigint
  readonly fee: bigint
  readonly deadline: bigint
  readonly nonce: bigint
}

export interface EIP2612Permit {
  readonly owner: Address
  readonly spender: Address
  readonly value: bigint
  readonly nonce: bigint
  readonly deadline: bigint
}

export interface SignatureData {
  readonly v: number
  readonly r: Hex
  readonly s: Hex
}

export interface ContractLimits {
  readonly maxTransferAmount: bigint
  readonly maxFeeAmount: bigint
}

export interface GaslessTransferRequest {
  readonly metaTx: MetaTransfer
  readonly permitData: PermitData
  readonly signature: Hex
}

export interface ForwardRequest {
  readonly from: Address
  readonly to: Address
  readonly value: bigint
  readonly gas: bigint
  readonly nonce: bigint
  readonly data: Hex
}

export interface MetaTransactionRequest {
  readonly from: Address
  readonly to: Address
  readonly value: bigint
  readonly gas: bigint
  readonly nonce: bigint
  readonly data: Hex
}
