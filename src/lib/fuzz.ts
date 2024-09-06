import { Page } from "@playwright/test";
import diff from "fast-diff";
import fs from "fs";
import path from "path";
import { createBrowserPage } from "./browser";
import { generateData, runScript } from "./generator";
import { getMergedOptions, UserOptions } from "./options";
import {
  getAPIRecords,
  getDuration,
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
  const caseProfiles = await validateCases(dataDir, page);

  console.log("run test cases🏃");
  await run(
    options.pathToScriptFile,
    dataDir,
    page,
    options.scenario,
    options.performanceThreshold,
    caseProfiles
  );

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

type CaseProfile = {
  durations: number[];
  records: ReturnType<typeof getAPIRecords>;
};

const TIMEOUT = 2000;
const SAMPLE_NUM = 3;
async function validateCases(dataDir: string, page: Page) {
  const caseProfiles = new Map<string, CaseProfile>();

  const files = fs.readdirSync(dataDir);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`validate case: ${file}`);

    const results = [];
    try {
      for (let i = 0; i < SAMPLE_NUM; i++) {
        const result = await goThrough(dataDir, file, page);
        if (i > 0 && compareRecords(results[i - 1].records, result.records)) {
          throw new Error("flaky case");
        }
        results.push(result);
      }

      caseProfiles.set(file, {
        records: results[0].records,
        durations: results.map((r) => r.duration),
      });
    } catch (e) {
      console.log(`remove invalid case: ${files[i]}`);
      console.log(`\terror: ${e}`);
      fs.unlinkSync(path.resolve(dataDir, files[i]));
    }
  }

  return caseProfiles;
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
  const duration = await page.evaluate<number>(
    `(${getDuration.toString()})()`,
    { timeout: TIMEOUT }
  );
  return { records, duration };
}

async function run(
  pathToScriptFile: string,
  dataDir: string,
  page: Page,
  scenario: (page: Page) => Promise<void>,
  performanceThreshold: number,
  caseProfiles: Map<string, CaseProfile>
) {
  const files = fs.readdirSync(dataDir);

  console.log("test cases: ", files.join("\n"));

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log("run test: ", file);
    try {
      // run with script
      await page.goto("file://" + path.resolve(dataDir, file), {
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
      const durationWithScript = await page.evaluate<number>(
        `(${getDuration.toString()})()`,
        { timeout: TIMEOUT }
      );

      const caseProfile = caseProfiles.get(file);
      if (!caseProfile) {
        throw new Error(`cannot find profile for ${file}`);
      }

      const isRecordsDifferent = compareRecords(
        caseProfile.records,
        recordsWithScript
      );
      if (isRecordsDifferent) {
        console.log(`\tresult: ❌ found side effect`);
        writeResultToFile(
          i.toString(),
          JSON.stringify(caseProfile.records),
          JSON.stringify(recordsWithScript)
        );
      }

      const { isOverStdDev, isOverThreshold } = checkDurations(
        caseProfile.durations,
        durationWithScript,
        performanceThreshold
      );
      const isPerformanceAffectedSignificantly =
        isOverStdDev || isOverThreshold;
      if (isPerformanceAffectedSignificantly) {
        console.log(`\tresult: ❌ found performance issue`);
      }

      if (!isRecordsDifferent && !isPerformanceAffectedSignificantly) {
        console.log(
          `\tresult: 🟢 found neither side effect nor performance issue`
        );
      }
    } catch (e) {
      console.log(`\terror: ${e}`);
    }
  }
}

function compareRecords(
  recordsWithoutScript: ReturnType<typeof getAPIRecords>,
  recordsWithScript: ReturnType<typeof getAPIRecords>
) {
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
  return isDifferent;
}

function checkDurations(
  durationsWithoutScript: number[],
  durationWithScript: number,
  performanceThreshold: number
) {
  const averageWithoutScript =
    durationsWithoutScript.reduce((p, c) => p + c, 0) /
    durationsWithoutScript.length;
  const stdDevWithoutScript = Math.sqrt(
    durationsWithoutScript.reduce(
      (p, c) => p + (c - averageWithoutScript) ** 2,
      0
    ) / durationsWithoutScript.length
  );
  const isOverStdDev =
    durationWithScript - averageWithoutScript > stdDevWithoutScript;
  const isOverThreshold =
    (durationWithScript - averageWithoutScript) / averageWithoutScript >
    performanceThreshold;

  console.log("average: ", averageWithoutScript);
  console.log("stdDev: ", stdDevWithoutScript);
  console.log("duration w/script: ", durationWithScript);

  return { isOverStdDev, isOverThreshold };
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
