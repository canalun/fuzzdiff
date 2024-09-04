import * as child_process from "child_process";
import path from "path";

const domatoPath = path.join(__dirname, "../../../domato/generator.py");
const outputDirPath = path.join(process.cwd(), "fuzz");

export function generateData(dataNum: number): string {
  child_process.exec(`python3 ${domatoPath} -o ${outputDirPath} -n ${dataNum}`);
  return outputDirPath;
}

export function runScript() {
  window.jsfuzzer();
}
