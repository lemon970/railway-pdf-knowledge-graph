import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e-production',
  outputDir: '../output/playwright/production-test-results',
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:8027',
    locale: 'zh-CN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'production-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      '.venv\\Scripts\\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8027',
    cwd: '..',
    url: 'http://127.0.0.1:8027/docs',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
