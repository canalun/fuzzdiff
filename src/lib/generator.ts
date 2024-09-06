import * as child_process from "child_process";
import path from "path";

const DOMATO_PATH = path.resolve(__dirname, "../../../domato/generator.py");

export function generateData(dataNum: number, _outputPath: string): string {
  const outputPath = path.resolve(process.cwd(), _outputPath);
  child_process.exec(`python3 ${DOMATO_PATH} -o ${outputPath} -n ${dataNum}`);
  return outputPath;
}

export function runScript() {
  window.jsfuzzer();
}
