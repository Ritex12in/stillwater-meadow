import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8080',
    channel: 'chrome', // uses the installed Chrome; no browser download needed
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] },
  },
  // Start the dev server unless one is already running (set PW_NO_SERVER=1 to always use an existing one).
  webServer: process.env.PW_NO_SERVER ? undefined : { command: 'npm run dev', url: 'http://127.0.0.1:8080', reuseExistingServer: true, timeout: 60_000 },
});
