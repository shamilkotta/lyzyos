import { addCommentToThread, getNodeDto, getNodeInProject, getNodeWithRelations } from "@lyzyos/db";
import {
  createCompactFunction,
  type Session as Conversation,
  type SessionMessage,
} from "agents/sessions";
import { convertToModelMessages, generateText, stepCountIs, type UIMessage } from "ai";
import type { Lyzy } from "./agent";
import { publishNodeUpserted } from "./publish";
import type { ChatBody } from "./schema";
import { COMPACT_AFTER_TOKENS, SKIP_MARKER } from "./system";
import { toolsContextFor, type ToolSession } from "./tools";

type GenerateResult = {
  text: string;
  toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }>;
  toolResults: Array<{ toolCallId: string; output: unknown }>;
};

export async function handleChat(this: Lyzy, input: ChatBody) {
  const thread = getThread.call(this, input.threadId);
  const session: ToolSession = {
    projectId: input.projectId,
    workspaceId: input.workspaceId,
  };

  const history = await thread.getHistory();
  const existingIds = new Set<string>();
  if (!history.length) {
    await hydrateThreadHistory.call(this, thread, input.threadId, existingIds);
  }

  for (const message of input.message) {
    if (existingIds.has(message.id)) continue;

    const uiMessage: UIMessage = {
      id: message.id,
      role: message.role,
      metadata: { name: message.name, authorRole: message.role },
      parts: [
        {
          type: "text",
          text: message.role == "user" ? `${message.name}: ${message.message}` : message.message,
        },
      ],
    };
    await thread.appendMessage(uiMessage as SessionMessage);
  }

  const result = await runThreadTurn.call(this, thread, session, { allowOverflowRetry: true });

  await thread.appendMessage(assistantMessageFromResult(result) as SessionMessage);

  await this.context.refreshSystemPrompt();

  const text = result.text.trim();
  await postReply.call(this, input, text);

  return { text, threadId: input.threadId };
}

/**
 * The model's final text is its reply on the thread it was invoked from. Silence (empty text or
 * the skip marker) is a valid answer. Threads that are not comment nodes — e.g. the project
 * kickoff, keyed by workspace id — have nowhere to reply; the agent writes nodes via tools there.
 */
async function postReply(this: Lyzy, input: ChatBody, text: string) {
  if (!text || text.includes(SKIP_MARKER)) return;

  const thread = await getNodeInProject(this.env.DB, {
    nodeId: input.threadId,
    projectId: input.projectId,
  });
  if (thread?.kind !== "comment") return;

  await addCommentToThread(this.env.DB, {
    threadId: thread.id,
    message: text,
    userId: this.env.AGENT_ID,
  });
  const node = await getNodeDto(this.env.DB, thread.id, this.env.AGENT_ID);
  if (node) await publishNodeUpserted(this.env, node.workspaceId, node);
}

function getThread(this: Lyzy, threadId: string): Conversation {
  return this.sessions
    .session(threadId)
    .onCompaction(createCompactFunction({ summarize: (prompt) => summarize.call(this, prompt) }))
    .compactAfter(COMPACT_AFTER_TOKENS);
}

async function hydrateThreadHistory(
  this: Lyzy,
  thread: Conversation,
  threadId: string,
  existingIds: Set<string>,
) {
  const row = await getNodeWithRelations(this.env.DB, threadId);
  const comments = [...(row?.comments ?? [])].sort((a, b) => a.createdAt - b.createdAt);
  if (comments.length === 0) return;

  for (const comment of comments) {
    const name = comment.user?.name?.trim() || "user";
    const role = comment.userId === this.env.AGENT_ID ? "assistant" : "user";
    const text = comment.data.trim();
    if (!text) continue;

    if (existingIds.has(comment.id)) continue;
    existingIds.add(comment.id);

    await thread.appendMessage({
      id: comment.id,
      role,
      metadata: { name, authorRole: role },
      parts: [
        {
          type: "text",
          text: role === "user" ? `${name}: ${text}` : text,
        },
      ],
    } as SessionMessage);
  }
}

async function runThreadTurn(
  this: Lyzy,
  thread: Conversation,
  session: ToolSession,
  options: { allowOverflowRetry: boolean },
): Promise<GenerateResult> {
  const history = (await thread.getHistory()) as UIMessage[];
  const system = await buildSystemPrompt.call(this);
  const agentTools = this.getTools();
  const contextTools = await this.context.tools();
  const tools = { ...contextTools, ...agentTools };

  try {
    return await generateText({
      model: this.resolveModel(),
      instructions: system,
      messages: await convertToModelMessages(history),
      tools: tools,
      toolsContext: toolsContextFor(session, agentTools),
      stopWhen: stepCountIs(this.maxSteps),
    });
  } catch (error) {
    if (!options.allowOverflowRetry) throw error;

    const classification = this.classifyChatError(error);
    if (classification !== "context_overflow") throw error;

    const compacted = await thread.compact();
    if (!compacted) throw error;

    return runThreadTurn.call(this, thread, session, { allowOverflowRetry: false });
  }
}

async function buildSystemPrompt(this: Lyzy): Promise<string> {
  const system = await this.context.freezeSystemPrompt();
  const reminder = await this.context.reminder();
  return reminder ? `${system}\n\n${reminder}` : system;
}

async function summarize(this: Lyzy, prompt: string): Promise<string> {
  const result = await generateText({
    model: this.resolveModel(),
    prompt,
  });
  return result.text;
}

function assistantMessageFromResult(result: GenerateResult): UIMessage {
  const parts: UIMessage["parts"] = [];

  for (const call of result.toolCalls) {
    const matched = result.toolResults.find((r) => r.toolCallId === call.toolCallId);
    parts.push({
      type: `tool-${call.toolName}`,
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      state: "output-available",
      input: call.input,
      output: matched?.output,
    } as UIMessage["parts"][number]);
  }

  const text = result.text.trim();
  if (text.length > 0) {
    parts.push({ type: "text", text });
  }

  if (parts.length === 0) {
    parts.push({ type: "text", text: "" });
  }

  return {
    id: crypto.randomUUID(),
    role: "assistant",
    parts,
  };
}
