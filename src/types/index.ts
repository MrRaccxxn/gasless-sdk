import type { Address, Hash, Hex } from 'viem'

export interface GaslessConfig {
  readonly chainId: number
  readonly rpcUrl: string
  readonly relayerUrl: string
  readonly forwarderAddress: Address
}

export interface TokenInfo {
  readonly address: Address
  readonly name: string
  readonly symbol: string
  readonly decimals: number
}

export interface MetaTransactionRequest {
  readonly from: Address
  readonly to: Address
  readonly value: bigint
  readonly gas: bigint
  readonly nonce: bigint
  readonly data: Hex
}

export interface PermitSignature {
  readonly v: number
  readonly r: Hex
  readonly s: Hex
  readonly deadline: bigint
}

export interface GaslessTransferParams {
  readonly token: Address
  readonly to: Address
  readonly amount: bigint
  readonly userAddress: Address
}

export interface TransactionResult {
  readonly hash: Hash
  readonly success: boolean
  readonly gasUsed?: bigint
}

export interface EIP712Domain {
  readonly name: string
  readonly version: string
  readonly chainId: number
  readonly verifyingContract: Address
}

export interface ForwardRequest {
  readonly from: Address
  readonly to: Address
  readonly value: bigint
  readonly gas: bigint
  readonly nonce: bigint
  readonly data: Hex
}

export interface PermitData {
  readonly owner: Address
  readonly spender: Address
  readonly value: bigint
  readonly nonce: bigint
  readonly deadline: bigint
}
