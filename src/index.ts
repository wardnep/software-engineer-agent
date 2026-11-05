
import "dotenv/config";

import { Agent, run } from "@openai/agents";

const agent = new Agent({
  name: "Software Engineer",
  instructions: `
    You are an experienced software engineer.

    You help users:
    - Understand software architecture
    - Analyze source code
    - Debug programming problems
    - Write clean and maintainable code

    Always explain your reasoning clearly.
  `,
  model: "gpt-5.4",
});

async function main() {
  try {
    const result = await run(
      agent,
      "Explain what an AI Software Engineer Agent is."
    );

    console.log("\nAgent Response:\n");
    console.log(result.finalOutput);

  } catch (error: unknown) {
    console.error("\nAgent Execution Failed!\n");

    if (error instanceof Error) {
      const apiError = error as Error & {
        status?: number;
        code?: string;
        type?: string;
        request_id?: string;
      };

      console.error({
        name: apiError.name,
        message: apiError.message,
        status: apiError.status,
        code: apiError.code,
        type: apiError.type,
        request_id: apiError.request_id,
      });
    } else {
      console.error("Non-standard error:");
      console.dir(error, { depth: 3 });
    }
  }
}

main();
