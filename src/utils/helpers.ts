import type { Address } from 'viem'
import { isAddress } from 'viem'

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
