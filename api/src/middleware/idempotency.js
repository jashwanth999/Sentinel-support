import { getRedis } from '../lib/redis.js';

function getKey (req) {
  const key = req.header('Idempotency-Key');
  if (!key) return null;
  return `idem:${key}`;
}

export default function idempotencyMiddleware () {
  return async function handleIdempotency (req, res, next) {
    const key = getKey(req);
    if (!key) return next();
    try {
      const redis = await getRedis();
      const cached = await redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        res.set(parsed.headers || {});
        return res.status(parsed.status).json(parsed.body);
      }
      const originalJson = res.json.bind(res);
      res.json = function patchedJson (body) {
        const payload = JSON.stringify({
          status: res.statusCode,
          body,
          headers: Object.fromEntries(Object.entries(res.getHeaders()))
        });
        redis.set(key, payload, 'PX', 24 * 60 * 60 * 1000);
        return originalJson(body);
      };
      return next();
    } catch (err) {
      return next();
    }
  };
}
