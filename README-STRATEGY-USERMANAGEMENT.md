# 🔐 User Management & Billing Implementation Strategy

## Document Version: 1.0.0
## Last Updated: August 13, 2025
## Status: APPROVED FOR IMPLEMENTATION
## Risk Level: HIGH (Medical Data + Billing)

---

## 📋 Executive Summary

This document outlines the **SAFE, SECURE, and ROBUST** strategy for implementing user management and billing in the Aayu Well AI Medical Scribe application without breaking the existing production system.

**Core Principle:** Add capabilities alongside existing functionality, never replace until proven stable.

---

## 🎯 Implementation Philosophy

### The Four Pillars

1. **ZERO DOWNTIME** - Production never stops working
2. **GRADUAL MIGRATION** - Prove stability before switching
3. **INSTANT ROLLBACK** - Revert within 30 seconds if issues
4. **COMPLETE AUDIT TRAIL** - Every action logged for HIPAA

---

## 🏗️ Architecture Overview

### Current State (v2.5.0 - WORKING)
```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Hardcoded Auth │────▶│ LocalStorage │────▶│ Working App │
└─────────────────┘     └──────────────┘     └─────────────┘
         ▲                                            ▲
         └────────────────────────────────────────────┘
                    NEVER BREAK THIS PATH
```

### Target State (v3.0.0 - PARALLEL)
```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Hardcoded Auth │────▶│ LocalStorage │────▶│ Working App │
└─────────────────┘     └──────────────┘     └─────────────┘
         +                      +                     +
         │                      │                     │
         ▼                      ▼                     ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│ PostgreSQL Auth │────▶│  PostgreSQL  │────▶│ Feature Flag│
└─────────────────┘     └──────────────┘     └─────────────┘
```

---

## 🔒 Security Implementation

### 1. Authentication Security

```javascript
// Rate limiting with exponential backoff
class SecureAuthService {
  constructor() {
    this.failedAttempts = new Map(); // Track by IP + username
    this.blockedIPs = new Set();
  }

  async login(username, password, captchaToken) {
    const ip = req.ip;
    const attemptKey = `${ip}:${username}`;
    
    // Check if blocked
    if (this.blockedIPs.has(ip)) {
      throw new Error('IP temporarily blocked');
    }
    
    // Check rate limit (5 attempts per 15 minutes)
    const attempts = this.failedAttempts.get(attemptKey) || 0;
    if (attempts >= 5) {
      this.blockedIPs.add(ip);
      setTimeout(() => this.blockedIPs.delete(ip), 900000); // 15 min
      await this.alertSecurity('BRUTE_FORCE_DETECTED', { ip, username });
      throw new Error('Too many attempts');
    }
    
    // Verify CAPTCHA after 3 attempts
    if (attempts >= 3 && !await this.verifyCaptcha(captchaToken)) {
      throw new Error('CAPTCHA verification failed');
    }
    
    // Verify credentials with timing attack prevention
    const isValid = await this.constantTimeVerify(username, password);
    
    if (!isValid) {
      this.failedAttempts.set(attemptKey, attempts + 1);
      await this.auditLog('LOGIN_FAILED', { ip, username });
      throw new Error('Invalid credentials');
    }
    
    // Success - clear attempts
    this.failedAttempts.delete(attemptKey);
    
    // Generate secure session
    return this.createSecureSession(username, ip);
  }
  
  async constantTimeVerify(username, password) {
    // Prevent timing attacks
    const user = await db.users.findUnique({ where: { username }});
    const dummyHash = '$argon2id$v=19$m=65536,t=3,p=1$dummy$hash';
    const hash = user ? user.password_hash : dummyHash;
    
    const valid = await argon2.verify(hash, password);
    
    // Always take same time regardless of user existence
    if (!user) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return false;
    }
    
    return valid;
  }
}
```

### 2. API Security

