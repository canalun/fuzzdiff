import child_process from "child_process";
import path from "path";
import process from "process";
import { createBrowserContext } from "./courier/browser";
import { runPage } from "./courier/profile";

/**
 * It doesn't work well currently,
 * because the trace file is not so helpful to analyze the result.
 */
export async function viewTrace(
  caseFilePath: string,
  scriptFilePath: string,
  traceFileOutputPath: string
) {
  const browserContext = await createBrowserContext({
    launchOptions: { headless: false },
  });

  const outputTracePath = path.resolve(
    process.cwd(),
    traceFileOutputPath + "/trace.zip"
  );

  try {
    // ref: https://playwright.dev/docs/trace-viewer#recording-a-trace-on-ci
    await browserContext.tracing.start({ screenshots: true, snapshots: true });
    await runPage(caseFilePath, browserContext, "behavior", {
      scriptFile: scriptFilePath,
    });
  } catch (e) {
    console.error(e);
  } finally {
    await browserContext.tracing.stop({
      path: outputTracePath,
    });
    await browserContext.close();
    await browserContext.browser()?.close();
  }

  child_process.execSync(`npx playwright show-trace ${outputTracePath}`);

  return;
}
