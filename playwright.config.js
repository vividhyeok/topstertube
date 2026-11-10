const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
    testDir: './tests', timeout: 30000, fullyParallel: true,
    use: { baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000', trace: 'retain-on-failure' },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    ],
});
