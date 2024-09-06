import { Page } from "@playwright/test";
import diff from "fast-diff";
import fs from "fs";
import path from "path";
import { createBrowserPage } from "./browser";
import { generateData, runScript } from "./generator";
import { getMergedOptions, UserOptions } from "./options";
import {
  getAPIRecords,
  makeAllFunctionRecorded,
  startRecording,
  stopRecording,
} from "./recorder";

export async function fuzz(_options: UserOptions) {
  const options = getMergedOptions(_options);

  console.log("generate fuzz data👶");
  const dataDir = generateData(options.dataNum);

  console.log("setup browser🌐");
  const page = await createBrowserPage(options.browserOptions);

  console.log("validate test cases🔍");
  await removeInvalidCases(dataDir, page);

  console.log("run test cases🏃");
  await run(options.pathToScriptFile, dataDir, page, options.scenario);

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

const TIMEOUT = 2000;
async function removeInvalidCases(dataDir: string, page: Page) {
  const files = fs.readdirSync(dataDir);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`validate case: ${file}`);
    try {
      const record1 = await goThrough(dataDir, file, page);
      const record2 = await goThrough(dataDir, file, page);
      const record3 = await goThrough(dataDir, file, page);
      if (
        record1.length !== record2.length ||
        record2.length !== record3.length
      ) {
        throw new Error("flaky case");
      }
    } catch (e) {
      console.log(`remove invalid case: ${files[i]}`);
      console.log(`\terror: ${e}`);
      fs.unlinkSync(path.resolve(dataDir, files[i]));
    }
  }
}

async function goThrough(dataDir: string, file: string, page: Page) {
  await page.goto("file://" + path.resolve(dataDir, file), {
    timeout: TIMEOUT,
    waitUntil: "load",
  });
  await page.evaluate(`(${makeAllFunctionRecorded.toString()})()`);
  await page.evaluate(`(${startRecording.toString()})()`);
  await page.evaluate(`(${runScript.toString()})()`);
  await page.evaluate(`(${stopRecording.toString()})()`);
  const records = await page.evaluate<ReturnType<typeof getAPIRecords>>(
    `(${getAPIRecords.toString()})()`,
    { timeout: TIMEOUT }
  );
  return records;
}

async function run(
  pathToScriptFile: string,
  dataDir: string,
  page: Page,
  scenario: (page: Page) => Promise<void>
) {
  const files = fs.readdirSync(dataDir);

  console.log("test cases: ", files.join("\n"));

  for (let i = 0; i < files.length; i++) {
    console.log("run test: ", files[i]);
    try {
      // run without script
      await page.goto("file://" + path.resolve(dataDir, files[i]), {
        timeout: TIMEOUT * 2,
        waitUntil: "load",
      });

      await page.evaluate(`(${makeAllFunctionRecorded.toString()})()`);
      await page.evaluate(`(${startRecording.toString()})()`);
      await page.evaluate(`(${runScript.toString()})()`);
      await page.evaluate(`(${stopRecording.toString()})()`);

      const recordsWithoutScript = await page.evaluate<
        ReturnType<typeof getAPIRecords>
      >(`(${getAPIRecords.toString()})()`, { timeout: TIMEOUT });

      // run with script
      await page.goto("file://" + path.resolve(dataDir, files[i]), {
        timeout: TIMEOUT * 2,
        waitUntil: "load",
      });

      await page.addScriptTag({
        path: path.resolve(process.cwd(), pathToScriptFile),
      });
      await scenario(page);

      await page.evaluate(`(${makeAllFunctionRecorded.toString()})()`);
      await page.evaluate(`(${startRecording.toString()})()`);
      await page.evaluate(`(${runScript.toString()})()`);
      await page.evaluate(`(${stopRecording.toString()})()`);

      const recordsWithScript = await page.evaluate<
        ReturnType<typeof getAPIRecords>
      >(`(${getAPIRecords.toString()})()`, { timeout: TIMEOUT });

      // When running the fuzzed script with the tested script,
      // the process of initializing the tested one occurs.
      // The records without the tested script also have some initialization that is common to the records with the tested script.
      // So it's efficient to compare the records after removing records for initialization.
      const startIndex1 = recordsWithoutScript.findIndex(
        (r) =>
          r.name.includes("getElementById") &&
          r.argumentsList === `["htmlvar00001"]` // refer to domato template.html
      );
      recordsWithoutScript.splice(0, startIndex1);

      const startIndex2 = recordsWithScript.findIndex(
        (r) =>
          r.name.includes("getElementById") &&
          r.argumentsList === `["htmlvar00001"]` // refer to domato template.html
      );
      recordsWithScript.splice(0, startIndex2);

      // compare
      let isDifferent = false;
      for (let i = 0; i < recordsWithoutScript.length; i++) {
        const r1 = recordsWithScript[i];
        const r2 = recordsWithoutScript[i];
        if (
          r1.name !== r2.name ||
          r1.argumentsList !== r2.argumentsList ||
          r1.result !== r2.result
        ) {
          isDifferent = true;
          break;
        }
      }

      if (isDifferent) {
        console.log(`\tresult: ❌ found different records`);
        writeResultToFile(
          i.toString(),
          JSON.stringify(recordsWithoutScript),
          JSON.stringify(recordsWithScript)
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
