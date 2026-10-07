import { Think, type Session } from "@cloudflare/think";
import { AgentSearchProvider, type ContextConfig } from "agents/context";
import { createCompactFunction, type Session as Conversation } from "agents/sessions";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { BoardState } from "@lyzyos/db";
import {
  appendCommentReply,
  applyCommentHandoff,
  buildCommentChat,
  formatCommentChat,
  getProject,
  getProjectNode,
  getProjectWorkspace,
  insertEdge,
  insertPlanningNode,
  latestCommentMessage,
  listLinkedNodes,
  listWorkspaces,
  listDocuments,
  loadBoard,
  loadPlanningBoard,
  LYZY_USER,
  rowToNode,
  markCommentResolved,
  nextNodePosition,
  serializeCommentMeta,
  touchProject,
  updateProjectName,
  updatePlanningNode,
  updateProjectThread,
} from "@lyzyos/db";
import {
  publishBoardReplace,
  publishEdgeUpserted,
  publishNodeUpserted,
  publishProjectUpdated,
} from "./publish";

const SOUL = `You are Lyzy, the project agent for a marketing operations workbench.

You are scoped to one project. You may read every workspace in that project and create or update
workspace nodes when doing requested work. Facts that should persist go in project memory.

Only act when initialized or explicitly mentioned in a comment with @Lyzy or @agent. Do not react to
ordinary board edits. In comment threads, treat messages as a chat: each turn is labeled human or
agent. Never reply to your own messages; only address the latest human turn that needs you.
Never make legal approvals or publish campaigns; create recommendations and questions for human
decisions instead.

On kickoff, call set_project_title with a short title before finishing intake.

Default to asking no questions. Prefer facts from documents and the brief; proceed with reasonable assumptions when possible. Ask only if the situation truly demands a client-only answer to understand the project or unblock next steps — never ask what research or strategy can discover later.`;

export type ThreadSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type ThreadLine = {
  id: string;
  role: string;
  text: string;
};

const emptyBoard = (): BoardState => ({
  projectId: "",
  workspace: null,
  projectName: "",
  planningStatus: "in_progress",
  threadId: null,
  nodes: [],
  edges: [],
  agentStatus: "idle",
});

export class Lyzy extends Think<Env, BoardState> {
  initialState = emptyBoard();

  private readonly library = new AgentSearchProvider(this);

  getModel() {
    return "@cf/moonshotai/kimi-k2.7-code";
  }

  configureContext(): ContextConfig[] {
    this.library.init("library");
    return [
      {
        label: "soul",
        description: "Standing instructions",
        provider: { get: async () => SOUL },
      },
      {
        label: "memory",
        description: "Facts this agent has learned. Replace the whole block when a fact changes.",
        maxTokens: 4_000,
        whenChanged: "remind",
      },
      {
        label: "catalog",
        description: "Documents kept in the workspace and the searchable library.",
        maxTokens: 2_000,
        whenChanged: "remind",
      },
      {
        label: "library",
        description:
          "Full text of kept documents. Search this, then read the workspace file named in the catalog.",
        provider: this.library,
      },
    ];
  }

  configureSession(session: Session) {
    return session
      .onCompaction(createCompactFunction({ summarize: (prompt) => this.summarize(prompt) }))
      .compactAfter(80_000);
  }

  async refreshBoard(input: { projectId: string }): Promise<BoardState> {
    const board = await loadPlanningBoard(this.env.DB, input.projectId);
    if (!board) throw new Error("Project not found.");
    const next: BoardState = {
      projectId: board.project.id,
      workspace: board.workspace,
      projectName: board.project.name,
      planningStatus: board.project.planningStatus,
      threadId: board.project.threadId,
      nodes: board.nodes,
      edges: board.edges,
      agentStatus: this.state.agentStatus ?? "idle",
      agentMessage: this.state.agentMessage,
    };
    this.setState(next);
    return next;
  }

