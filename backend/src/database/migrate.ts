import fs from 'fs';
import path from 'path';
import { db } from './connection';
import logger from '../utils/logger';

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');

    // Create migrations tracking table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      logger.warn('Migrations directory not found');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      logger.warn('No migration files found');
      return;
    }

    // Get already-applied migrations
    const appliedResult = await db.query('SELECT filename FROM schema_migrations');
    const applied = new Set(appliedResult.rows.map((r: any) => r.filename));

    const pending = files.filter(f => !applied.has(f));
    logger.info(`Found ${files.length} migration file(s), ${pending.length} pending`);

    if (pending.length === 0) {
      logger.info('All migrations already applied');
      process.exit(0);
      return;
    }

    for (const file of pending) {
      logger.info(`Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await db.query(sql);
        await db.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        logger.info(`✓ Migration ${file} completed`);
      } catch (error) {
        logger.error(`✗ Migration ${file} failed:`, error);
        throw error;
      }
    }

    logger.info('All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
