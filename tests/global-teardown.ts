import * as fs from 'fs';
import * as path from 'path';

/**
 * Global teardown script for Playwright E2E tests
 *
 * This script runs once after all tests complete and:
 * 1. Generates test summary report
 * 2. Cleans up temporary test data (optional)
 * 3. Archives test results for future reference
 * 4. Displays production readiness assessment
 */
export default async function globalTeardown() {
  console.log('\n🧹 Running global teardown for E2E tests...\n');

  // 1. Check if test results exist
  const resultsPath = path.resolve(process.cwd(), 'test-results/results.json');

  if (fs.existsSync(resultsPath)) {
    console.log('✅ Test results generated at test-results/results.json');

    try {
      // Read and parse test results
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

      // Display basic summary
      console.log('\n📊 Test Summary:');
      console.log(`   Total tests: ${results.suites?.length || 0} suites`);

      // Note: Full production readiness assessment is handled by custom reporters
      // This is just a basic cleanup and summary step
    } catch (error) {
      console.warn('⚠️  Could not parse test results:', error);
    }
  } else {
    console.log('⚠️  No test results found (tests may not have run)');
  }

  // 2. Clean up temporary test data (optional)
  if (process.env.CLEANUP_TEST_DATA === 'true') {
    console.log('\n🗑️  Cleaning up temporary test data...');

    // Note: Test-level cleanup is handled by test fixtures
    // This is for global cleanup only (e.g., temp files, logs)

    const tempDirs = [
      path.resolve(process.cwd(), '.tmp'),
      path.resolve(process.cwd(), 'tests/.tmp'),
    ];

    tempDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`   Removed ${dir}`);
      }
    });

    console.log('✅ Cleanup complete');
  }

  // 3. Archive test results (optional)
  if (process.env.ARCHIVE_TEST_RESULTS === 'true') {
    console.log('\n📦 Archiving test results...');

    const archiveDir = path.resolve(process.cwd(), 'test-results/archive');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const archivePath = path.join(archiveDir, `results-${timestamp}.json`);

    if (fs.existsSync(resultsPath)) {
      fs.copyFileSync(resultsPath, archivePath);
      console.log(`✅ Archived to ${archivePath}`);
    }
  }

  // 4. Display production readiness message
  console.log('\n📋 Production Readiness:');
  console.log('   View detailed report with: npm run test:e2e -- --reporter=html');
  console.log('   Or open: test-results/html-report/index.html');
  console.log('');
  console.log('   Production ready when:');
  console.log('   • P1 pass rate = 100%');
  console.log('   • P2 pass rate ≥ 95%');
  console.log('   • Flakiness rate < 5%');

  console.log('\n✅ Global teardown complete!\n');
}
