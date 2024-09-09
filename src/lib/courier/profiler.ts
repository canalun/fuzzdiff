import { BrowserContext, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { compareRecords } from "../oracle/analyzer";
import {
  ApiRecord,
  makeAllFunctionRecorded,
  runAndRecordScript,
} from "./recorder";

export type CaseProfiles = Map<string, CaseProfile>;
type CaseProfile = {
  durations: number[];
  records: ApiRecord[];
};

const TIMEOUT = 2000;
const SAMPLE_NUM = 3;

export async function profileCases(
  dataDir: string,
  browserContext: BrowserContext,
  isParallelEnabled: boolean
): Promise<CaseProfiles> {
  const caseProfiles = new Map<string, CaseProfile>();

  const files = fs.readdirSync(dataDir);
  if (isParallelEnabled) {
    await Promise.allSettled(
      files.map((file) =>
        profileCase(path.resolve(dataDir, file), browserContext, caseProfiles)
      )
    );
  } else {
    for (let i = 0; i < files.length; i++) {
      await profileCase(
        path.resolve(dataDir, files[i]),
        browserContext,
        caseProfiles
      );
    }
  }

  return caseProfiles;
}

async function profileCase(
  file: string,
  browserContext: BrowserContext,
  caseProfiles: CaseProfiles
) {
  console.log(`validate case: ${file}`);

  const results = [];
  try {
    for (let i = 0; i < SAMPLE_NUM; i++) {
      const result = await runPage(file, browserContext);
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
    console.log(`remove invalid case: ${file.split("/").at(-1)}`);
    console.log(`\terror: ${e}`);
    fs.unlinkSync(file);
  }
}

async function runPage(file: string, browserContext: BrowserContext) {
  const page = await browserContext.newPage();

  await page.goto("file://" + file, {
    // It's necessary to set timeout in order to detect the page which is not responding.
    // Fuzzer sometimes generates such a page.
    timeout: TIMEOUT,
    waitUntil: "load",
  });

  // It's necessary to add empty script tag,
  // otherwise `document.all.length` always returns a different result (= original+1).
  await page.addScriptTag({ content: "() => { return; }" });

  await page.evaluate(`(${makeAllFunctionRecorded.toString()})()`, {
    timeout: TIMEOUT,
  });

  const result = await page.evaluate<ReturnType<typeof runAndRecordScript>>(
    `(${runAndRecordScript.toString()})()`,
    {
      timeout: TIMEOUT,
    }
  );

  await page.close();

  return result;
}

export async function profileCasesWithScript(
  pathToScriptFile: string,
  dataDir: string,
  browserContext: BrowserContext,
  scenario: (page: Page) => Promise<void>,
  isParallelEnabled: boolean
): Promise<CaseProfiles> {
  const caseProfilesWithScript = new Map<string, CaseProfile>();

  const files = fs.readdirSync(dataDir);
  console.log("test cases:\n", files.join("\n"));

  if (isParallelEnabled) {
    await Promise.allSettled(
      files.map((file) =>
        profileCaseWithScript(
          path.resolve(dataDir, file),
          path.resolve(process.cwd(), pathToScriptFile),
          browserContext,
          scenario,
          caseProfilesWithScript
        )
      )
    );
  } else {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      await profileCaseWithScript(
        path.resolve(dataDir, file),
        path.resolve(process.cwd(), pathToScriptFile),
        browserContext,
        scenario,
        caseProfilesWithScript
      );
    }
  }

  return caseProfilesWithScript;
}

async function profileCaseWithScript(
  file: string,
  scriptFile: string,
  browserContext: BrowserContext,
  scenario: (page: Page) => Promise<void>,
  caseProfiles: Map<string, CaseProfile>
) {
  console.log("run test: ", file.split("/").at(-1));

  const page = await browserContext.newPage();
  try {
    // run with script
    await page.goto("file://" + file, {
      waitUntil: "load",
    });

    await page.addScriptTag({
      path: scriptFile,
    });
    await scenario(page);

    await page.evaluate(`(${makeAllFunctionRecorded.toString()})()`);
    const { records: recordsWithScript, duration: durationWithScript } =
      await page.evaluate<ReturnType<typeof runAndRecordScript>>(
        `(${runAndRecordScript.toString()})()`
      );

    caseProfiles.set(file, {
      records: recordsWithScript,
      durations: [durationWithScript],
    });
  } catch (e) {
    console.log(
      `failed to profile case with script: ${file.split("/").at(-1)}`
    );
    console.log(`\terror: ${e}`);
  }
  await page.close();
}
