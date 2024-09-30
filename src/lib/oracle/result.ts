import fs from "fs";
import path from "path";

export type PerformanceResult = {
  fileName: string;
  duration: {
    durationAve: number;
    durationStdDev: number;
    durationThreshold: number;
    durationWithScript: number;
    isOverStdDev: boolean;
    isOverThreshold: boolean;
  };
};

export type BehaviorResult = {
  fileName: string;
  record:
    | {
        isDifferent: true;
        diffApis: string[];
        pathToRecordWithoutScript: string;
        pathToRecordWithScript: string;
        pathToRecordDiff: string;
      }
    | {
        isDifferent: false;
      };
};

export function generateResultHTML(
  outputDirPath: string,
  results: BehaviorResult[] | PerformanceResult[]
) {
  const tableHTML = generateTableHTML(results);
  const resultHTML = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Test Results</title>
          <style>
              table {
                  width: 100%;
                  border-collapse: collapse;
              }
              th, td {
                  padding: 15px;
                  border: 1px solid #ddd;
              }
              th {
                  background-color: #f2f2f2;
              }
          </style>
      </head>
      <body>
          <h1>Test Results</h1>
          ${tableHTML}
      </body>
      </html>
    `;

  const resultHTMLPath = path.join(outputDirPath, "result.html");
  fs.writeFileSync(resultHTMLPath, resultHTML);
  return resultHTMLPath;
}

function generateTableHTML(results: PerformanceResult[] | BehaviorResult[]) {
  const mode = "record" in results[0] ? "behavior" : "performance";
  const header = `
      <tr>
        <th>File</th>
        ${
          mode === "behavior"
            ? `
              <th>Record Diff</th>
              <th>Diff Apis</th>
              <th>Record Without Script</th>
              <th>Record With Script</th>
              `
            : `
              <th>Duration Average(ms)</th>
              <th>Duration Std Dev(ms)</th>
              <th>Threshold For Increase Ratio(%)</th>
              <th>Duration With Script(ms)</th>
              `
        }
      </tr>
    `;

  const rows = results
    .map((result) => {
      return `
        <tr>
          <td><a href="${result.fileName}">${result.fileName}</a></td>
          ${
            "record" in result
              ? generateRecordsCells(result.record)
              : generateDurationsCells(result.duration)
          }
        </tr>
      `;
    })
    .join("");

  const table = `
      <table>
        ${header}
        ${rows}
      </table>
    `;

  return table;
}

function generateRecordsCells(recordResult: BehaviorResult["record"]) {
  if (recordResult.isDifferent) {
    return `<td style="background-color: red;"><a href="${
      recordResult.pathToRecordDiff
    }">Link</a></td>
            <td>${recordResult.diffApis.join("\n")}</td>
            <td><a href="${
              recordResult.pathToRecordWithoutScript
            }">Link</a></td>
            <td><a href="${recordResult.pathToRecordWithScript}">Link</a></td>`;
  } else {
    return `<td>No Diff</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>`;
  }
}

function generateDurationsCells(duration: PerformanceResult["duration"]) {
  let color = "";
  if (duration.isOverStdDev && duration.isOverThreshold) {
    color = "red";
  } else if (duration.isOverStdDev || duration.isOverThreshold) {
    color = "yellow";
  }

  return `
    <td>${Math.round(duration.durationAve * 100) / 100}</td>
    <td>${Math.round(duration.durationStdDev * 100) / 100}</td>
    <td>${Math.round(duration.durationThreshold * 1000) / 10}%</td>
    <td style="background-color: ${color};">${
    Math.round(duration.durationWithScript * 100) / 100
  }</td>
  `;
}
