import { Think, defaultContextOverflowClassifier } from "@cloudflare/think";
import type { ContextConfig } from "agents/context";
import { handleChat } from "./chat";
import type { ChatBody } from "./schema";
import { STANDING } from "./system";
import { createTools } from "./tools";

export class Lyzy extends Think<Env> {
  maxSteps = 25;
  contextOverflow = { reactive: true, maxRetries: 1 };
  classifyChatError = defaultContextOverflowClassifier;

  async handleChat(input: ChatBody) {
    return handleChat.call(this, input);
  }

  getModel() {
    return "@cf/moonshotai/kimi-k2.5";
  }

  getTools() {
    return createTools.call(this);
  }

  configureContext(): ContextConfig[] {
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
