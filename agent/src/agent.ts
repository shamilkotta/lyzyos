import { Think, Workspace, defaultContextOverflowClassifier } from "@cloudflare/think";
import type { ContextConfig } from "agents/context";
import type { ThinkScheduledTasks } from "@cloudflare/think";
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

  #activeThreads = new Set<string>();

  async handleChat(input: ChatBody) {
    if (!this.getConfig<{ projectId: string }>()?.projectId) {
      this.configure({ projectId: input.projectId });
    }
    this.#activeThreads.add(input.threadId);
    try {
      return await handleChat.call(this, input);
    } finally {
      this.#activeThreads.delete(input.threadId);
    }
  }

  override getScheduledTasks(): ThinkScheduledTasks {
    return {
      periodicWatchlistCheck: {
        schedule: "every 5 minutes", // TODO: "every 1 hours"
        handler: async () => {
          const config = this.getConfig<{ projectId: string }>();
          if (!config?.projectId) return;

          await handleChat
            .call(this, {
              projectId: config.projectId,
              workspaceId: config.projectId,
              threadId: config.projectId,
              message: [
                {
                  id: crypto.randomUUID(),
                  role: "user",
                  name: "System",
                  message:
                    "Periodic watchlist check: Review your watchlist and check all pending items. For stale or overdue items post a follow-up on the relevant threads. Mark resolved items done. Check all workspaces for anything that needs attention.",
                },
              ],
            })
            .catch((err: unknown) => {
              console.error("[agent] periodic watchlist check failed", err);
            });
        },
      },
    };
  }

  getStatus() {
    return { working: this.#activeThreads.size > 0 };
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
      {
        label: "watchlist",
        description:
          "Things to come back to: pending questions, cross-workspace escalations, follow-ups, reminders. Short pointed notes with enough context to act on later. Not for project facts — use memory for those.",
        maxTokens: 3_000,
        whenChanged: "remind",
      },
    ];
  }
}
