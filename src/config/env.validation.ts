/**
 * Boot-time environment validation (no external schema lib needed).
 *
 * Called by ConfigModule's `validate` hook: the app fails to start if config is
 * missing/invalid — a missing DATABASE_URL in postgres mode is a crash, not a
 * runtime surprise. (Security §: all config from the environment, validated here.)
 */
export interface ValidatedEnv {
  NODE_ENV: string;
  PORT: number;
  LOG_LEVEL: string;
  STORE_DRIVER: 'postgres' | 'memory';
  DATABASE_URL?: string;
  MAX_BATCH_SIZE: number;
}

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
  const errors: string[] = [];

  const NODE_ENV = str(config.NODE_ENV, 'development');
  if (!['development', 'test', 'production'].includes(NODE_ENV)) {
    errors.push(`NODE_ENV must be development|test|production (got "${NODE_ENV}")`);
  }

  const LOG_LEVEL = str(config.LOG_LEVEL, 'info');

  const STORE_DRIVER = str(config.STORE_DRIVER, 'postgres');
  if (!['postgres', 'memory'].includes(STORE_DRIVER)) {
    errors.push(`STORE_DRIVER must be postgres|memory (got "${STORE_DRIVER}")`);
  }

  const PORT = int(config.PORT, 3000);
  if (PORT < 1 || PORT > 65535) errors.push(`PORT must be a valid port (got "${config.PORT}")`);

  const MAX_BATCH_SIZE = int(config.MAX_BATCH_SIZE, 1000);
  if (MAX_BATCH_SIZE < 1) errors.push('MAX_BATCH_SIZE must be >= 1');

  const DATABASE_URL = config.DATABASE_URL ? String(config.DATABASE_URL) : undefined;
  if (STORE_DRIVER === 'postgres') {
    if (!DATABASE_URL) {
      errors.push('DATABASE_URL is required when STORE_DRIVER=postgres');
    } else if (!/^postgres(ql)?:\/\//.test(DATABASE_URL)) {
      errors.push('DATABASE_URL must be a postgres:// connection string');
    }
  }

  if (errors.length) {
    throw new Error(`Invalid environment configuration:\n  - ${errors.join('\n  - ')}`);
  }

  return {
    NODE_ENV,
    PORT,
    LOG_LEVEL,
    STORE_DRIVER: STORE_DRIVER as 'postgres' | 'memory',
    DATABASE_URL,
    MAX_BATCH_SIZE,
  };
}

function str(value: unknown, fallback: string): string {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

function int(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? fallback : n;
}
