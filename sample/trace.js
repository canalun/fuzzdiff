import path from "path";
import { fileURLToPath } from "url";
import { viewTrace } from "../dist/cjs/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// WARNING: it's NOT working.
viewTrace(
  path.resolve(__dirname, "../fuzz/fuzz-00022.html"),
  path.resolve(__dirname, "./script-with-effect.js"),
  path.resolve(__dirname, "../fuzz")
);
