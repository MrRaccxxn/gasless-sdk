import type { Address, Hex } from 'viem'
import { isAddress } from 'viem'
import type {
  GaslessTransferParams,
  ContractLimits,
  SignatureData,
} from '../types'

export function validateAddress(address: string): Address {
  if (!isAddress(address)) {
    throw new Error(`Invalid address: ${address}`)
  }
  return address as Address
}

export function validateAmount(amount: bigint): void {
  if (amount <= 0n) {
    throw new Error('Amount must be greater than 0')
  }
}

export function validateChainId(chainId: number): void {
  if (chainId <= 0 || !Number.isInteger(chainId)) {
    throw new Error('Invalid chain ID')
  }
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals)
  const quotient = amount / divisor
  const remainder = amount % divisor

  if (remainder === 0n) {
    return quotient.toString()
  }

  const fractional = remainder.toString().padStart(decimals, '0')
  return `${quotient.toString()}.${fractional.replace(/0+$/, '')}`
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [integer, fractional = ''] = amount.split('.')

  if (!integer || !/^\d+$/.test(integer)) {
    throw new Error('Invalid amount format')
  }

  if (fractional && !/^\d+$/.test(fractional)) {
    throw new Error('Invalid amount format')
  }

  if (fractional.length > decimals) {
    throw new Error(`Too many decimal places (max: ${decimals})`)
  }

  const paddedFractional = fractional.padEnd(decimals, '0')
  const totalAmount = integer + paddedFractional

  return BigInt(totalAmount)
}

export function isGaslessTransferValid(
  params: GaslessTransferParams,
  limits: ContractLimits
): boolean {
  if (params.amount > limits.maxTransferAmount) {
    return false
  }

  const fee = params.fee || 0n
  if (fee > limits.maxFeeAmount) {
    return false
  }

  return true
}

export function calculateTotalCost(params: GaslessTransferParams): bigint {
  return params.amount + (params.fee || 0n)
}

export function formatGaslessError(error: unknown, operation: string): string {
  const errorMessage = error instanceof Error ? error.message : String(error)

  if (errorMessage.includes('TokenNotWhitelisted')) {
    return `Gasless ${operation} failed: Token is not whitelisted for gasless transfers`
  }

  if (errorMessage.includes('AmountExceedsMax')) {
    return `Gasless ${operation} failed: Transfer amount exceeds maximum limit`
  }

  if (errorMessage.includes('FeeExceedsMax')) {
    return `Gasless ${operation} failed: Fee amount exceeds maximum limit`
  }

  if (errorMessage.includes('DeadlineExpired')) {
    return `Gasless ${operation} failed: Transaction deadline has expired`
  }

  if (errorMessage.includes('InvalidSignature')) {
    return `Gasless ${operation} failed: Invalid signature provided`
  }

  if (errorMessage.includes('RecipientNotAllowed')) {
    return `Gasless ${operation} failed: Recipient address is not allowed`
  }

  return `Gasless ${operation} failed: ${errorMessage}`
}

export function createDeadline(secondsFromNow: number = 3600): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + secondsFromNow)
}

export function hexToSignature(hex: Hex): SignatureData {
  if (hex.length !== 132) {
    throw new Error('Invalid signature length')
  }

  const r = hex.slice(0, 66) as Hex
  const s = ('0x' + hex.slice(66, 130)) as Hex
  const v = parseInt(hex.slice(130, 132), 16)

  return { v, r, s }
}

export function signatureToHex(signature: SignatureData): Hex {
  const r = signature.r.slice(2)
  const s = signature.s.slice(2)
  const v = signature.v.toString(16).padStart(2, '0')

  return ('0x' + r + s + v) as Hex
}
