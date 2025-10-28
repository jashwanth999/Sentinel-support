import { redactValue } from '../../middleware/redact.js';

export function redactPayload (payload) {
  return redactValue(payload);
}

export default { redactPayload };
