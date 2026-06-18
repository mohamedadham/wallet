/**
 * Typed view over validated environment variables.
 * Validation itself lives in `env.validation.ts`; by the time this runs the
 * values are guaranteed present and well-formed, so we can read them directly.
 */
export type StoreDriver = 'postgres' | 'memory';

export interface AppConfig {
  env: string;
  port: number;
  logLevel: string;
  storeDriver: StoreDriver;
  databaseUrl?: string;
  maxBatchSize: number;
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  storeDriver: (process.env.STORE_DRIVER ?? 'postgres') as StoreDriver,
  databaseUrl: process.env.DATABASE_URL,
  maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE ?? '1000', 10),
});
