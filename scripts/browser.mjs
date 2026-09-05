import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';

/** Prefer an explicit browser, then macOS Chrome, then Playwright Chromium. */
export function launchBrowser() {
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const executablePath = process.env.CHROME_PATH || (process.platform === 'darwin' && existsSync(macChrome) ? macChrome : undefined);
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--enable-webgl', '--ignore-gpu-blocklist'],
  });
}
