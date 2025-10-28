const panRegex = /\b\d{13,19}\b/g;
const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export function redactValue (input) {
  if (typeof input === 'string') {
    return input
      .replace(panRegex, '****REDACTED****')
      .replace(emailRegex, (match) => {
        const [user, domain] = match.split('@');
        const maskedUser = user.length <= 2 ? '**' : `${user[0]}***${user[user.length - 1]}`;
        return `${maskedUser}@${domain}`;
      });
  }
  if (Array.isArray(input)) return input.map(redactValue);
  if (input && typeof input === 'object') {
    return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, redactValue(value)]));
  }
  return input;
}

export default function redactMiddleware (req, res, next) {
  req.masked = true;
  req.redact = redactValue;
  res.locals.redact = redactValue;
  return next();
}
