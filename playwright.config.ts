import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables from .env.test file
dotenv.config({ path: `.env.${process.env.TEST_ENV || 'test'}` });

/**
 * Playwright configuration for VoyGent V3 E2E test suite
 *
 * This configuration:
 * - Runs tests against a local Cloudflare Pages dev server
 * - Uses real external APIs (Amadeus, Viator, Serper, Z.AI, OpenRouter)
 * - Tests across multiple viewports (desktop, mobile 320px, tablet 768px, desktop 1024px)
 * - Implements retry strategy for flaky tests (max 2 retries)
 * - Captures traces and screenshots on first retry for debugging
 * - Supports parallel test execution with 4 workers
 */
export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Maximum time one test can run
  timeout: 120000, // 2 minutes per test (allows for real API calls)

  // Maximum time for expect() assertions
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in source code
  forbidOnly: !!process.env.CI,

  // Retry on CI and locally for flaky test detection
  retries: process.env.CI ? 2 : 2,

  // Opt out of parallel tests on CI (to reduce API rate limiting)
  workers: process.env.CI ? 2 : 4,

  // Reporter configuration
  reporter: [
    // Console output during test run
    ['list'],

    // HTML report for visual inspection
    ['html', {
      outputFolder: 'playwright-report',
      open: 'never' // Don't auto-open in CI
    }],

    // JSON report for programmatic analysis
    ['json', {
      outputFile: 'test-results/results.json'
    }],

    // GitHub Actions annotations (only in CI)
    ...(process.env.CI ? [['github' as const]] : []),
  ],

  // Shared settings for all projects
  use: {
    // Base URL for tests
    baseURL: process.env.APP_URL || 'http://localhost:8788',

    // Collect trace on first retry for debugging
    trace: 'on-first-retry',

    // Screenshot only on failure
    screenshot: 'only-on-failure',

    // Video only on first retry
    video: 'retain-on-failure',

    // Maximum time for page.goto()
    navigationTimeout: 30000, // 30 seconds

    // Maximum time for actions (click, fill, etc.)
    actionTimeout: 10000, // 10 seconds
  },

  // Configure projects for different viewports
  projects: [
    // Desktop Chrome (standard viewport)
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },

    // Mobile viewport - 320px (smallest mobile device)
    // Tests mobile-first responsive design at minimum width
    {
      name: 'mobile-320px',
      use: {
        ...devices['iPhone SE'],
        viewport: { width: 320, height: 568 },
        isMobile: true,
        hasTouch: true,
      },
    },

    // Tablet viewport - 768px (iPad Mini)
    // Tests tablet breakpoint
    {
      name: 'tablet-768px',
      use: {
        ...devices['iPad Mini'],
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
      },
    },

    // Desktop viewport - 1024px (common laptop size)
    // Tests desktop breakpoint
    {
      name: 'desktop-1024px',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
      },
    },
  ],

  // Web server configuration
  // Automatically starts wrangler dev server before tests
  // Disabled when testing against external URL (staging/production)
  webServer: process.env.APP_URL?.startsWith('http') && !process.env.APP_URL?.includes('localhost')
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:8788',
        timeout: 120000, // 2 minutes to start server
        reuseExistingServer: !process.env.CI, // Reuse server in local dev
        stdout: 'pipe', // Capture server output
        stderr: 'pipe',
      },

  // Global setup and teardown scripts
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
});