  async startKickoff(input: { projectId: string }): Promise<void> {
    const project = await getProject(this.env.DB, input.projectId);
    if (!project) {
      throw new Error(
        `Project ${input.projectId} not found in agent D1. Local api/agent must share persist-to.`,
      );
    }
    const board = await loadPlanningBoard(this.env.DB, input.projectId);
    if (!board) throw new Error("Planning workspace not found.");
    const existing = board.nodes;
    if (existing.some((n) => n.kind === "summary")) {
      await this.refreshBoard({ projectId: input.projectId });
      this.setState({
        ...this.state,
        agentStatus: "ready",
        agentMessage: this.state.agentMessage ?? "Intake ready",
      });
      return;
    }

    this.setState({ ...this.state, agentStatus: "thinking", agentMessage: "Reading intake…" });

    const docs = await listDocuments(this.env.DB, input.projectId);
    for (const doc of docs) {
      const text = doc.textExtract.trim();
      if (text.length > 0) {
        await this.keep({ name: doc.name, text });
      }
    }

    const thread = await this.openThread({ title: "Planning" });
    await updateProjectThread(this.env.DB, input.projectId, thread.id);

    const intake = board.nodes
      .filter((node) => node.kind === "brief")
      .map((node) => node.body)
      .join("\n\n");
    const brief = intake || project.brief.trim();
    if (brief.length > 0) {
      await this.append({ thread: thread.id, role: "user", text: brief });
    }

    const docSnippet = docs
      .map((d) => `### ${d.name}\n${d.textExtract.slice(0, 2000)}`)
      .join("\n\n");

    let summary = "Campaign Manager is reviewing the intake.";
    let questions: string[] = [];

    try {
      const result = await generateText({
        model: this.resolveModel(),
        tools: {
          set_project_title: tool({
            description:
              "Set the project title shown in the workspace. Call once after reading the brief.",
            inputSchema: z.object({
              title: z.string().min(1).max(80).describe("Short campaign / project title."),
            }),
            execute: async ({ title }) => {
              const cleaned = title.trim().slice(0, 80);
              if (cleaned.length === 0) {
                return { ok: false as const, error: "Empty title" };
              }
              await updateProjectName(this.env.DB, input.projectId, cleaned);
              await publishProjectUpdated(this.env, input.projectId, board.workspace.id);
              return { ok: true as const, title: cleaned };
            },
          }),
        },
        stopWhen: stepCountIs(4),
        prompt: `You are a campaign planning agent. Analyze the brief and documents.

1. Call set_project_title with a short title (any format is fine).
2. Then return ONLY valid JSON with keys:
   - "summary" (string, 2-4 sentences)
   - "questions" (array of strings — prefer [])

Questions are optional. Default to []. Try to skip them.
Only include a question when the situation demands it: a blocker you cannot reasonably assume past, and only the client can answer (preferences, constraints, approvals, internal goals, stakeholders, non-public brand rules, etc.).
Do NOT ask anything research or strategy can figure out later (market, competitors, channels, creative angles, public audience insights, etc.).
If the brief/docs are enough to move forward, return "questions": [].

Brief:
${brief || "(none)"}

Documents:
${docSnippet || "(none)"}`,
      });
      const parsed = parseAnalysis(result.text);
      summary = parsed.summary;
      questions = parsed.questions;
    } catch {
      summary = brief
        ? "Initial read complete. Ready to continue planning from the brief and documents."
        : "Documents received. Add a brief if you want planning shaped around a specific goal.";
      questions = defaultQuestions(brief, docs.length);
    }

    const summaryPos = await nextNodePosition(this.env.DB, board.workspace.id, 3);
    const summaryId = crypto.randomUUID();
    const summaryNode = await insertPlanningNode(this.env.DB, {
      id: summaryId,
      projectId: input.projectId,
      workspaceId: board.workspace.id,
      kind: "summary",
      title: "What Lyzy understood",
      body: summary,
      authorKind: "agent",
      authorName: LYZY_USER.name,
      x: summaryPos.x,
      y: summaryPos.y,
    });
    await publishNodeUpserted(this.env, board.workspace.id, summaryNode);

    let qIndex = 0;
    for (const question of questions) {
      const qPos = await nextNodePosition(this.env.DB, board.workspace.id, 4);
      const qId = crypto.randomUUID();
      const questionNode = await insertPlanningNode(this.env.DB, {
        id: qId,
        projectId: input.projectId,
        workspaceId: board.workspace.id,
        kind: "question",
        title: "",
        body: question,
        authorKind: "agent",
        authorName: LYZY_USER.name,
        status: "open",
        meta: serializeCommentMeta({
          replies: [],
          openAudience: { kind: "everyone" },
        }),
        x: qPos.x,
        y: qPos.y + qIndex * 24,
      });
      await publishNodeUpserted(this.env, board.workspace.id, questionNode);
      const edgeId = crypto.randomUUID();
      await insertEdge(this.env.DB, {
        id: edgeId,
        workspaceId: board.workspace.id,
        sourceId: summaryId,
        targetId: qId,
      });
      await publishEdgeUpserted(this.env, board.workspace.id, {
        id: edgeId,
        sourceId: summaryId,
        targetId: qId,
      });
      qIndex += 1;
    }

    await touchProject(this.env.DB, input.projectId);
    await this.refreshBoard({ projectId: input.projectId });
    await publishBoardReplace(this.env, board.workspace.id);
    this.setState({
      ...this.state,
      agentStatus: "ready",
      agentMessage: questions.length > 0 ? "Waiting on your answers" : "Intake ready",
    });
  }

