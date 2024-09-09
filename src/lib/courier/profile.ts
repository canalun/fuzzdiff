import { BrowserContext, Page } from "@playwright/test";
import fs from "fs";
import { compareRecords } from "../oracle/analysis";
import {
  ApiRecord,
  makeAllFunctionRecorded,
  runAndRecordScript,
} from "./record";

export type CaseProfiles = Map<string, CaseProfile>;
type CaseProfile = {
  durations: number[];
  records: ApiRecord[];
};

const TIMEOUT = 2000;

const SAMPLE_NUM_FOR_PERF_PROFILING = 15;
const SAMPLE_NUM_FOR_BEHAVIOR_PROFILING = 3;

export async function profileCases(
  files: string[],
  browserContext: BrowserContext,
  mode: "performance" | "behavior",
  scriptOption?: {
    scriptFile: string;
    scenario?: (page: Page) => Promise<void>;
  }
): Promise<CaseProfiles> {
  const shouldUseParallel = mode === "behavior";

  const caseProfiles = new Map<string, CaseProfile>();
  if (shouldUseParallel) {
    await Promise.allSettled(
      files.map((file) =>
        profileCase(file, browserContext, caseProfiles, mode, scriptOption)
      )
    );
  } else {
    for (let i = 0; i < files.length; i++) {
      await profileCase(
        files[i],
        browserContext,
        caseProfiles,
        mode,
        scriptOption
      );
    }
  }

  return caseProfiles;
}

async function profileCase(
  file: string,
  browserContext: BrowserContext,
  caseProfiles: CaseProfiles,
  mode: "performance" | "behavior",
  scriptOption?: {
    scriptFile: string;
    scenario?: (page: Page) => Promise<void>;
  }
) {
  console.log(`profile case: ${file}`);

  const sampleNum =
    mode === "performance"
      ? SAMPLE_NUM_FOR_PERF_PROFILING
      : SAMPLE_NUM_FOR_BEHAVIOR_PROFILING;

  const results = [];
  try {
    for (let i = 0; i < sampleNum; i++) {
      const result = await runPage(file, browserContext, mode, scriptOption);
      if (i > 0 && compareRecords(results[i - 1].records, result.records)) {
        // TODO: if script makes web page flaky, it should be told to user.
        throw new Error("flaky page");
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

async function runPage(
  file: string,
  browserContext: BrowserContext,
  mode: "performance" | "behavior",
  scriptOption?: {
    scriptFile: string;
    scenario?: (page: Page) => Promise<void>;
  }
) {
  const page = await browserContext.newPage();

  await page.goto("file://" + file, {
    // It's necessary to set timeout in order to detect the page which is not responding.
    // Fuzzer sometimes generates such a page.
    timeout: TIMEOUT,
    waitUntil: "load",
  });

  // Even if the script file is not provided, it's necessary to add empty script tag.
  // Otherwise `document.all.length` always returns a different result (= original+1).
  await page.addScriptTag(
    scriptOption?.scriptFile
      ? { path: scriptOption?.scriptFile }
      : { content: "() => { return; }" }
  );
  if (scriptOption?.scenario) {
    await scriptOption?.scenario(page);
  }

  if (mode === "behavior") {
    await page.evaluate(`(${makeAllFunctionRecorded.toString()})()`, {
      timeout: TIMEOUT,
    });
  }

  const result = await page.evaluate<ReturnType<typeof runAndRecordScript>>(
    `(${runAndRecordScript.toString()})()`,
    {
      timeout: TIMEOUT,
    }
  );

  await page.close();

  return result;
}