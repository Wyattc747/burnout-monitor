/**
 * Database Migration Script
 * Creates all tables from schema files
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const db = require('../src/utils/db');

async function migrate() {
  console.log('Starting database migration...\n');

  try {
    // Read and execute main schema
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    console.log('Running schema.sql...');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await db.query(schema);
    console.log('  Schema created successfully\n');

    // Run migrations in order
    const migrationsDir = path.join(__dirname, '../../database/migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        console.log(`Running ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await db.query(sql);
        console.log(`  ${file} completed`);
      }
    }

    console.log('\nMigration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
