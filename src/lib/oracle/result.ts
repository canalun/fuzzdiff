import fs from "fs";
import path from "path";

export type Result = {
  pathToFile: string;
  record:
    | {
        isDifferent: true;
        pathToRecordWithoutScript: string;
        pathToRecordWithScript: string;
        pathToRecordDiff: string;
      }
    | {
        isDifferent: false;
      };
  duration: {
    durationAve: number;
    durationStdDev: number;
    durationThreshold: number;
    durationWithScript: number;
    isOverStdDev: boolean;
    isOverThreshold: boolean;
  };
};

export function generateResultHTML(results: Result[], outputDirPath: string) {
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

function generateTableHTML(results: Result[]) {
  // テーブルのヘッダーを作成
  const header = `
      <tr>
        <th>File</th>
        <th>Record Diff</th>
        <th>Record Without Script</th>
        <th>Record With Script</th>
        <th>Duration Average(ms)</th>
        <th>Duration Std Dev(ms)</th>
        <th>Threshold For Increase Ratio(%)</th>
        <th>Duration With Script(ms)</th>
      </tr>
    `;

  // テーブルの各行を作成
  const rows = results
    .map((result) => {
      const { duration, record } = result;
      let color = "";
      if (duration.isOverStdDev && duration.isOverThreshold) {
        color = "red";
      } else if (duration.isOverStdDev || duration.isOverThreshold) {
        color = "yellow";
      }

      return `
        <tr>
          <td><a href="${result.pathToFile}">${result.pathToFile}</a></td>
          ${generateRecordsCells(record)}
          <td>${Math.round(duration.durationAve * 100) / 100}</td>
          <td>${Math.round(duration.durationStdDev * 100) / 100}</td>
          <td>${Math.round(duration.durationThreshold * 1000) / 10}%</td>
          <td style="background-color: ${color};">${
        Math.round(duration.durationWithScript * 100) / 100
      }</td>
        </tr>
      `;
    })
    .join("");

  // テーブルを作成
  const table = `
      <table>
        ${header}
        ${rows}
      </table>
    `;

  return table;
}

function generateRecordsCells(recordResult: Result["record"]) {
  if (recordResult.isDifferent) {
    return `<td style="background-color: red;"><a href="${recordResult.pathToRecordDiff}">Link</a></td>
            <td><a href="${recordResult.pathToRecordWithoutScript}">Link</a></td>
            <td><a href="${recordResult.pathToRecordWithScript}">Link</a></td>`;
  } else {
    return `<td>No Diff</td>
            <td>-</td>
            <td>-</td>`;
  }
}
