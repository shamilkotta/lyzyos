import { Think, Workspace, defaultContextOverflowClassifier } from "@cloudflare/think";
import type { ContextConfig } from "agents/context";
import { handleChat } from "./chat";
import type { ChatBody } from "./schema";
import { STANDING } from "./system";
import { createBrowserTools } from "@cloudflare/think/tools/browser";
import { createBashTool } from "@cloudflare/think/tools/workspace";

export class Lyzy extends Think<Env> {
  override maxSteps = 25;
  override contextOverflow = { reactive: true, maxRetries: 1 };
  override classifyChatError = defaultContextOverflowClassifier;
  override workspace = new Workspace({
    sql: this.ctx.storage.sql,
  });

  #working = false;

  async handleChat(input: ChatBody) {
    this.#working = true;
    try {
      return await handleChat.call(this, input);
    } finally {
      this.#working = false;
    }
  }

  getStatus() {
    return { working: this.#working };
  }

  override getModel() {
    return "@cf/moonshotai/kimi-k2.5";
  }

  override getTools() {
    return {
      ...super.getTools(),
      bash: createBashTool({
        ops: {
          readDir: this.workspace.readDir,
          readFileBytes: this.workspace.readFileBytes,
          writeFile: this.workspace.writeFile,
          mkdir: this.workspace.mkdir,
          rm: this.workspace.rm,
          writeFileBytes: this.workspace.writeFileBytes,
        },
      }),
      ...createBrowserTools({
        ctx: this.ctx,
        browser: this.env.BROWSER,
        loader: this.env.LOADER,
      }),
    };
  }

  override configureContext(): ContextConfig[] {
    return [
      {
        label: "standing",
        description: "Fixed role and operating rules. Not writable.",
        provider: { get: async () => STANDING },
      },
      {
        label: "soul",
        description:
          "Your self-written identity, character, role, and behavior for this project. Starts empty — write and rewrite via set_context as you learn who you are here.",
        maxTokens: 2_000,
        whenChanged: "remind",
      },
      {
        label: "memory",
        description:
          "Durable project facts. Starts empty. Store, update, and prune important details via set_context. Shared across all threads.",
        maxTokens: 5_000,
        whenChanged: "remind",
      },
    ];
  }
}
