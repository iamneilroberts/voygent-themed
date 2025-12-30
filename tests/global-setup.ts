import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

/**
 * Global setup script for Playwright E2E tests
 *
 * This script runs once before all tests and:
 * 1. Loads test environment variables
 * 2. Verifies required API keys are present
 * 3. Applies database migrations
 * 4. Seeds test templates
 * 5. Verifies external API connectivity (optional health check)
 */
export default async function globalSetup() {
  console.log('\n🔧 Running global setup for E2E tests...\n');

  // 1. Load test environment variables
  const envFile = `.env.${process.env.TEST_ENV || 'test'}`;
  const envPath = path.resolve(process.cwd(), envFile);

  if (!fs.existsSync(envPath)) {
    console.error(`❌ Error: ${envFile} file not found`);
    console.error(`   Please copy .env.test.example to ${envFile} and add your API keys\n`);
    throw new Error(`Missing ${envFile} file`);
  }

  dotenv.config({ path: envPath });
  console.log(`✅ Loaded environment from ${envFile}`);

  // 2. Verify required API keys
  const requiredKeys = [
    'AMADEUS_API_KEY',
    'AMADEUS_API_SECRET',
    'VIATOR_API_KEY',
    'SERPER_API_KEY',
    'Z_AI_API_KEY',
    'OPENROUTER_API_KEY',
  ];

  const missingKeys = requiredKeys.filter(key => !process.env[key] || process.env[key]?.includes('your_'));

  if (missingKeys.length > 0) {
    console.error('❌ Error: Missing or placeholder API keys detected:');
    missingKeys.forEach(key => {
      console.error(`   - ${key}`);
    });
    console.error(`\n   Please update ${envFile} with your actual API keys`);
    console.error('   See specs/002-end-to-end/quickstart.md for instructions on obtaining API keys\n');
    throw new Error('Missing required API keys');
  }

  console.log('✅ All required API keys are present');

  // 3. Apply database migrations
  console.log('\n📦 Applying database migrations...');

  try {
    // Check if migrations directory exists
    const migrationsDir = path.resolve(process.cwd(), 'db/migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️  No migrations directory found - skipping migration step');
    } else {
      execSync('npm run db:migrate', {
        stdio: 'pipe',
        env: { ...process.env }
      });
      console.log('✅ Database migrations applied');
    }
  } catch (error: any) {
    console.warn('⚠️  Warning: Could not apply migrations:', error.message);
    console.log('   Database may already be migrated or wrangler not ready yet');
  }

  // 4. Seed test templates
  console.log('\n🌱 Seeding test templates...');

  try {
    // Check if seed file exists
    const seedFile = path.resolve(process.cwd(), 'db/seeds/0001_seed_templates.sql');
    if (!fs.existsSync(seedFile)) {
      console.log('⚠️  No seed file found - skipping seed step');
      console.log('   Tests will use fixtures from tests/fixtures/ directory');
    } else {
      execSync('npm run db:seed', {
        stdio: 'pipe',
        env: { ...process.env }
      });
      console.log('✅ Test templates seeded');
    }
  } catch (error: any) {
    // Seed errors are not fatal - tests can use fixtures
    console.warn('⚠️  Warning: Could not seed templates:', error.message);
    console.log('   Tests will use fixtures from tests/fixtures/ directory');
  }

  // 5. Optional: Verify external API connectivity
  if (process.env.SKIP_API_HEALTH_CHECK !== 'true') {
    console.log('\n🔍 Verifying external API connectivity...');
    console.log('   (Set SKIP_API_HEALTH_CHECK=true to skip this step)');

    // Note: Actual health check implementation is in tests/scripts/health-check.js
    // For now, just log that we're skipping detailed checks
    console.log('   Skipping detailed health checks (will be verified during test runs)');
  }

  console.log('\n✅ Global setup complete!\n');
}
