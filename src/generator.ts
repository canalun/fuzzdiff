import * as child_process from "child_process";
import path from "path";

const domatoPath = path.resolve(__dirname, "../domato/generator.py");
const outputDirPath = path.resolve(__dirname, "../fuzz");

export function generateData(dataNum: number): string {
  child_process.exec(
    `python3 ${domatoPath} --output_dir ${outputDirPath} --no_of_files ${dataNum}`
  );
  return outputDirPath;
}
