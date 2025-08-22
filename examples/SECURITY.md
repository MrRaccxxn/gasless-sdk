# 🔒 Production Security Guide

## Critical Security Measures

### 1. Private Key Management

**❌ NEVER DO:**
```javascript
// DON'T: Store private key in code or frontend
const relayerPrivateKey = "0x1234..." // NEVER!
```

**✅ DO:**
```bash
# Use environment variables
export RELAYER_PRIVATE_KEY="0x..."

# Use AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id relayer-private-key

# Use Azure Key Vault
az keyvault secret show --vault-name MyKeyVault --name relayer-key

# Use HashiCorp Vault
vault kv get -field=private_key secret/relayer
```

### 2. Infrastructure Security

#### A. Use Hardware Security Modules (HSM)
```javascript
// Example with AWS KMS
const { KMSClient, SignCommand } = require('@aws-sdk/client-kms')

class SecureRelayer {
  async signWithKMS(message) {
    const kms = new KMSClient({ region: 'us-east-1' })
    const command = new SignCommand({
      KeyId: process.env.KMS_KEY_ID,
      Message: Buffer.from(message),
      MessageType: 'RAW',
      SigningAlgorithm: 'ECDSA_SHA_256'
    })
    
    return await kms.send(command)
  }
}
```

#### B. Multi-Signature Relayer Setup
```solidity
// Enhanced contract with multi-sig security
contract SecureGaslessRelayer {
    mapping(address => bool) public relayers;
    uint256 public requiredSignatures = 2;
    
    modifier onlyRelayers(bytes[] memory signatures) {
        require(validateSignatures(signatures), "Insufficient signatures");
        _;
    }
    
    function executeMetaTransfer(
        MetaTransfer memory metaTx,
        PermitData memory permitData,
        bytes memory userSignature,
        bytes[] memory relayerSignatures
    ) external onlyRelayers(relayerSignatures) {
        // Implementation
    }
}
```

### 3. Network Security

#### A. WAF Configuration
```yaml
# AWS WAF rules example
rules:
  - name: RateLimitRule
    priority: 1
    statement:
      rateBasedStatement:
        limit: 100
        aggregateKeyType: IP
  
  - name: GeoBlockRule
    priority: 2
    statement:
      geoMatchStatement:
        countryCodes: ['CN', 'RU', 'KP'] # Block specific countries
```

#### B. DDoS Protection
```javascript
// Express with DDoS protection
const rateLimit = require('express-rate-limit')
const slowDown = require('express-slow-down')

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: 500
})

app.use('/api/', limiter, speedLimiter)
```

### 4. Database Security

#### A. Transaction Logging
```javascript
// Secure transaction logging
class SecureLogger {
  async logTransaction(txData) {
    // Hash sensitive data
    const hashedData = {
      txHash: txData.hash,
      userAddressHash: this.hashAddress(txData.userAddress),
      amount: txData.amount,
      timestamp: new Date(),
      ipHash: this.hashIP(txData.ip),
      status: txData.status
    }
    
    await this.db.transactions.insert(hashedData)
  }
  
  hashAddress(address) {
    return crypto.createHash('sha256')
      .update(address + process.env.SALT)
      .digest('hex')
  }
}
```

#### B. Audit Trail
```sql
-- Audit table for compliance
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  user_hash VARCHAR(64),
  timestamp TIMESTAMP DEFAULT NOW(),
  ip_hash VARCHAR(64),
  details JSONB,
  signature VARCHAR(132)
);

-- Index for fast queries
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_user ON audit_log(user_hash);
```

### 5. Monitoring & Alerting

#### A. Security Monitoring
```javascript
// Security event monitoring
class SecurityMonitor {
  async detectAnomalies(txData) {
    // Detect unusual patterns
    const checks = [
      this.checkFrequencyAttack(txData.userAddress),
      this.checkAmountAnomaly(txData.amount),
      this.checkGeographicAnomaly(txData.ip),
      this.checkSignatureReuse(txData.signature)
    ]
    
    const anomalies = await Promise.all(checks)
    
    if (anomalies.some(a => a.risk > 0.8)) {
      await this.alertSecurityTeam(anomalies)
      throw new Error('Transaction blocked: high risk')
    }
  }
  
  async alertSecurityTeam(anomalies) {
    // Send to Slack, PagerDuty, etc.
    await this.slack.send({
      text: `🚨 High-risk transaction detected: ${JSON.stringify(anomalies)}`
    })
  }
}
```

### 6. Compliance & Legal

#### A. KYC/AML Integration
```javascript
// Basic KYC check
class ComplianceChecker {
  async checkUser(userAddress) {
    // Check against OFAC sanctions list
    const sanctionCheck = await this.checkSanctions(userAddress)
    
    // Check transaction limits
    const dailyVolume = await this.getDailyVolume(userAddress)
    
    // Risk scoring
    const riskScore = await this.calculateRisk(userAddress)
    
    return {
      allowed: !sanctionCheck.blocked && riskScore < 0.7,
      reason: sanctionCheck.reason || 'Risk threshold exceeded'
    }
  }
}
```

### 7. Incident Response Plan

#### A. Emergency Procedures
```javascript
// Emergency circuit breaker
class EmergencyControls {
  async emergencyPause() {
    // Pause all operations
    await this.contract.pause()
    
    // Notify all stakeholders
    await this.notifyEmergency()
    
    // Log incident
    await this.logIncident('EMERGENCY_PAUSE', new Date())
  }
  
  async drainRelayerFunds() {
    // Move funds to secure wallet
    const balance = await this.getRelayerBalance()
    await this.transferToSecureWallet(balance)
  }
}
```

## Production Deployment Checklist

### Infrastructure
- [ ] Private keys stored in HSM/KMS
- [ ] Multi-signature wallet setup
- [ ] WAF configured
- [ ] DDoS protection enabled
- [ ] Load balancer configured
- [ ] SSL/TLS certificates valid
- [ ] VPC with private subnets

### Application
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] SQL injection protection
- [ ] XSS protection headers
- [ ] CORS properly configured
- [ ] Error handling doesn't leak info
- [ ] Logging configured (no sensitive data)

### Monitoring
- [ ] Health checks configured
- [ ] Performance monitoring
- [ ] Security event monitoring
- [ ] Alert thresholds set
- [ ] Incident response plan tested
- [ ] Backup and recovery tested

### Compliance
- [ ] Data retention policy
- [ ] Privacy policy compliance
- [ ] Audit trail implementation
- [ ] Regulatory compliance check
- [ ] Terms of service updated

### Testing
- [ ] Penetration testing completed
- [ ] Load testing passed
- [ ] Security audit performed
- [ ] Disaster recovery tested
- [ ] Key rotation tested

## Emergency Contacts

- **Security Team**: security@yourcompany.com
- **On-call Engineer**: +1-XXX-XXX-XXXX
- **Legal Team**: legal@yourcompany.com
- **Compliance Officer**: compliance@yourcompany.com

Remember: Security is an ongoing process, not a one-time setup!