```javascript
// Request validation and signing
class SecureAPI {
  constructor() {
    this.rateLimiter = new RateLimiter({
      windowMs: 60000, // 1 minute
      max: 100, // requests per window
      keyGenerator: (req) => req.user?.id || req.ip
    });
  }
  
  validateRequest(req, res, next) {
    // 1. Check rate limit
    if (!this.rateLimiter.check(req)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    // 2. Validate request signature
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    
    if (!signature || !timestamp) {
      return res.status(401).json({ error: 'Missing signature' });
    }
    
    // Prevent replay attacks (5 minute window)
    if (Date.now() - parseInt(timestamp) > 300000) {
      return res.status(401).json({ error: 'Request expired' });
    }
    
    // 3. Verify signature
    const payload = `${timestamp}.${JSON.stringify(req.body)}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.API_SECRET)
      .update(payload)
      .digest('hex');
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      await this.auditLog('INVALID_SIGNATURE', { ip: req.ip });
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // 4. SQL injection prevention (automatic with parameterized queries)
    req.body = this.sanitizeInput(req.body);
    
    next();
  }
  
  sanitizeInput(input) {
    // Recursive sanitization
    if (typeof input === 'string') {
      // Remove any SQL keywords from user input
      return input.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b)/gi, '');
    }
    if (typeof input === 'object') {
      for (let key in input) {
        input[key] = this.sanitizeInput(input[key]);
      }
    }
    return input;
  }
}
```

### 3. Secrets Management

```javascript
// Azure Key Vault integration
class SecureSecrets {
  constructor() {
    this.client = new SecretClient(
      process.env.KEY_VAULT_URL,
      new DefaultAzureCredential()
    );
    this.cache = new Map();
    this.cacheTimeout = 300000; // 5 minutes
  }
  
  async getSecret(name) {
    // Check cache first
    if (this.cache.has(name)) {
      const cached = this.cache.get(name);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.value;
      }
    }
    
    try {
      // Fetch from Key Vault
      const secret = await this.client.getSecret(name);
      
      // Cache it
      this.cache.set(name, {
        value: secret.value,
        timestamp: Date.now()
      });
      
      return secret.value;
    } catch (error) {
      // Fallback to environment variable (for local dev only)
      if (process.env.NODE_ENV === 'development') {
        return process.env[name];
      }
      throw error;
    }
  }
  
  // Rotate keys automatically
  async rotateKeys() {
    const keys = ['API_SECRET', 'DB_PASSWORD', 'STRIPE_KEY'];
    
    for (const key of keys) {
      const newValue = crypto.randomBytes(32).toString('hex');
      await this.client.setSecret(key, newValue);
      
      // Clear cache
      this.cache.delete(key);
      
      // Audit log
      await this.auditLog('KEY_ROTATED', { key });
    }
  }
}

// Use throughout app
const secrets = new SecureSecrets();
const dbPassword = await secrets.getSecret('DB_PASSWORD');
```

---

## 🛡️ Robustness Implementation

### 1. Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.nextAttempt = Date.now();
  }
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.error(`Circuit breaker opened after ${this.failures} failures`);
    }
  }
}

// Usage
const dbCircuit = new CircuitBreaker();
const result = await dbCircuit.execute(() => db.query(sql));
```

### 2. Retry with Exponential Backoff

```javascript
class RetryManager {
  async executeWithRetry(fn, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const baseDelay = options.baseDelay || 1000;
    const maxDelay = options.maxDelay || 30000;
    
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          const delay = Math.min(
            baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
            maxDelay
          );
          
          console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
}

// Usage
const retry = new RetryManager();
const result = await retry.executeWithRetry(() => api.call());
```

### 3. Database Connection Management

```javascript
// Connection pool with health checks
class DatabasePool {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      max: 20, // Maximum connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Health check every 30 seconds
    setInterval(() => this.healthCheck(), 30000);
  }
  
  async query(text, params) {
    const start = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      
      // Log slow queries
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query (${duration}ms):`, text);
      }
      
      return result;
    } catch (error) {
      // Handle connection errors
      if (error.code === 'ECONNREFUSED') {
        await this.handleConnectionError();
      }
      throw error;
    }
  }
  
  async healthCheck() {
    try {
      await this.pool.query('SELECT 1');
    } catch (error) {
      console.error('Database health check failed:', error);
      await this.alertOps('DATABASE_UNHEALTHY', error);
    }
  }
  
  async transaction(callback) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

---

## 🚀 Deployment Strategy

### Phase 1: Infrastructure Setup (Day 1-3)

```bash
# 1. Create PostgreSQL database with encryption
az postgres server create \
  --name aayuscribe-db \
  --resource-group aayuscribe-rg \
  --sku-name B_Gen5_1 \
  --ssl-enforcement Enabled \
  --minimal-tls-version TLS1_2 \
  --public-network-access Disabled

# 2. Set up Key Vault for secrets
az keyvault create \
  --name aayuscribe-vault \
  --resource-group aayuscribe-rg \
  --enable-soft-delete \
  --enable-purge-protection

# 3. Configure monitoring
az monitor app-insights component create \
  --app aayuscribe-insights \
  --resource-group aayuscribe-rg
```

