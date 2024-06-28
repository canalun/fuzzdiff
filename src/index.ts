import * as child_process from "child_process";

const testNumber = 2;

export function generatePages() {
  child_process.exec(
    `python3 ../domato/generator.py --output_dir ../fuzz --no_of_files ${testNumber}`
  );
}

// WIP
