import { createBrowserContext } from "./courier/browser";
import {
  profileCases as profileCasesWithoutScript,
  profileCasesWithScript,
} from "./courier/profiler";
import { getMergedOptions, UserOptions } from "./options";
import { generateResults } from "./oracle/analyzer";
import { generateResultHTML } from "./oracle/result";
import { generateData } from "./poet/generator";

export async function fuzz(_options: UserOptions) {
  const options = getMergedOptions(_options);

  console.log("--- generate fuzz data👶 ---");
  const isDataGenerated = generateData(options.dataNum, options.outputPath);
  if (!isDataGenerated) {
    throw new Error("failed to generate data. Bye!");
  }

  console.log("--- setup browser🌐 ---");
  const browserContext = await createBrowserContext(options.browserOptions);

  console.log("--- validate test cases🔍 ---");
  const caseProfilesWithoutScript = await profileCasesWithoutScript(
    options.outputPath,
    browserContext,
    options.isParallelEnabled
  );

  console.log("--- run test cases🏃 ---");
  const caseProfilesWithScript = await profileCasesWithScript(
    options.scriptFilePath,
    options.outputPath,
    browserContext,
    options.scenario,
    options.isParallelEnabled
  );

  console.log("--- profiling done! close browser👋 ---");
  await browserContext.close();
  await browserContext.browser()?.close();

  console.log("--- generate result📝 ---");
  const results = generateResults(
    caseProfilesWithScript,
    caseProfilesWithoutScript,
    options.outputPath,
    options.performanceThreshold
  );
  const resultPath = generateResultHTML(results, options.outputPath);
  console.log("🎉🎉 result: ", resultPath);
}