### Phase 2: Shadow Deployment (Day 4-7)

```javascript
// Deploy with all features OFF
const deployment = {
  features: {
    NEW_AUTH: false,
    NEW_DATABASE: false,
    BILLING: false,
    SHADOW_WRITES: true  // Only this enabled
  },
  
  monitoring: {
    errorThreshold: 0.01, // 1% error rate triggers alert
    latencyThreshold: 1000, // 1 second
    autoRollback: true
  }
};
```

### Phase 3: Beta Testing (Day 8-14)

```yaml
Beta Environment:
  URL: https://beta-aayuscribe.azurewebsites.net
  Users: 5 selected testers
  Features:
    - NEW_AUTH: true
    - NEW_DATABASE: true
    - BILLING: true
    - FALLBACK: true
  
  Success Criteria:
    - Zero data loss
    - < 1% error rate
    - < 2s page load
    - All critical paths working
```

### Phase 4: Gradual Rollout (Day 15-21)

```javascript
// Progressive feature enablement
const rolloutSchedule = [
  { day: 15, percentage: 10, features: ['NEW_AUTH'] },
  { day: 17, percentage: 25, features: ['NEW_AUTH', 'NEW_DATABASE'] },
  { day: 19, percentage: 50, features: ['NEW_AUTH', 'NEW_DATABASE'] },
  { day: 21, percentage: 100, features: ['NEW_AUTH', 'NEW_DATABASE', 'BILLING'] }
];

class GradualRollout {
  async shouldEnableFeature(userId, feature) {
    const rollout = await getRolloutConfig(feature);
    
    // Use consistent hashing for user bucketing
    const hash = crypto.createHash('md5')
      .update(`${userId}:${feature}`)
      .digest('hex');
    
    const bucket = parseInt(hash.substring(0, 8), 16) % 100;
    
    return bucket < rollout.percentage;
  }
}
```

---

## 🔄 Rollback Procedures

### Automatic Rollback Triggers

```javascript
class AutoRollback {
  constructor() {
    this.metrics = {
      errorRate: 0,
      latency: 0,
      successRate: 100
    };
    
    this.thresholds = {
      errorRate: 5, // 5% errors
      latency: 3000, // 3 seconds
      successRate: 95 // 95% success
    };
  }
  
  async monitor() {
    // Check every 30 seconds
    setInterval(async () => {
      await this.updateMetrics();
      
      if (this.shouldRollback()) {
        await this.executeRollback();
      }
    }, 30000);
  }
  
  shouldRollback() {
    return (
      this.metrics.errorRate > this.thresholds.errorRate ||
      this.metrics.latency > this.thresholds.latency ||
      this.metrics.successRate < this.thresholds.successRate
    );
  }
  
  async executeRollback() {
    console.error('AUTOMATIC ROLLBACK INITIATED');
    
    // 1. Disable new features immediately
    await this.disableFeatureFlags();
    
    // 2. Switch to fallback systems
    await this.enableFallbacks();
    
    // 3. Alert team
    await this.alertTeam('EMERGENCY_ROLLBACK', this.metrics);
    
    // 4. Create incident report
    await this.createIncidentReport();
  }
}
```

### Manual Rollback Steps

```bash
# EMERGENCY ROLLBACK PROCEDURE

# 1. Immediate feature disable (30 seconds)
az webapp config appsettings set \
  --name aayuscribe-app \
  --settings NEW_AUTH=false NEW_DATABASE=false BILLING=false

# 2. Revert database if needed (2 minutes)
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup_latest.sql

# 3. Clear cache (1 minute)
az redis cache purge --name aayuscribe-cache

# 4. Verify old system working (1 minute)
curl https://aayuscribe.com/health

# Total rollback time: < 5 minutes
```

---

## 📊 Monitoring & Alerting

### Key Metrics to Track

