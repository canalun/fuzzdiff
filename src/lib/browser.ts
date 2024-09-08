import {
  BrowserContextOptions,
  LaunchOptions,
  chromium,
} from "@playwright/test";

export const createBrowserContext = async (options?: {
  launchOptions?: LaunchOptions;
  contextOptions?: BrowserContextOptions;
}) => {
  const browser = await chromium.launch(options?.launchOptions);
  const context = await browser.newContext(options?.contextOptions);
  return context;
};
