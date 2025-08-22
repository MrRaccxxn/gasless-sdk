import {
  validateAddress,
  validateAmount,
  validateChainId,
  formatTokenAmount,
  parseTokenAmount,
  isGaslessTransferValid,
  calculateTotalCost,
  formatGaslessError,
  createDeadline,
  hexToSignature,
  signatureToHex,
} from '../helpers'
import type { GaslessTransferParams, ContractLimits } from '../../types'

// Mock viem isAddress function
jest.mock('viem', () => ({
  isAddress: jest.fn((address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }),
}))

describe('helpers', () => {
  describe('validateAddress', () => {
    it('should validate valid Ethereum addresses', () => {
      const validAddress = '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b'
      expect(validateAddress(validAddress)).toBe(validAddress)
    })

    it('should throw error for invalid addresses', () => {
      expect(() => validateAddress('invalid')).toThrow(
        'Invalid address: invalid'
      )
      expect(() => validateAddress('0x123')).toThrow('Invalid address: 0x123')
      expect(() => validateAddress('')).toThrow('Invalid address: ')
    })

    it('should handle checksummed addresses', () => {
      const checksummed = '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b'
      expect(validateAddress(checksummed)).toBe(checksummed)
    })
  })

  describe('validateAmount', () => {
    it('should not throw for positive amounts', () => {
      expect(() => validateAmount(1n)).not.toThrow()
      expect(() => validateAmount(100n)).not.toThrow()
      expect(() => validateAmount(BigInt('1000000000000000000'))).not.toThrow()
    })

    it('should throw error for zero or negative amounts', () => {
      expect(() => validateAmount(0n)).toThrow('Amount must be greater than 0')
      expect(() => validateAmount(-1n)).toThrow('Amount must be greater than 0')
      expect(() => validateAmount(-100n)).toThrow(
        'Amount must be greater than 0'
      )
    })
  })

  describe('validateChainId', () => {
    it('should validate positive integer chain IDs', () => {
      expect(() => validateChainId(1)).not.toThrow()
      expect(() => validateChainId(5000)).not.toThrow()
      expect(() => validateChainId(137)).not.toThrow()
    })

    it('should throw error for invalid chain IDs', () => {
      expect(() => validateChainId(0)).toThrow('Invalid chain ID')
      expect(() => validateChainId(-1)).toThrow('Invalid chain ID')
      expect(() => validateChainId(1.5)).toThrow('Invalid chain ID')
    })
  })

  describe('formatTokenAmount', () => {
    it('should format amounts with no decimals correctly', () => {
      expect(formatTokenAmount(100n, 0)).toBe('100')
      expect(formatTokenAmount(0n, 0)).toBe('0')
    })

    it('should format amounts with decimals correctly', () => {
      expect(formatTokenAmount(1000000000000000000n, 18)).toBe('1')
      expect(formatTokenAmount(1500000000000000000n, 18)).toBe('1.5')
      expect(formatTokenAmount(1234567890000000000n, 18)).toBe('1.23456789')
    })

    it('should handle edge cases', () => {
      expect(formatTokenAmount(1n, 18)).toBe('0.000000000000000001')
      expect(formatTokenAmount(999999999999999999n, 18)).toBe(
        '0.999999999999999999'
      )
    })

    it('should handle USDC (6 decimals)', () => {
      expect(formatTokenAmount(1000000n, 6)).toBe('1')
      expect(formatTokenAmount(1500000n, 6)).toBe('1.5')
      expect(formatTokenAmount(1n, 6)).toBe('0.000001')
    })
  })

  describe('parseTokenAmount', () => {
    it('should parse integer amounts correctly', () => {
      expect(parseTokenAmount('100', 18)).toBe(100000000000000000000n)
      expect(parseTokenAmount('1', 0)).toBe(1n)
    })

    it('should parse decimal amounts correctly', () => {
      expect(parseTokenAmount('1.5', 18)).toBe(1500000000000000000n)
      expect(parseTokenAmount('0.000000000000000001', 18)).toBe(1n)
    })

    it('should throw error for invalid formats', () => {
      expect(() => parseTokenAmount('', 18)).toThrow('Invalid amount format')
      expect(() => parseTokenAmount('abc', 18)).toThrow('Invalid amount format')
      expect(() => parseTokenAmount('1.abc', 18)).toThrow(
        'Invalid amount format'
      )
      expect(() => parseTokenAmount('.5', 18)).toThrow('Invalid amount format')
      expect(() => parseTokenAmount('-1', 18)).toThrow('Invalid amount format')
    })

    it('should throw error for too many decimal places', () => {
      expect(() => parseTokenAmount('1.0000000000000000001', 18)).toThrow(
        'Too many decimal places (max: 18)'
      )
    })

    it('should handle USDC parsing', () => {
      expect(parseTokenAmount('1', 6)).toBe(1000000n)
      expect(parseTokenAmount('1.5', 6)).toBe(1500000n)
      expect(parseTokenAmount('0.000001', 6)).toBe(1n)
    })
  })

  describe('isGaslessTransferValid', () => {
    const validParams: GaslessTransferParams = {
      token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
      to: '0x8ba1f109551bD432803012645Hac136c11DdF536',
      amount: 1000000n,
      fee: 10000n,
    }

    const limits: ContractLimits = {
      maxTransferAmount: 10000000n,
      maxFeeAmount: 1000000n,
    }

    it('should validate correct transfer params', () => {
      expect(isGaslessTransferValid(validParams, limits)).toBe(true)
    })

    it('should reject transfer amount exceeding limit', () => {
      const invalidParams = { ...validParams, amount: 20000000n }
      expect(isGaslessTransferValid(invalidParams, limits)).toBe(false)
    })

    it('should reject fee exceeding limit', () => {
      const invalidParams = { ...validParams, fee: 2000000n }
      expect(isGaslessTransferValid(invalidParams, limits)).toBe(false)
    })

    it('should handle undefined fee', () => {
      const paramsWithoutFee = { ...validParams, fee: undefined }
      expect(isGaslessTransferValid(paramsWithoutFee, limits)).toBe(true)
    })
  })

  describe('calculateTotalCost', () => {
    it('should calculate total cost with fee', () => {
      const params: GaslessTransferParams = {
        token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        to: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        amount: 1000000n,
        fee: 10000n,
      }

      expect(calculateTotalCost(params)).toBe(1010000n)
    })

    it('should calculate total cost without fee', () => {
      const params: GaslessTransferParams = {
        token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        to: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        amount: 1000000n,
      }

      expect(calculateTotalCost(params)).toBe(1000000n)
    })
  })

  describe('formatGaslessError', () => {
    it('should format custom error messages', () => {
      const error = new Error('TokenNotWhitelisted(0x123...)')
      const formatted = formatGaslessError(error, 'transfer')

      expect(formatted).toContain('transfer failed')
      expect(formatted).toContain('not whitelisted')
    })

    it('should handle generic errors', () => {
      const error = new Error('Network timeout')
      const formatted = formatGaslessError(error, 'estimation')

      expect(formatted).toContain('estimation failed')
      expect(formatted).toContain('Network timeout')
    })

    it('should handle unknown errors', () => {
      const formatted = formatGaslessError('Unknown error', 'validation')

      expect(formatted).toContain('validation failed')
      expect(formatted).toContain('Unknown error')
    })
  })

  describe('createDeadline', () => {
    beforeAll(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-01-01T00:00:00Z'))
    })

    afterAll(() => {
      jest.useRealTimers()
    })

    it('should create deadline in seconds', () => {
      const deadline = createDeadline(3600) // 1 hour
      const expected = BigInt(Math.floor(Date.now() / 1000) + 3600)

      expect(deadline).toBe(expected)
    })

    it('should use default 1 hour deadline', () => {
      const deadline = createDeadline()
      const expected = BigInt(Math.floor(Date.now() / 1000) + 3600)

      expect(deadline).toBe(expected)
    })
  })

  describe('hexToSignature', () => {
    it('should parse valid hex signature', () => {
      const hex =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

      const signature = hexToSignature(hex)

      expect(signature.r).toBe(
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      )
      expect(signature.s).toBe(
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      )
      expect(signature.v).toBe(27)
    })

    it('should handle v=28', () => {
      const hex =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c'

      const signature = hexToSignature(hex)
      expect(signature.v).toBe(28)
    })

    it('should throw for invalid signature length', () => {
      expect(() => hexToSignature('0x123')).toThrow('Invalid signature length')
    })
  })

  describe('signatureToHex', () => {
    it('should format signature to hex', () => {
      const signature = {
        r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        s: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        v: 27,
      }

      const hex = signatureToHex(signature)

      expect(hex).toBe(
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'
      )
    })

    it('should handle v=28', () => {
      const signature = {
        r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        s: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        v: 28,
      }

      const hex = signatureToHex(signature)
      expect(hex).toMatch(/1c$/) // Should end with 1c (28 in hex)
    })

    it('should roundtrip with hexToSignature', () => {
      const original =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

      const signature = hexToSignature(original)
      const converted = signatureToHex(signature)

      expect(converted).toBe(original)
    })
  })

  describe('roundtrip formatting', () => {
    it('should roundtrip token amounts correctly', () => {
      const amounts = [
        { amount: 1000000000000000000n, decimals: 18 },
        { amount: 1500000n, decimals: 6 },
        { amount: 123456789n, decimals: 8 },
        { amount: 1n, decimals: 18 },
      ]

      amounts.forEach(({ amount, decimals }) => {
        const formatted = formatTokenAmount(amount, decimals)
        const parsed = parseTokenAmount(formatted, decimals)
        expect(parsed).toBe(amount)
      })
    })
  })
})