  async continuePlanning(input: { projectId: string; userMessage: string }): Promise<void> {
    const project = await getProject(this.env.DB, input.projectId);
    if (!project?.threadId) return;

    this.setState({ ...this.state, agentStatus: "thinking", agentMessage: "Updating plan…" });
    await this.append({ thread: project.threadId, role: "user", text: input.userMessage });

    try {
      const result = await generateText({
        model: this.resolveModel(),
        prompt: `The client answered: "${input.userMessage}"
Write one short paragraph summarizing what this answer implies for the campaign plan.`,
      });
      const board = await loadPlanningBoard(this.env.DB, input.projectId);
      if (!board) return;
      const pos = await nextNodePosition(this.env.DB, board.workspace.id, 3);
      const note = await insertPlanningNode(this.env.DB, {
        id: crypto.randomUUID(),
        projectId: input.projectId,
        workspaceId: board.workspace.id,
        kind: "summary",
        title: "Lyzy noted",
        body: result.text.trim(),
        authorKind: "agent",
        authorName: LYZY_USER.name,
        x: pos.x,
        y: pos.y,
      });
      await publishNodeUpserted(this.env, board.workspace.id, note);
    } catch {
      /* board already has the human answer */
    }

    await touchProject(this.env.DB, input.projectId);
    await this.refreshBoard({ projectId: input.projectId });
    this.setState({ ...this.state, agentStatus: "ready", agentMessage: "Updated" });
  }

