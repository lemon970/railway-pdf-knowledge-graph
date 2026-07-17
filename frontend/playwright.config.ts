import { defineConfig, devices } from '@playwright/test'
import { shouldReusePlaywrightServer } from './playwrightServerReuse'

export default defineConfig({
  testDir: './e2e',
  outputDir: '../output/playwright/test-results',
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: shouldReusePlaywrightServer(process.env.PW_REUSE_SERVER),
  },
})
