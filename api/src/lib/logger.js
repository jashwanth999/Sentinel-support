import pino from 'pino';
import pinoHttp from 'pino-http';

const level = process.env.LOG_LEVEL || 'info';

export const baseLogger = pino({
  level,
  formatters: {
    level: (label) => ({ level: label })
  },
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization'],
    remove: true
  }
});

export function httpLogger () {
  return pinoHttp({
    logger: baseLogger,
    customLogLevel: (res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage (req, res) {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    serializers: {
      req (req) {
        return {
          method: req.method,
          url: req.url,
          requestId: req.id,
          customerId_masked: req.headers['x-customer-mask'] || null
        };
      }
    }
  });
}

export default baseLogger;
