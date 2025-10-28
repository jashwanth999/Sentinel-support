import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, coerceTypes: true, removeAdditional: 'failing' });
addFormats(ajv);

export function validateSchema (schema, data) {
  const validate = ajv.compile(schema);
  const ok = validate(data);
  return { ok, errors: validate.errors };
}

export default ajv;
