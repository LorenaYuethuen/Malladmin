import bcrypt from 'bcrypt';
import { db } from './connection';
import logger from '../utils/logger';

async function seed() {
  try {
    logger.info('Starting database seeding...');

    // Hash password for admin user
    const adminPassword = 'admin123';
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    const userResult = await db.query(
      `INSERT INTO users (username, email, password_hash, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE 
       SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      ['admin', 'admin@example.com', passwordHash, 'active']
    );

    const userId = userResult.rows[0].id;
    logger.info(`Admin user created/updated with ID: ${userId}`);

    // Get admin role
    const roleResult = await db.query(
      `SELECT id FROM roles WHERE name = $1`,
      ['admin']
    );

    if (roleResult.rows.length > 0) {
      const roleId = roleResult.rows[0].id;

      // Assign admin role to user
      await db.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, roleId]
      );

      logger.info('Admin role assigned to user');
    }

    // Create test merchant user
    const merchantPassword = 'merchant123';
    const merchantPasswordHash = await bcrypt.hash(merchantPassword, 10);

    const merchantResult = await db.query(
      `INSERT INTO users (username, email, password_hash, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE 
       SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      ['merchant', 'merchant@example.com', merchantPasswordHash, 'active']
    );

    const merchantUserId = merchantResult.rows[0].id;
    logger.info(`Merchant user created/updated with ID: ${merchantUserId}`);

    // Get merchant role
    const merchantRoleResult = await db.query(
      `SELECT id FROM roles WHERE name = $1`,
      ['merchant']
    );

    if (merchantRoleResult.rows.length > 0) {
      const merchantRoleId = merchantRoleResult.rows[0].id;

      // Assign merchant role to user
      await db.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [merchantUserId, merchantRoleId]
      );

      logger.info('Merchant role assigned to user');
    }

    // Create test consumer user
    const consumerPassword = 'consumer123';
    const consumerPasswordHash = await bcrypt.hash(consumerPassword, 10);

    const consumerResult = await db.query(
      `INSERT INTO users (username, email, password_hash, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE 
       SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      ['consumer', 'consumer@example.com', consumerPasswordHash, 'active']
    );

    const consumerUserId = consumerResult.rows[0].id;
    logger.info(`Consumer user created/updated with ID: ${consumerUserId}`);

    // Get consumer role
    const consumerRoleResult = await db.query(
      `SELECT id FROM roles WHERE name = $1`,
      ['consumer']
    );

    if (consumerRoleResult.rows.length > 0) {
      const consumerRoleId = consumerRoleResult.rows[0].id;

      // Assign consumer role to user
      await db.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [consumerUserId, consumerRoleId]
      );

      logger.info('Consumer role assigned to user');
    }

    logger.info('Database seeding completed successfully!');
    logger.info('\nTest Users:');
    logger.info('  Admin: admin@example.com / admin123');
    logger.info('  Merchant: merchant@example.com / merchant123');
    logger.info('  Consumer: consumer@example.com / consumer123');

    process.exit(0);
  } catch (error) {
    logger.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
