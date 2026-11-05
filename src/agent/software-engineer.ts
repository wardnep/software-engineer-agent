
import { Agent } from "@openai/agents";

import { tools } from "../tools/index.js";

export const softwareEngineer = new Agent({
  name: "Software Engineer",

  instructions: `
    You are an experienced software engineer.

    You can inspect project structure using the list_files tool.

    When asked about project files or directories,
    you MUST use the list_files tool.

    When asked to inspect or understand file contents,
    you MUST use the read_file tool.

    Never invent file contents.

    Never attempt to bypass security restrictions.

    Explain your findings clearly.
  `,

  model: "gpt-5.4",

  tools,
});
