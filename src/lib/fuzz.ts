import { BrowserContextOptions, LaunchOptions, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { generateData, runScript } from "./generator";
import { createBrowserPage } from "./browser";
import {
  getRecords,
  makeAllFunctionRecorded,
  startRecording,
  stopRecording,
} from "./recorder";
import diff from "fast-diff";

export async function fuzz(
  pathToScriptFile: string,
  scenario: (page: Page) => Promise<void> = () => {
    return new Promise<void>((resolve) => {
      resolve();
    });
  },
  dataNum: number = 20,
  browserOptions: {
    launchOptions?: LaunchOptions;
    contextOptions?: BrowserContextOptions;
  } = {
    launchOptions: { headless: false },
  }
) {
  console.log("generate fuzz data👶");
  const dataDir = generateData(dataNum);

  console.log("setup browser🌐");
  const page = await createBrowserPage(browserOptions);

  console.log("validate test cases🔍");
  await removeInvalidCases(dataDir, page);

  console.log("run test cases🏃");
  await run(pathToScriptFile, dataDir, page, scenario);

  console.log("done. closing browser👋");
  await page.close();
  await page.context().close();
  await page.context().browser()?.close();
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
    console.log(`validate case: ${files[i]}`);
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
  pathToScriptFile: string,
  dataDir: string,
  page: Page,
  scenario: (page: Page) => Promise<void>
) {
  const files = fs.readdirSync(dataDir);

  for (let i = 0; i < files.length; i++) {
    console.log("run test: ", files[i]);
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

      const recordsWithoutScript = await page.evaluate<string>(
        `(${getRecords.toString()})()`,
        { timeout }
      );

      // run with script
      await page.goto("file://" + path.resolve(dataDir, files[i]), {
        timeout: timeout * 2,
        waitUntil: "load",
      });

      await page.addScriptTag({
        path: path.resolve(__dirname, pathToScriptFile),
      });
      await scenario(page);

      await page.evaluate(`(${makeAllFunctionRecorded.toString()})()`);
      await page.evaluate(`(${startRecording.toString()})()`);
      await page.evaluate(`(${runScript.toString()})()`);
      await page.evaluate(`(${stopRecording.toString()})()`);

      const recordsWithScript = await page.evaluate<string>(
        `(${getRecords.toString()})()`,
        { timeout }
      );

      // compare
      if (recordsWithoutScript === recordsWithScript) {
        console.log(`\tresult: ❌ found different records`);
        writeResultToFile(
          i.toString(),
          recordsWithoutScript,
          recordsWithScript
        );
      } else {
        console.log(`\tresult: 🟢 no different records = no effect`);
      }
    } catch (e) {
      console.log(`\terror: ${e}`);
    }
  }
}

function writeResultToFile(
  filePrefix: string,
  resultWithoutScript: string,
  resultWithScript: string
) {
  const outputDirPath = path.join(process.cwd(), "fuzz");

  fs.writeFileSync(
    path.join(outputDirPath, `${filePrefix}-without-script.txt`),
    resultWithoutScript.replaceAll(`"},{"name`, `"},\n{"name`)
  );
  fs.writeFileSync(
    path.join(outputDirPath, `${filePrefix}-with-script.txt`),
    resultWithScript.replaceAll(`"},{"name`, `"},\n{"name`)
  );
  const resultDiff = diff(resultWithoutScript, resultWithScript);
  fs.writeFileSync(
    path.join(outputDirPath, `${filePrefix}-resultDiff.txt`),
    resultDiff
      .map(([type, value]) => {
        if (type === 0) {
          return value;
        } else if (type === 1) {
          return `\n\n\n\n\n\n+${value}\n\n\n\n\n\n`;
        } else if (type === -1) {
          return `\n\n\n\n\n\n-${value}\n\n\n\n\n\n`;
        }
      })
      .join("")
  );
}
