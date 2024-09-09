import { generateResults } from "./analyzer";
import { createBrowserContext } from "./browser";
import { generateData } from "./generator";
import { getMergedOptions, UserOptions } from "./options";
import {
  profileCases as profileCasesWithoutScript,
  profileCasesWithScript,
} from "./profiler";
import { generateResultHTML } from "./result";

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
