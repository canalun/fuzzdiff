import { diffLines } from "diff";
import fs from "fs";
import path from "path";
import invariant from "tiny-invariant";
import { CaseProfiles } from "../courier/profile";
import { ApiRecord } from "../courier/record";
import { BehaviorResult, PerformanceResult } from "./result";

export function generateResults<T extends "performance" | "behavior">(
  caseProfilesWithScript: CaseProfiles,
  caseProfilesWithoutScript: CaseProfiles,
  dataDir: string,
  mode: T,
  performanceThreshold: T extends "performance" ? number : undefined
): T extends "behavior" ? BehaviorResult[] : PerformanceResult[] {
  const files = Array.from(caseProfilesWithScript.keys()).filter((file) =>
    caseProfilesWithoutScript.has(file)
  );

  const results = [];
  for (const file of files) {
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

    switch (mode) {
      case "behavior": {
        const result = {
          fileName: file.split("/").at(-1)!,
          ...generateResultForBehavior(
            file,
            caseProfileWithoutScript.records,
            caseProfileWithScript.records
          ),
        } satisfies BehaviorResult;
        results.push(result);
        break;
      }
      case "performance": {
        invariant(!!performanceThreshold, "performanceThreshold is required");
        const result = {
          fileName: file.split("/").at(-1)!,
          ...generateResultForPerformance(
            caseProfileWithoutScript.durations,
            caseProfileWithScript.durations,
            performanceThreshold
          ),
        } satisfies PerformanceResult;
        results.push(result);
        break;
      }
      default: {
        const _exhaustiveCheck: never = mode;
        throw new Error(`invalid mode: ${mode}`);
      }
    }
  }

  // @ts-expect-error: TODO: fix type
  return results;
}

function generateResultForPerformance(
  baseDurations: number[],
  targetDurations: number[],
  threshold: number
): Omit<PerformanceResult, "fileName"> {
  const {
    averageWithoutScript,
    stdDevWithoutScript,
    isOverStdDev,
    isOverThreshold,
  } = checkDurations(baseDurations, targetDurations, threshold);

  const isPerformanceAffectedSignificantly = isOverStdDev || isOverThreshold;
  if (isPerformanceAffectedSignificantly) {
    console.log(`\tresult: ❌ found performance issue`);
  } else {
    console.log(`\tresult: 🟢 found no performance issue`);
  }

  return {
    duration: {
      durationAve: averageWithoutScript,
      durationStdDev: stdDevWithoutScript,
      durationThreshold: threshold,
      durationWithScript: targetDurations[0],
      isOverStdDev,
      isOverThreshold,
    },
  };
}

function generateResultForBehavior(
  file: string,
  baseRecords: ApiRecord[],
  targetRecords: ApiRecord[]
): Omit<BehaviorResult, "fileName"> {
  console.log("check behavior change: ", file.split("/").at(-1));

  const trimmedBaseRecords = trimRecords(baseRecords);
  const trimmedTargetRecords = trimRecords(targetRecords);

  const isRecordsDifferent = compareRecords(
    trimmedBaseRecords,
    trimmedTargetRecords
  );

  if (isRecordsDifferent) {
    console.log(`\tresult: ❌ found behavior change`);
  } else {
    console.log(`\tresult: 🟢 found no behavior change`);
  }

  if (isRecordsDifferent) {
    const record = writeResultToFile(
      file,
      JSON.stringify(baseRecords),
      JSON.stringify(targetRecords)
    );

    const _diffApis = [];
    for (let i = 0; i < record.diff.length; i++) {
      const diff = record.diff[i];
      if (diff.added || diff.removed) {
        const value = diff.value;
        try {
          _diffApis.push(
            // each line is like: `{"name":"globalThis.String.prototype.includes","argumentsList":"[\"a\"]","boundThis":"\"version\"","result":""}`
            ...value
              .match(/\"name\"\:\"(.*)\",\"argumentsList\"/g)!
              .map((str) => str.slice(8, -17))
          );
        } catch (e) {
          console.log("parse error: ", e);
          console.log("failed value: ", value);
        }
      }
    }
    const diffApis = [...new Set(_diffApis)];

    return {
      record: {
        isDifferent: isRecordsDifferent,
        diffApis,
        ...record.files,
      },
    };
  } else {
    return {
      record: {
        isDifferent: isRecordsDifferent,
      },
    };
  }
}

export function trimRecords(records: ApiRecord[]) {
  // When running the fuzzed script with the tested script,
  // the process of initializing the tested one occurs.
  // The records without the tested script also have some initialization that is common to the records with the tested script.
  // So it's efficient to compare the records after removing records for initialization.
  const startIndex = records.findIndex(
    (r) =>
      r.name.includes("getElementById") &&
      r.argumentsList === `["htmlvar00001"]` // refer to domato template.html
  );
  return records.slice(startIndex);
}

export function compareRecords(records1: ApiRecord[], records2: ApiRecord[]) {
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

function writeResultToFile(
  file: string,
  _resultWithoutScript: string,
  _resultWithScript: string
) {
  const filePrefix = file.split("/").at(-1)!.replace(".html", "");
  const outputPath = file.split("/").slice(0, -1).join("/");

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
    diff: resultDiff,
    files: {
      pathToRecordWithScript,
      pathToRecordWithoutScript,
      pathToRecordDiff,
    },
  };
}

function checkDurations(
  durationsWithoutScript: number[],
  durationWithScript: number[],
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
  const averageWithScript =
    durationWithScript.reduce((p, c) => p + c, 0) / durationWithScript.length;
  // TODO: use 3 sigma rule
  const isOverStdDev =
    averageWithScript - averageWithoutScript > stdDevWithoutScript;
  const isOverThreshold =
    (averageWithScript - averageWithoutScript) / averageWithoutScript >
    performanceThreshold;

  console.log("average: ", averageWithoutScript);
  console.log("stdDev: ", stdDevWithoutScript);
  console.log("duration w/script: ", averageWithScript);

  return {
    averageWithoutScript,
    stdDevWithoutScript,
    isOverStdDev,
    isOverThreshold,
  };
}