```javascript
const MonitoringMetrics = {
  // Performance
  'api.latency': { threshold: 1000, unit: 'ms' },
  'db.query.time': { threshold: 500, unit: 'ms' },
  'page.load.time': { threshold: 3000, unit: 'ms' },
  
  // Reliability
  'error.rate': { threshold: 1, unit: '%' },
  'uptime': { threshold: 99.9, unit: '%' },
  'failed.logins': { threshold: 10, unit: 'per_minute' },
  
  // Business
  'user.signups': { threshold: 0, unit: 'per_day' },
  'billing.failures': { threshold: 5, unit: '%' },
  'active.sessions': { threshold: 1000, unit: 'concurrent' },
  
  // Security
  'auth.failures': { threshold: 5, unit: 'per_user' },
  'suspicious.activity': { threshold: 1, unit: 'per_hour' },
  'data.exports': { threshold: 100, unit: 'per_user_per_day' }
};
```

### Alert Configuration

```yaml
Alerts:
  Critical (Page immediately):
    - Database down
    - Auth service down
    - Payment failures > 10%
    - Data breach detected
    
  High (Notify within 5 min):
    - Error rate > 5%
    - Response time > 3s
    - Failed logins spike
    
  Medium (Notify within 1 hour):
    - Disk usage > 80%
    - Memory usage > 90%
    - Slow queries increasing
    
  Low (Daily summary):
    - New user signups
    - Feature usage stats
    - Performance trends
```

---

## ✅ Pre-Deployment Checklist

### Security Review
- [ ] All passwords using Argon2
- [ ] MFA implemented and tested
- [ ] Rate limiting configured
- [ ] CAPTCHA integrated
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled
- [ ] CORS properly configured
- [ ] Secrets in Key Vault
- [ ] SSL/TLS enforced
- [ ] Security headers configured

### Robustness Review
- [ ] Circuit breakers implemented
- [ ] Retry logic configured
- [ ] Connection pooling set up
- [ ] Transaction rollback tested
- [ ] Error handling comprehensive
- [ ] Logging structured
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] Backup strategy tested
- [ ] Rollback procedure documented

### Performance Review
- [ ] Load testing completed
- [ ] Database indexes optimized
- [ ] Caching strategy implemented
- [ ] CDN configured
- [ ] Bundle size optimized
- [ ] API response < 1s
- [ ] Page load < 3s
- [ ] Memory leaks checked
- [ ] Connection limits tested
- [ ] Concurrent user testing done

### Compliance Review
- [ ] HIPAA requirements met
- [ ] Audit logging complete
- [ ] Data encryption verified
- [ ] Access controls tested
- [ ] Session management secure
- [ ] Password policy enforced
- [ ] Data retention configured
- [ ] Privacy policy updated
- [ ] Terms of service updated
- [ ] BAA agreements signed

---

## 📈 Success Criteria

### Week 1 Success Metrics
- ✅ Zero production downtime
- ✅ Shadow writes 100% successful
- ✅ No increase in error rate
- ✅ No performance degradation

### Week 2 Success Metrics
- ✅ Beta users successfully migrated
- ✅ < 1% error rate in beta
- ✅ All critical paths working
- ✅ Billing working correctly

### Month 1 Success Metrics
- ✅ 50% users migrated
- ✅ $5,000 MRR achieved
- ✅ 99.9% uptime maintained
- ✅ Zero security incidents

---

## 🚨 Emergency Contacts

| Role | Name | Contact | When to Contact |
|------|------|---------|-----------------|
| Product Owner | Dr. Darshan Patel | darshan@aayuwell.com | Major decisions |
| Tech Lead | [Your Name] | [Email] | Technical issues |
| Azure Support | Microsoft | 1-800-MICROSOFT | Infrastructure issues |
| Security Team | [Security Contact] | [Email] | Security incidents |
| On-Call Engineer | [Rotation] | [Phone] | After hours emergencies |

---

## 📚 References

- [HIPAA Compliance Guide](https://www.hhs.gov/hipaa/for-professionals/security/guidance/index.html)
- [Azure Security Best Practices](https://docs.microsoft.com/en-us/azure/security/fundamentals/best-practices-and-patterns)
- [OWASP Security Guidelines](https://owasp.org/www-project-top-ten/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [Stripe Security](https://stripe.com/docs/security/stripe)

---

**Document Status:** APPROVED FOR IMPLEMENTATION  
**Risk Assessment:** HIGH - Medical data and payment processing  
**Estimated Timeline:** 21 days  
**Budget Impact:** $75/month operational cost  
**Rollback Time:** < 5 minutes  

**Approval:** _______________________  
**Date:** August 13, 2025

---

*This strategy prioritizes SAFETY over SPEED. Every step is reversible. Production stability is paramount.*
