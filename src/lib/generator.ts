import * as child_process from "child_process";
import path from "path";

declare global {
  interface Window {
    // please see domato template.html
    jsfuzzer: () => void;
  }
}

const DOMATO_PATH = path.resolve(__dirname, "../../../domato/generator.py");

export function generateData(dataNum: number, _outputPath: string): string {
  const outputPath = path.resolve(process.cwd(), _outputPath);
  child_process.execSync(
    `python3 ${DOMATO_PATH} -o ${outputPath} -n ${dataNum}`
  );
  return outputPath;
}
