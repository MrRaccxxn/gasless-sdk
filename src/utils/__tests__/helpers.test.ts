import {
  validateAddress,
  validateAmount,
  validateChainId,
  formatTokenAmount,
  parseTokenAmount,
} from '../helpers'

describe('helpers', () => {
  describe('validateAddress', () => {
    it('should validate valid Ethereum addresses', () => {
      const validAddress = '0x742d35cc6B7e4CE7c56F1Ba2e0fB3e00e2Fb0E9b'
      expect(validateAddress(validAddress)).toBe(validAddress)
    })

    it('should throw error for invalid addresses', () => {
      expect(() => validateAddress('invalid')).toThrow(
        'Invalid address: invalid'
      )
      expect(() => validateAddress('0x123')).toThrow('Invalid address: 0x123')
      expect(() => validateAddress('')).toThrow('Invalid address: ')
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
  })
})
