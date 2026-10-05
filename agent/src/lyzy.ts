import { Think, type Session } from "@cloudflare/think";
import { AgentSearchProvider, type ContextConfig } from "agents/context";
import { createCompactFunction, type Session as Conversation } from "agents/sessions";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { BoardState } from "@lyzyos/db";
import {
  ensureSchema,
  getProject,
  insertEdge,
  insertPlanningNode,
  listDocuments,
  listPlanningNodes,
  loadBoard,
  LYZY_USER,
  nextNodePosition,
  touchProject,
  updateProjectName,
  updateProjectThread,
} from "@lyzyos/db";

const SOUL = `You are Lyzy, the planning agent for a marketing operations workspace.

You learn from client briefs and documents. Facts that should persist go in the memory block via set_context.

The human team sees a planning board stored in the database. When you learn something important, it becomes summary or question nodes they can respond to.

On kickoff, call set_project_title with a short campaign name before finishing intake.

Ask concise clarification questions when the brief is ambiguous. Prefer facts from documents and the brief over assumptions.`;

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
    await ensureSchema(this.env.DB);
    const board = await loadBoard(this.env.DB, input.projectId);
    if (!board) throw new Error("Project not found.");
    const next: BoardState = {
      projectId: board.project.id,
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
    await ensureSchema(this.env.DB);
    const existing = await listPlanningNodes(this.env.DB, input.projectId);
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

    const project = await getProject(this.env.DB, input.projectId);
    if (!project) {
      this.setState({ ...this.state, agentStatus: "error", agentMessage: "Project missing." });
      return;
    }

    const docs = await listDocuments(this.env.DB, input.projectId);
    for (const doc of docs) {
      const text = doc.textExtract.trim();
      if (text.length > 0) {
        await this.keep({ name: doc.name, text });
      }
    }

    const thread = await this.openThread({ title: "Planning" });
    await updateProjectThread(this.env.DB, input.projectId, thread.id);

    const brief = project.brief.trim();
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
              title: z
                .string()
                .min(2)
                .max(80)
                .describe("Short human-facing campaign name. No markdown. Not 'Untitled project'."),
            }),
            execute: async ({ title }) => {
              const cleaned = title
                .trim()
                .replace(/^#+\s*/, "")
                .slice(0, 80);
              if (cleaned.length === 0) {
                return { ok: false as const, error: "Empty title" };
              }
              await updateProjectName(this.env.DB, input.projectId, cleaned);
              return { ok: true as const, title: cleaned };
            },
          }),
        },
        stopWhen: stepCountIs(4),
        prompt: `You are a campaign planning agent. Analyze the brief and documents.

1. Call set_project_title with a short campaign name (product + campaign type is fine).
2. Then return ONLY valid JSON with keys:
   - "summary" (string, 2-4 sentences)
   - "questions" (array of up to 4 short strings the client should answer)

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
        ? "Initial read complete. A few details still need confirmation before planning continues."
        : "Documents received. Add a brief or answer questions so planning can continue.";
      questions = defaultQuestions(brief, docs.length);
    }

    const summaryPos = await nextNodePosition(this.env.DB, input.projectId, 3);
    const summaryId = crypto.randomUUID();
    await insertPlanningNode(this.env.DB, {
      id: summaryId,
      projectId: input.projectId,
      kind: "summary",
      title: "What Lyzy understood",
      body: summary,
      authorKind: "agent",
      authorName: LYZY_USER.name,
      x: summaryPos.x,
      y: summaryPos.y,
    });

    let qIndex = 0;
    for (const question of questions.slice(0, 4)) {
      const qPos = await nextNodePosition(this.env.DB, input.projectId, 4);
      const qId = crypto.randomUUID();
      await insertPlanningNode(this.env.DB, {
        id: qId,
        projectId: input.projectId,
        kind: "question",
        title: "Needs your input",
        body: question,
        authorKind: "agent",
        authorName: LYZY_USER.name,
        status: "open",
        x: qPos.x,
        y: qPos.y + qIndex * 24,
      });
      await insertEdge(this.env.DB, {
        id: crypto.randomUUID(),
        projectId: input.projectId,
        sourceId: summaryId,
        targetId: qId,
      });
      qIndex += 1;
    }

    await touchProject(this.env.DB, input.projectId);
    await this.refreshBoard({ projectId: input.projectId });
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
      const pos = await nextNodePosition(this.env.DB, input.projectId, 3);
      await insertPlanningNode(this.env.DB, {
        id: crypto.randomUUID(),
        projectId: input.projectId,
        kind: "summary",
        title: "Lyzy noted",
        body: result.text.trim(),
        authorKind: "agent",
        authorName: LYZY_USER.name,
        x: pos.x,
        y: pos.y,
      });
    } catch {
      /* board already has the human answer */
    }

    await touchProject(this.env.DB, input.projectId);
    await this.refreshBoard({ projectId: input.projectId });
    this.setState({ ...this.state, agentStatus: "ready", agentMessage: "Updated" });
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
  const qs: string[] = [];
  if (brief.length < 40) qs.push("What is the primary business objective for this campaign?");
  if (docCount === 0) qs.push("Can you share brand guidelines or approved product claims?");
  qs.push("Who is the target audience and which markets should we prioritize?");
  qs.push("What is the target launch date and success metrics?");
  return qs.slice(0, 4);
}
