import * as child_process from "child_process";
import fs from "fs";
import path from "path";
import { createBrowserContext } from "./courier/browser";
import { profileCases } from "./courier/profile";
import { getMergedOptions, UserOptions } from "./options";
import { generateResults } from "./oracle/analysis";
import { generateResultHTML } from "./oracle/result";
import { generateData } from "./poet/generator";

export async function fuzzPerformance(options: UserOptions) {
  fuzz(options, "performance");
}

export async function fuzzBehavior(
  options: Omit<UserOptions, "performanceThreshold">
) {
  fuzz(options, "behavior");
}

async function fuzz(_options: UserOptions, mode: "performance" | "behavior") {
  const options = getMergedOptions(_options);

  console.log("--- generate fuzz data👶 ---");
  const isDataGenerated = generateData(options.dataNum, options.outputPath);
  if (!isDataGenerated) {
    throw new Error("failed to generate data. Bye!");
  }

  console.log("--- setup browser🌐 ---");
  const browserContext = await createBrowserContext(options.browserOptions);

  console.log("--- validate test cases🔍 ---");
  const generatedFiles = getFiles(options.outputPath);
  const caseProfilesWithoutScript = await profileCases(
    generatedFiles,
    browserContext,
    mode
  );

  console.log("--- run test cases🏃 ---");
  const validatedFiles = getFiles(options.outputPath);
  const caseProfilesWithScript = await profileCases(
    validatedFiles,
    browserContext,
    mode,
    {
      scriptFile: path.resolve(process.cwd(), options.scriptFilePath),
      scenario: options.scenario,
    }
  );

  console.log("--- profiling done! close browser👋 ---");
  await browserContext.close();
  await browserContext.browser()?.close();

  console.log("--- generate result📝 ---");
  const results = generateResults(
    caseProfilesWithScript,
    caseProfilesWithoutScript,
    options.outputPath,
    mode,
    mode === "behavior" ? undefined : options.performanceThreshold
  );
  if (results.length === 0) {
    console.log("No test cases are valid. Bye!");
    return;
  }

  const resultPath = generateResultHTML(options.outputPath, results);
  console.log("🎉🎉 opening result...");
  child_process.execSync(`open ${resultPath}`);
}

function getFiles(dir: string): string[] {
  return fs.readdirSync(dir).map((file) => path.resolve(dir, file));
}
