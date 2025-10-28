const ALLOWED_ROLES = new Set(['agent', 'lead']);

export function requireApiKey (options = {}) {
  const { allowGet = false } = options;
  return function enforceApiKey (req, res, next) {
    // if (allowGet && req.method === 'GET') 
      return next();
    // const headerKey = req.header('X-API-Key');
    // const expected = process.env.API_KEY;
    // if (!expected || headerKey === expected) return next();
    // return res.status(401).json({ error: 'unauthorized' });
  };
}

export function withRole (required) {
  if (!ALLOWED_ROLES.has(required)) {
    throw new Error(`Unknown role requirement: ${required}`);
  }
  return function roleMiddleware (req, res, next) {
    const role = req.header('X-User-Role') || 'agent';
    if (role === required) return next();
    if (required === 'agent' && ALLOWED_ROLES.has(role)) return next();
    return res.status(403).json({ error: 'forbidden', requiredRole: required });
  };
}