  async invokeFromNode(input: {
    projectId: string;
    workspaceId: string;
    nodeId: string;
  }): Promise<void> {
    const source = await getProjectNode(this.env.DB, input.projectId, input.nodeId);
    const workspace = await getProjectWorkspace(this.env.DB, input.projectId, input.workspaceId);
    if (!source || !workspace || source.workspaceId !== workspace.id) {
      throw new Error("Mention source not found.");
    }
    const sourceDto = rowToNode(source);

    this.setState({ ...this.state, agentStatus: "thinking", agentMessage: "Working on mention…" });

    const linked = await listLinkedNodes(this.env.DB, source.workspaceId, source.id);
    const linkedRefs = linked.map((node) => {
      const dto = rowToNode(node);
      return {
        id: dto.id,
        kind: dto.kind,
        title: dto.title,
        preview: dto.body.slice(0, 240),
      };
    });
    const chat = buildCommentChat({
      body: sourceDto.body,
      meta: sourceDto.meta,
      authorKind: sourceDto.authorKind,
      authorName: sourceDto.authorName,
    });
    const latest = latestCommentMessage(chat);

    // Nothing to do if the thread is empty or we already spoke last (avoids self-replies).
    if (!latest || latest.authorKind === "agent") {
      this.setState({
        ...this.state,
        agentStatus: "ready",
        agentMessage: latest ? "Already replied" : "Nothing to answer",
      });
      return;
    }

    const workspaceTools = {
      list_workspaces: tool({
        description: "List the workspaces available in this project.",
        inputSchema: z.object({}),
        execute: async () => ({
          workspaces: (await listWorkspaces(this.env.DB, input.projectId)).map((item) => ({
            id: item.id,
            slug: item.slug,
            name: item.name,
            kind: item.kind,
          })),
        }),
      }),
      read_workspace_nodes: tool({
        description: "Read all nodes in a project workspace by id or slug.",
        inputSchema: z.object({ workspace: z.string().min(1) }),
        execute: async ({ workspace: selector }) => {
          const target = await getProjectWorkspace(this.env.DB, input.projectId, selector);
          if (!target) return { error: "Workspace not found" };
          const board = await loadBoard(this.env.DB, target.id);
          return { nodes: board?.nodes ?? [] };
        },
      }),
      read_linked_nodes: tool({
        description:
          "Read nodes connected by edges to the current comment. Use when the prompt lists linked references.",
        inputSchema: z.object({}),
        execute: async () => {
          const nodes = await listLinkedNodes(this.env.DB, source.workspaceId, source.id);
          return {
            nodes: nodes.map((node) => {
              const dto = rowToNode(node);
              return {
                id: dto.id,
                kind: dto.kind,
                title: dto.title,
                body: dto.body,
                authorKind: dto.authorKind,
                authorName: dto.authorName,
                status: dto.status,
              };
            }),
          };
        },
      }),
      read_node: tool({
        description: "Read one project node by id for full context.",
        inputSchema: z.object({ nodeId: z.string().min(1) }),
        execute: async ({ nodeId }) => {
          const node = await getProjectNode(this.env.DB, input.projectId, nodeId);
          if (!node) return { error: "Node not found" };
          return { node };
        },
      }),
      create_workspace_node: tool({
        description:
          "Add a note, summary, or question to a project workspace. Use questions for human decisions.",
        inputSchema: z.object({
          workspace: z.string().min(1),
          kind: z.enum(["note", "summary", "question"]),
          title: z.string().max(120).optional(),
          body: z.string().min(1).max(20_000),
        }),
        execute: async ({ workspace: selector, kind, title, body }) => {
          const target = await getProjectWorkspace(this.env.DB, input.projectId, selector);
          if (!target) return { error: "Workspace not found" };
          const pos = await nextNodePosition(this.env.DB, target.id, 3);
          const node = await insertPlanningNode(this.env.DB, {
            id: crypto.randomUUID(),
            projectId: input.projectId,
            workspaceId: target.id,
            kind,
            title: kind === "question" ? "" : title?.trim() || "Note",
            body,
            authorKind: "agent",
            authorName: LYZY_USER.name,
            status: kind === "question" ? "open" : undefined,
            meta:
              kind === "question"
                ? serializeCommentMeta({
                    replies: [],
                    openAudience: { kind: "everyone" },
                  })
                : undefined,
            x: pos.x,
            y: pos.y,
          });
          await publishNodeUpserted(this.env, target.id, node);
          return { node };
        },
      }),
      update_workspace_node: tool({
        description:
          "Update the title or body of a project node. For comment threads, status may only be set to resolved.",
        inputSchema: z.object({
          nodeId: z.string().min(1),
          title: z.string().max(120).optional(),
          body: z.string().max(20_000).optional(),
          status: z.enum(["resolved"]).optional(),
        }),
        execute: async ({ nodeId, title, body, status }) => {
          const node = await getProjectNode(this.env.DB, input.projectId, nodeId);
          if (!node) return { error: "Node not found" };
          const dto = rowToNode(node);
          if (status === "resolved" && node.kind !== "comment") {
            return { error: "Only comment threads can be resolved." };
          }
          await updatePlanningNode(this.env.DB, nodeId, {
            title,
            body,
            ...(status === "resolved"
              ? { status: "resolved" as const, meta: markCommentResolved(dto.meta) }
              : {}),
          });
          const updated = await getProjectNode(this.env.DB, input.projectId, nodeId);
          if (updated) await publishNodeUpserted(this.env, updated.workspaceId, updated);
          return { ok: true };
        },
      }),
      read_memory: tool({
        description: "Read durable memory for this project agent.",
        inputSchema: z.object({}),
        execute: async () => ({ memory: this.context.getBlock("memory")?.content ?? "" }),
      }),
      remember: tool({
        description: "Store a durable project fact for future agent calls.",
        inputSchema: z.object({ fact: z.string().min(1).max(2_000) }),
        execute: async ({ fact }) => this.learn(fact),
      }),
      replace_memory: tool({
        description: "Replace project memory after correcting or consolidating facts.",
        inputSchema: z.object({ memory: z.string().max(12_000) }),
        execute: async ({ memory }) => this.replaceMemory(memory),
      }),
    };

    try {
      const result = await generateText({
        model: this.resolveModel(),
        tools: workspaceTools,
        stopWhen: stepCountIs(10),
        prompt: `You are Lyzy in a comment chat on the ${workspace.name} workspace.

Chat transcript (oldest → newest). Each turn shows who wrote it:
${formatCommentChat(chat)}

Latest message:
- Author: ${latest.authorName} (${latest.authorKind})
- Text: ${latest.body}

Rules:
- Messages labeled "(agent / you)" are your prior replies — do not answer them or continue them as if they were questions to you.
- Only respond to the latest human message above.
- If that human message does not need a reply (e.g. acknowledgment only and no ask), output an empty string.
- Reply concisely; your text is appended to this same comment thread as Lyzy.
- To ask everyone for a reply, include a clear question mark in your message.
- To ask one person, @mention them by first name (mention wins over a broadcast question).
- When the thread is done, call update_workspace_node with status "resolved" on this comment.

Linked node references (call read_linked_nodes or read_node for full content when needed):
${
  linkedRefs.length === 0
    ? "(none)"
    : linkedRefs
        .map(
          (node) => `- ${node.id} [${node.kind}] ${node.title || "(untitled)"} :: ${node.preview}`,
        )
        .join("\n")
}

Use project memory and workspace tools as needed. Prefer read_linked_nodes when the request depends on connected context.`,
      });

      const replyBody = result.text.trim();
      if (replyBody.length === 0) {
        this.setState({
          ...this.state,
          agentStatus: "ready",
          agentMessage: "No reply needed",
        });
        return;
      }

      const current = await getProjectNode(this.env.DB, input.projectId, source.id);
      if (!current) throw new Error("Comment disappeared during invoke.");
      const currentDto = rowToNode(current);
      const { meta: withReply } = appendCommentReply(currentDto.meta, {
        authorKind: "agent",
        authorName: LYZY_USER.name,
        body: replyBody,
      });
      const handoff = applyCommentHandoff({
        meta: withReply,
        currentStatus: current.status,
        authorKind: "agent",
        body: replyBody,
      });
      await updatePlanningNode(this.env.DB, source.id, {
        meta: handoff.meta,
        status: handoff.status,
      });
      const replied = await getProjectNode(this.env.DB, input.projectId, source.id);
      if (replied) await publishNodeUpserted(this.env, replied.workspaceId, replied);
      await touchProject(this.env.DB, input.projectId);
      await this.refreshBoard({ projectId: input.projectId });
      this.setState({ ...this.state, agentStatus: "ready", agentMessage: "Mention completed" });
    } catch (error) {
      this.setState({
        ...this.state,
        agentStatus: "error",
        agentMessage: error instanceof Error ? error.message : "Mention failed",
      });
      throw error;
    }
  }

