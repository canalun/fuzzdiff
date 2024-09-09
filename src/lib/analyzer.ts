import { diffLines } from "diff";
import fs from "fs";
import path from "path";
import { CaseProfiles } from "./profiler";
import { ApiRecord } from "./recorder";
import { Result } from "./result";

export function generateResults(
  caseProfilesWithScript: CaseProfiles,
  caseProfilesWithoutScript: CaseProfiles,
  dataDir: string,
  performanceThreshold: number
): Result[] {
  const results: Result[] = [];

  const files = fs.readdirSync(dataDir);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    const caseProfileWithoutScript = caseProfilesWithoutScript.get(
      path.resolve(dataDir, file)
    );
    if (!caseProfileWithoutScript) {
      throw new Error(`cannot find profile without script for ${file}`);
    }
    const caseProfileWithScript = caseProfilesWithScript.get(
      path.resolve(dataDir, file)
    );
    if (!caseProfileWithScript) {
      throw new Error(`cannot find profile with script for ${file}`);
    }

    let paths = {};
    const isRecordsDifferent = compareRecords(
      caseProfileWithScript.records,
      caseProfileWithoutScript.records
    );
    if (isRecordsDifferent) {
      console.log(`\tresult: ❌ found side effect`);
      paths = writeResultToFile(
        dataDir,
        file.replace(".html", ""),
        JSON.stringify(caseProfileWithScript.records),
        JSON.stringify(caseProfileWithoutScript.records)
      );
    }

    const {
      averageWithoutScript,
      stdDevWithoutScript,
      isOverStdDev,
      isOverThreshold,
    } = checkDurations(
      caseProfileWithoutScript.durations,
      caseProfileWithScript.durations[0],
      performanceThreshold
    );
    const isPerformanceAffectedSignificantly = isOverStdDev || isOverThreshold;
    if (isPerformanceAffectedSignificantly) {
      console.log(`\tresult: ❌ found performance issue`);
    }

    if (!isRecordsDifferent && !isPerformanceAffectedSignificantly) {
      console.log(
        `\tresult: 🟢 found neither side effect nor performance issue`
      );
    }

    results.push({
      pathToFile: file,
      // @ts-expect-error: fix type
      record: {
        isDifferent: isRecordsDifferent,
        ...paths,
      },
      duration: {
        durationAve: averageWithoutScript,
        durationStdDev: stdDevWithoutScript,
        durationThreshold: performanceThreshold,
        durationWithScript: caseProfileWithScript.durations[0],
        isOverStdDev,
        isOverThreshold,
      },
    });
  }

  return results;
}

export function compareRecords(records1: ApiRecord[], records2: ApiRecord[]) {
  // When running the fuzzed script with the tested script,
  // the process of initializing the tested one occurs.
  // The records without the tested script also have some initialization that is common to the records with the tested script.
  // So it's efficient to compare the records after removing records for initialization.
  const startIndex1 = records1.findIndex(
    (r) =>
      r.name.includes("getElementById") &&
      r.argumentsList === `["htmlvar00001"]` // refer to domato template.html
  );
  records1.splice(0, startIndex1);

  const startIndex2 = records2.findIndex(
    (r) =>
      r.name.includes("getElementById") &&
      r.argumentsList === `["htmlvar00001"]` // refer to domato template.html
  );
  records2.splice(0, startIndex2);

  // compare
  let isDifferent = false;
  for (let i = 0; i < records1.length; i++) {
    const r1 = records2[i];
    const r2 = records1[i];
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

  return {
    averageWithoutScript,
    stdDevWithoutScript,
    isOverStdDev,
    isOverThreshold,
  };
}

function writeResultToFile(
  outputPath: string,
  filePrefix: string,
  _resultWithoutScript: string,
  _resultWithScript: string
) {
  const pathToRecordWithoutScript = `${filePrefix}-without-script.txt`;
  const resultWithoutScript = _resultWithoutScript.replaceAll(
    `"},{"name`,
    `"},\n{"name`
  );
  fs.writeFileSync(
    path.join(outputPath, pathToRecordWithoutScript),
    resultWithoutScript
  );

  const pathToRecordWithScript = `${filePrefix}-with-script.txt`;
  const resultWithScript = _resultWithScript.replaceAll(
    `"},{"name`,
    `"},\n{"name`
  );
  fs.writeFileSync(
    path.join(outputPath, pathToRecordWithScript),
    resultWithScript
  );

  const pathToRecordDiff = `${filePrefix}-resultDiff.txt`;
  const resultDiff = diffLines(resultWithoutScript, resultWithScript);
  fs.writeFileSync(
    path.join(outputPath, pathToRecordDiff),
    resultDiff
      .map(({ value, added, removed }) => {
        if (added) {
          return `\n\n\n\n\n\n+++\t${value}\n\n\n\n\n\n`;
        } else if (removed) {
          return `\n\n\n\n\n\n---\t${value}\n\n\n\n\n\n`;
        } else {
          return `${value}\n`;
        }
      })
      .join("")
  );

  return {
    pathToRecordWithScript,
    pathToRecordWithoutScript,
    pathToRecordDiff,
  };
}
