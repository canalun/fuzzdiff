import { BrowserContextOptions, LaunchOptions, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { generateData, runScript } from "./generator";
import { createBrowserPage } from "./playwright";
import {
  getRecords,
  makeAllFunctionRecorded,
  startRecording,
  stopRecording,
} from "./recorder";

export async function fuzz(
  scriptFile: string,
  scenario: (page: Page) => Promise<void> = () => {
    return new Promise<void>((resolve) => {
      resolve();
    });
  },
  browserOptions: {
    launchOptions?: LaunchOptions;
    contextOptions?: BrowserContextOptions;
  } = {},
  dataNum: number = 100
) {
  const dataDir = generateData(dataNum);

  const page = await createBrowserPage(browserOptions);

  removeInvalidCases(dataDir, page);

  run(scriptFile, dataDir, page, scenario);
}

declare global {
  interface Window {
    // please see domato template.html
    jsfuzzer: () => void;
  }
}

const timeout = 2000;
async function removeInvalidCases(dataDir: string, page: Page) {
  const files = fs.readdirSync(dataDir);

  for (let i = 0; i < files.length; i++) {
    try {
      await page.goto("file://" + path.resolve(dataDir, files[i]), {
        timeout,
        waitUntil: "load",
      });
      await page.evaluate(`(${makeAllFunctionRecorded.toString()})()`);
      await page.evaluate(`(${startRecording.toString()})()`);
      await page.evaluate(`(${runScript.toString()})()`);
      await page.evaluate(`(${stopRecording.toString()})()`);
      await page.evaluate(`(${getRecords.toString()})()`, { timeout });
    } catch (e) {
      console.log(`remove invalid case: ${files[i]}`);
      console.log(`\terror: ${e}`);
      fs.unlinkSync(path.resolve(dataDir, files[i]));
    }
  }
}

async function run(
  scriptFile: string,
  dataDir: string,
  page: Page,
  scenario: (page: Page) => Promise<void>
) {
  const files = fs.readdirSync(dataDir);

  for (let i = 0; i < files.length; i++) {
    try {
      // run without script
      await page.goto("file://" + path.resolve(dataDir, files[i]), {
        timeout: timeout * 2,
        waitUntil: "load",
      });

      await page.evaluate(`(${makeAllFunctionRecorded.toString()})()`);
      await page.evaluate(`(${startRecording.toString()})()`);
      await page.evaluate(`(${runScript.toString()})()`);
      await page.evaluate(`(${stopRecording.toString()})()`);

      const recordsWithoutScript = await page.evaluate<
        ReturnType<typeof getRecords>
      >(`(${getRecords.toString()})()`, { timeout });

      // run with script
      await page.goto("file://" + path.resolve(dataDir, files[i]), {
        timeout: timeout * 2,
        waitUntil: "load",
      });

      await page.addScriptTag({ path: path.resolve(__dirname, scriptFile) });
      await scenario(page);

      await page.evaluate(`(${makeAllFunctionRecorded.toString()})()`);
      await page.evaluate(`(${startRecording.toString()})()`);
      await page.evaluate(`(${runScript.toString()})()`);
      await page.evaluate(`(${stopRecording.toString()})()`);

      const recordsWithScript = await page.evaluate<
        ReturnType<typeof getRecords>
      >(`(${getRecords.toString()})()`, { timeout });

      // compare
      let isDifferent = false;
      for (let j = 0; j < recordsWithoutScript.length; j++) {
        if (recordsWithoutScript[j] !== recordsWithScript[j]) {
          isDifferent = true;
          console.log(`run test: ${files[i]}`);
          console.log(`\tresult: ❌ found different records`);
          break;
        }
      }
      if (!isDifferent) {
        console.log(`run test: ${files[i]}`);
        console.log(`\tresult: 🟢 no different records = no effect`);
      }
    } catch (e) {
      console.log(`run test: ${files[i]}`);
      console.log(`\terror: ${e}`);
    }
  }
}
