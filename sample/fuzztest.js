import { fuzz } from "../dist/cjs/index.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
  dataNum: 10,
  scriptFilePath: path.resolve(__dirname, "./fuzztest-sample.js"),
  outputPath: path.resolve(__dirname, "../fuzz"),
  performanceThreshold: 0.1,
  isParallelEnabled: false,
};

fuzz(options);
