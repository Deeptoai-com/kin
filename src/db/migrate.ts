/**
 * Database Migration Utility
 * 
 * Programmatically runs Drizzle migrations using the migrator API.
 * This is used for automatic migrations on application startup.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run database migrations
 * 
 * @param options - Migration options
 * @param options.migrationsFolder - Path to migrations folder (default: ./drizzle)
 * @param options.connectionString - Database connection string (default: DATABASE_URL env var)
 * @returns Promise that resolves when migrations complete
 */
export async function runMigrations(options?: {
  migrationsFolder?: string;
  connectionString?: string;
}): Promise<void> {
  const connectionString = options?.connectionString || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined. Cannot run migrations.');
  }

  // Use migrations folder relative to project root
  const migrationsFolder = options?.migrationsFolder || join(__dirname, '../../drizzle');

  console.log('[Migration] Starting database migrations...');
  console.log('[Migration] Migrations folder:', migrationsFolder);
  console.log('[Migration] Database:', connectionString.replace(/:[^:@]+@/, ':****@')); // Hide password

  // Create a connection specifically for migrations (with max: 1 to avoid connection pool issues)
  const migrationClient = postgres(connectionString, { max: 1 });
  const migrationDb = drizzle(migrationClient);

  try {
    const start = Date.now();
    
    await migrate(migrationDb, { migrationsFolder });
    
    const end = Date.now();
    const duration = end - start;

    console.log(`[Migration] ✅ Migrations completed successfully in ${duration}ms`);
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    throw error;
  } finally {
    // Close the migration connection
    await migrationClient.end();
  }
}

/**
 * Check if migrations should run automatically
 * 
 * Set AUTO_MIGRATE=false to disable automatic migrations (useful for production where
 * migrations are run separately via Docker Compose or CI/CD)
 */
export function shouldAutoMigrate(): boolean {
  // Default to true in development, false in production
  // Can be overridden with AUTO_MIGRATE environment variable
  const autoMigrateEnv = process.env.AUTO_MIGRATE;
  
  if (autoMigrateEnv !== undefined) {
    return autoMigrateEnv.toLowerCase() === 'true';
  }

  // Auto-migrate in development, but not in production (production should use Docker Compose migrate service)
  return process.env.NODE_ENV !== 'production';
}

/**
 * Run migrations if auto-migration is enabled
 * 
 * This is the main function to call from application startup.
 * It checks if auto-migration is enabled and runs migrations if needed.
 */
export async function autoMigrate(): Promise<void> {
  if (!shouldAutoMigrate()) {
    console.log('[Migration] Auto-migration is disabled (set AUTO_MIGRATE=true to enable)');
    return;
  }

  try {
    await runMigrations();
  } catch (error) {
    // In development, we want to fail fast if migrations fail
    // In production, we might want to continue (migrations should be run separately)
    if (process.env.NODE_ENV === 'production') {
      console.error('[Migration] ⚠️  Migration failed, but continuing startup (migrations should be run separately in production)');
    } else {
      console.error('[Migration] ❌ Migration failed, aborting startup');
      throw error;
    }
  }
}
