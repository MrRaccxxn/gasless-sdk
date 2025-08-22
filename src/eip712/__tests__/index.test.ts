import {
  createDomainSeparator,
  encodeMetaTransferData,
  createMetaTransferHash,
  parseSignature,
  formatSignature,
  EIP712_DOMAIN_TYPEHASH,
  META_TRANSFER_TYPEHASH,
} from '../index'
import type {
  EIP712Domain,
  EIP712MetaTransfer,
  SignatureData,
} from '../../types'

describe('EIP712 utilities', () => {
  const mockDomain: EIP712Domain = {
    name: 'GaslessRelayer',
    version: '1',
    chainId: 5000,
    verifyingContract: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
  }

  const mockMetaTransfer: EIP712MetaTransfer = {
    owner: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
    token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
    recipient: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
    amount: 1000000n,
    fee: 10000n,
    deadline: 1704067200n, // 2024-01-01 00:00:00 UTC
    nonce: 0n,
  }

  describe('createDomainSeparator', () => {
    it('should create domain separator hash', () => {
      const separator = createDomainSeparator(mockDomain)

      expect(separator).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(separator.length).toBe(66) // 0x + 64 hex chars
    })

    it('should create different separators for different domains', () => {
      const domain2: EIP712Domain = {
        ...mockDomain,
        name: 'DifferentContract',
      }

      const separator1 = createDomainSeparator(mockDomain)
      const separator2 = createDomainSeparator(domain2)

      expect(separator1).not.toBe(separator2)
    })

    it('should create same separator for identical domains', () => {
      const separator1 = createDomainSeparator(mockDomain)
      const separator2 = createDomainSeparator(mockDomain)

      expect(separator1).toBe(separator2)
    })
  })

  describe('encodeMetaTransferData', () => {
    it('should encode meta transfer data', () => {
      const encoded = encodeMetaTransferData(mockMetaTransfer)

      expect(encoded).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(encoded.length).toBeGreaterThan(2) // More than just "0x"
    })

    it('should create different encodings for different data', () => {
      const transfer2: EIP712MetaTransfer = {
        ...mockMetaTransfer,
        amount: 2000000n,
      }

      const encoded1 = encodeMetaTransferData(mockMetaTransfer)
      const encoded2 = encodeMetaTransferData(transfer2)

      expect(encoded1).not.toBe(encoded2)
    })
  })

  describe('createMetaTransferHash', () => {
    it('should create EIP-712 typed data hash', () => {
      const hash = createMetaTransferHash(mockDomain, mockMetaTransfer)

      expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(hash.length).toBe(66)
    })

    it('should create different hashes for different domains', () => {
      const domain2: EIP712Domain = {
        ...mockDomain,
        chainId: 1,
      }

      const hash1 = createMetaTransferHash(mockDomain, mockMetaTransfer)
      const hash2 = createMetaTransferHash(domain2, mockMetaTransfer)

      expect(hash1).not.toBe(hash2)
    })

    it('should create different hashes for different transfer data', () => {
      const transfer2: EIP712MetaTransfer = {
        ...mockMetaTransfer,
        nonce: 1n,
      }

      const hash1 = createMetaTransferHash(mockDomain, mockMetaTransfer)
      const hash2 = createMetaTransferHash(mockDomain, transfer2)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('parseSignature', () => {
    it('should parse valid signature', () => {
      const signature =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

      const parsed = parseSignature(signature)

      expect(parsed.r).toBe(
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      )
      expect(parsed.s).toBe(
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      )
      expect(parsed.v).toBe(27)
    })

    it('should handle signature with v=28', () => {
      const signature =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c'

      const parsed = parseSignature(signature)

      expect(parsed.v).toBe(28)
    })

    it('should throw error for invalid signature length', () => {
      const invalidSignature = '0x123456'

      expect(() => parseSignature(invalidSignature)).toThrow(
        'Invalid signature length'
      )
    })
  })

  describe('formatSignature', () => {
    it('should format signature data', () => {
      const signatureData: SignatureData = {
        r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        s: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        v: 27,
      }

      const formatted = formatSignature(signatureData)

      expect(formatted).toBe(
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'
      )
    })

    it('should handle v=28 correctly', () => {
      const signatureData: SignatureData = {
        r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        s: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        v: 28,
      }

      const formatted = formatSignature(signatureData)

      expect(formatted).toMatch(/1c$/) // Should end with 1c (28 in hex)
    })

    it('should roundtrip parse and format', () => {
      const originalSignature =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

      const parsed = parseSignature(originalSignature)
      const formatted = formatSignature(parsed)

      expect(formatted).toBe(originalSignature)
    })
  })

  describe('type hashes', () => {
    it('should have correct EIP712_DOMAIN_TYPEHASH', () => {
      expect(EIP712_DOMAIN_TYPEHASH).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    it('should have correct META_TRANSFER_TYPEHASH', () => {
      expect(META_TRANSFER_TYPEHASH).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    it('should have different type hashes', () => {
      expect(EIP712_DOMAIN_TYPEHASH).not.toBe(META_TRANSFER_TYPEHASH)
    })
  })
})
