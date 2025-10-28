import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const {
  DATABASE_URL,
  PGHOST,
  PGPORT,
  PGUSER,
  PGPASSWORD,
  PGDATABASE,
  NODE_ENV
} = process.env;

const connectionString = DATABASE_URL || (PGHOST
  ? `postgresql://${PGUSER || 'sentinel'}:${encodeURIComponent(PGPASSWORD || 'sentinel')}@${PGHOST}:${PGPORT || 5432}/${PGDATABASE || 'sentinel'}`
  : null);

const pool = new pg.Pool({
  connectionString,
  max: NODE_ENV === 'production' ? 20 : 10,
  idleTimeoutMillis: 30_000
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err); // eslint-disable-line no-console
});

export default pool;
