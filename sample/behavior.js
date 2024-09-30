import path from "path";
import { fileURLToPath } from "url";
import { fuzzBehavior } from "../dist/cjs/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
  dataNum: 20,
  scriptFilePath: path.resolve(__dirname, "./script-with-effect.js"),
  outputPath: path.resolve(__dirname, "../fuzz"),
};

fuzzBehavior(options);
