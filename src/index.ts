
import "dotenv/config";

import { run } from "@openai/agents";

import {
  softwareEngineer,
} from "./agent/software-engineer.js";

async function main() {
  try {
    const result = await run(
      softwareEngineer,
      "Inspect src/tools/filesystem/list-files.ts and explain how the list_files tool works.",
    );

    console.log("\nAgent Response:\n");
    console.log(result.finalOutput);

  } catch (error: unknown) {
    console.error("\nAgent Execution Failed!");

    console.dir(error, { depth: 5 });

    process.exitCode = 1;
  }
}

void main();
