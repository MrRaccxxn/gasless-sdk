// Advanced security middleware for the relayer service

const crypto = require('crypto')
const redis = require('redis')
const { verifyMessage } = require('viem')

class SecurityManager {
  constructor() {
    this.redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    })
    
    // Rate limiting by user address
    this.userRateLimits = new Map()
    
    // Nonce tracking to prevent replay attacks
    this.usedNonces = new Set()
  }

  async initialize() {
    await this.redisClient.connect()
  }

  // API Key authentication middleware
  async authenticateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key']
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' })
    }

    // Verify API key against database/whitelist
    const isValidKey = await this.validateApiKey(apiKey)
    if (!isValidKey) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    // Add API key info to request
    req.apiKeyInfo = await this.getApiKeyInfo(apiKey)
    next()
  }

  // User address rate limiting
  async rateLimitByUser(req, res, next) {
    const { userAddress } = req.body
    if (!userAddress) {
      return res.status(400).json({ error: 'User address required' })
    }

    const key = `rate_limit:${userAddress.toLowerCase()}`
    
    try {
      // Get current request count for this user
      const currentCount = await this.redisClient.get(key)
      const maxRequestsPerHour = 10 // Adjust based on your needs
      
      if (currentCount && parseInt(currentCount) >= maxRequestsPerHour) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded. Try again later.' 
        })
      }

      // Increment counter
      await this.redisClient.multi()
        .incr(key)
        .expire(key, 3600) // 1 hour expiry
        .exec()

      next()
    } catch (error) {
      console.error('Rate limiting error:', error)
      next() // Continue on Redis errors
    }
  }

  // Signature verification for additional security
  async verifyUserSignature(req, res, next) {
    const { userAddress, timestamp, userSignature } = req.body
    
    if (!userSignature || !timestamp) {
      return res.status(400).json({ 
        error: 'User signature and timestamp required' 
      })
    }

    try {
      // Check timestamp is recent (within 5 minutes)
      const now = Math.floor(Date.now() / 1000)
      if (Math.abs(now - timestamp) > 300) {
        return res.status(400).json({ error: 'Request timestamp too old' })
      }

      // Create message to verify
      const message = `Gasless transfer request\nTimestamp: ${timestamp}\nUser: ${userAddress}`
      
      // Verify signature
      const isValid = await verifyMessage({
        address: userAddress,
        message,
        signature: userSignature
      })

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid user signature' })
      }

      next()
    } catch (error) {
      console.error('Signature verification error:', error)
      res.status(401).json({ error: 'Signature verification failed' })
    }
  }

  // Nonce tracking to prevent replay attacks
  async checkNonce(req, res, next) {
    const { metaTx } = req.body
    const nonceKey = `${metaTx.owner}:${metaTx.nonce}`
    
    try {
      // Check if nonce was already used
      const isUsed = await this.redisClient.get(`nonce:${nonceKey}`)
      if (isUsed) {
        return res.status(400).json({ error: 'Nonce already used' })
      }

      // Mark nonce as used (expire after 24 hours)
      await this.redisClient.setEx(`nonce:${nonceKey}`, 86400, 'used')
      
      next()
    } catch (error) {
      console.error('Nonce checking error:', error)
      next() // Continue on Redis errors
    }
  }

  // Volume limiting per user
  async checkDailyVolume(req, res, next) {
    const { userAddress, metaTx } = req.body
    const today = new Date().toISOString().split('T')[0]
    const volumeKey = `volume:${userAddress.toLowerCase()}:${today}`
    
    try {
      const currentVolume = await this.redisClient.get(volumeKey) || '0'
      const newVolume = BigInt(currentVolume) + metaTx.amount
      
      // Convert to USD or set limit in wei/tokens
      const dailyLimitWei = BigInt('1000000000000000000000') // 1000 tokens
      
      if (newVolume > dailyLimitWei) {
        return res.status(429).json({ 
          error: 'Daily volume limit exceeded' 
        })
      }

      // Update volume
      await this.redisClient.setEx(volumeKey, 86400, newVolume.toString())
      
      next()
    } catch (error) {
      console.error('Volume checking error:', error)
      next() // Continue on Redis errors
    }
  }

  // IP-based geographic restrictions
  geoRestriction(req, res, next) {
    const clientIP = req.ip || req.connection.remoteAddress
    
    // Add your geo-restriction logic here
    // Example: block certain countries, allow only specific regions
    
    next()
  }

  // Honeypot detection (detect automated attacks)
  async honeypotDetection(req, res, next) {
    const honeypotField = req.body._honeypot
    
    // If honeypot field is filled, it's likely a bot
    if (honeypotField) {
      console.log(`Honeypot triggered from IP: ${req.ip}`)
      return res.status(400).json({ error: 'Invalid request' })
    }
    
    next()
  }

  // Helper methods
  async validateApiKey(apiKey) {
    // Implement your API key validation logic
    // This could check against a database, Redis, or environment variables
    const validKeys = process.env.VALID_API_KEYS?.split(',') || []
    return validKeys.includes(apiKey)
  }

  async getApiKeyInfo(apiKey) {
    // Return information about the API key (rate limits, permissions, etc.)
    return {
      key: apiKey,
      rateLimitTier: 'standard',
      permissions: ['gasless_transfer']
    }
  }
}

module.exports = SecurityManager