  async ingestDocument(input: { projectId: string; name: string; text: string }): Promise<void> {
    if (input.text.trim().length > 0) {
      await this.keep({ name: input.name, text: input.text });
    }
  }

  async openThread(input?: { title?: string }): Promise<ThreadSummary> {
    this.ensureThreads();
    const now = Date.now();
    const thread: ThreadSummary = {
      id: crypto.randomUUID(),
      title: threadTitle(input?.title),
      createdAt: now,
      updatedAt: now,
    };
    void this.sql`
      INSERT INTO lyzy_threads (id, title, created_at, updated_at)
      VALUES (${thread.id}, ${thread.title}, ${thread.createdAt}, ${thread.updatedAt})
    `;
    this.conversation(thread.id);
    return thread;
  }

  async threads(): Promise<{ threads: ThreadSummary[] }> {
    this.ensureThreads();
    const rows = this.sql<{
      id: string;
      title: string;
      created_at: number;
      updated_at: number;
    }>`
      SELECT id, title, created_at, updated_at
      FROM lyzy_threads
      ORDER BY updated_at DESC
    `;
    return {
      threads: rows.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };
  }

  async append(input: {
    thread: string;
    role: "user" | "assistant";
    text: string;
  }): Promise<{ id: string }> {
    const text = input.text.trim();
    if (text.length === 0) throw new Error("Message is empty.");
    if (input.role !== "user" && input.role !== "assistant") {
      throw new Error("Message role must be user or assistant.");
    }
    this.requireThread(input.thread);
    const id = crypto.randomUUID();
    await this.conversation(input.thread).appendMessage({
      id,
      role: input.role,
      parts: [{ type: "text", text }],
    });
    void this.sql`
      UPDATE lyzy_threads SET updated_at = ${Date.now()} WHERE id = ${input.thread}
    `;
    return { id };
  }

