import { rateLimitBlocked } from '../lib/metrics.js';
import { getRedis } from '../lib/redis.js';

const MAX_TOKENS = 5;
const REFILL_RATE = 5; // tokens per second

export default function redisRateLimit () {
  return async function rateLimitMiddleware (req, res, next) {
    try {
      const redis = await getRedis();
      const key = `rate:${req.ip}`;
      const now = Date.now();

      const script = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local rate = tonumber(ARGV[2])
        local burst = tonumber(ARGV[3])
        local ttl = tonumber(ARGV[4])

        local data = redis.call("HMGET", key, "tokens", "timestamp")
        local tokens = tonumber(data[1]) or burst
        local last = tonumber(data[2]) or now

        local delta = math.max(0, now - last)
        local refill = delta * rate / 1000
        tokens = math.min(burst, tokens + refill)

        if tokens < 1 then
          redis.call("HMSET", key, "tokens", tokens, "timestamp", now)
          redis.call("PEXPIRE", key, ttl)
          return {0, tokens}
        end

        tokens = tokens - 1
        redis.call("HMSET", key, "tokens", tokens, "timestamp", now)
        redis.call("PEXPIRE", key, ttl)
        return {1, tokens}
      `;

      const [allowed] = await redis.eval(script, 1, key, now, REFILL_RATE, MAX_TOKENS, 2_000);

      if (allowed === 1) return next();

      rateLimitBlocked.inc({ type: 'token_bucket' });
      res.setHeader('Retry-After', '1');
      return res.status(429).json({ error: 'rate_limited', retryAfter: 1 });
    } catch (err) {
      // Fail open on redis issues
      return next();
    }
  };
}