  async transcript(thread: string): Promise<{ lines: ThreadLine[] }> {
    this.requireThread(thread);
    const history = await this.conversation(thread).getHistory();
    return {
      lines: history.map((message) => ({
        id: message.id,
        role: message.role,
        text: message.parts
          .map((part) => part.text ?? "")
          .filter((part) => part.length > 0)
          .join(""),
      })),
    };
  }

  async keep(input: { name: string; text: string }): Promise<{ name: string; path: string }> {
    const name = documentName(input.name);
    const text = input.text;
    if (text.trim().length === 0) throw new Error("Document is empty.");
    const path = `/library/${name}`;
    await this.workspace.writeFile(path, text);
    this.library.init("library");
    await this.library.set(name, text);
    const catalog = this.context.getBlock("catalog")?.content ?? "";
    await this.context.setBlock("catalog", upsertCatalog(catalog, name, path));
    await this.context.refreshSystemPrompt();
    return { name, path };
  }

  async read(name: string): Promise<{ text: string }> {
    const path = `/library/${documentName(name)}`;
    const text = await this.workspace.readFile(path);
    return { text: text ?? "" };
  }

  async recall(query: string): Promise<{ matches: string }> {
    const trimmed = query.trim();
    if (trimmed.length === 0) return { matches: "" };
    this.library.init("library");
    const matches = await this.library.search(trimmed);
    return { matches: matches ?? "" };
  }

  async learn(fact: string): Promise<{ memory: string }> {
    const text = fact.trim();
    if (text.length === 0) throw new Error("Nothing to learn.");
    const block = await this.context.appendToBlock("memory", `- ${text}`);
    await this.context.refreshSystemPrompt();
    return { memory: block.content };
  }

  async replaceMemory(memory: string): Promise<{ memory: string }> {
    const block = await this.context.setBlock("memory", memory.trim());
    await this.context.refreshSystemPrompt();
    return { memory: block.content };
  }

  async known(): Promise<{ memory: string; catalog: string; library: string }> {
    return {
      memory: this.context.getBlock("memory")?.content ?? "",
      catalog: this.context.getBlock("catalog")?.content ?? "",
      library: (await this.library.get()) ?? "",
    };
  }

  private async summarize(prompt: string): Promise<string> {
    const result = await generateText({ model: this.resolveModel(), prompt });
    return result.text;
  }

  private conversation(id: string): Conversation {
    return this.sessions
      .session(id)
      .onCompaction(createCompactFunction({ summarize: (prompt) => this.summarize(prompt) }))
      .compactAfter(80_000);
  }

  private ensureThreads(): void {
    void this.sql`
      CREATE TABLE IF NOT EXISTS lyzy_threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `;
  }

  private requireThread(id: string): void {
    this.ensureThreads();
    const rows = this.sql<{ id: string }>`SELECT id FROM lyzy_threads WHERE id = ${id}`;
    if (rows.length === 0) throw new Error("No thread.");
  }
}

function threadTitle(title: string | undefined): string {
  const trimmed = title?.trim() ?? "";
  if (trimmed.length === 0) return "New thread";
  return trimmed.slice(0, 120);
}

function documentName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 180) {
    throw new Error("Document name is empty or too long.");
  }
  if (
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("\0") ||
    trimmed === "." ||
    trimmed === ".."
  ) {
    throw new Error("Document name cannot include a path.");
  }
  return trimmed;
}

function upsertCatalog(current: string, name: string, path: string): string {
  const line = `- ${name}: ${path}`;
  const lines = current
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !entry.startsWith(`- ${name}:`));
  lines.push(line);
  return lines.join("\n");
}

function parseAnalysis(text: string): { summary: string; questions: string[] } {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON");
  const data = JSON.parse(jsonMatch[0]) as { summary?: string; questions?: string[] };
  return {
    summary: data.summary?.trim() || "Intake reviewed.",
    questions: (data.questions ?? []).map((q) => q.trim()).filter((q) => q.length > 0),
  };
}

function defaultQuestions(brief: string, docCount: number): string[] {
  // Fallback path only — keep empty unless intake is clearly unusable.
  if (brief.length < 40 && docCount === 0) {
    return ["What should this campaign achieve, and any hard constraints we must respect?"];
  }
  return [];
}
