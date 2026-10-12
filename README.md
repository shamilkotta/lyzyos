<div align="center">

# Lyzy OS

### The agentic workbench for cross-team collaboration, handoffs, and project execution

An AI teammate that lives inside your project, connects every team's workspace, and makes sure no context gets lost between planning, research, legal, creative, and delivery.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#license)
[![Built on Cloudflare](https://img.shields.io/badge/built%20on-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

[Features](#features) · [How it works](#how-it-works) · [Architecture](#architecture) · [Quick start](#quick-start) · [FAQ](#faq)

</div>

---

## What is Lyzy OS?

**Lyzy OS is an AI-native collaboration platform where teams and an AI agent work side by side on a shared visual canvas.** Each team or project stage gets its own workspace. The agent, **Lyzy**, works across all of them: it carries knowledge between teams, plans and tracks work, flags blockers, and follows up on pending items so handoffs don't lose information.

Most project tools store work. Lyzy OS gives the work an owner that remembers it. The agent reads the briefs, joins the threads, writes notes onto the canvas, keeps workspace statuses current, and checks back on anything still waiting for an answer.

**Good fit for:**

- Agencies running client projects across strategy, research, creative, legal, and delivery teams
- Product and go-to-market teams coordinating launches across departments
- Any multi-team project where knowledge gets lost at handoffs

## Why Lyzy OS?

| The problem                                     | How Lyzy OS handles it                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Context gets lost when work moves between teams | The agent carries knowledge across workspaces and links related work on the canvas                         |
| Nobody knows what's blocked or waiting          | Each workspace has a live status, a status note, and an attention banner, all kept up to date by the agent |
| Follow-ups fall through the cracks              | The agent keeps a watchlist and reviews it on a schedule, following up on stale items                      |
| Briefs and documents sit unread                 | Upload documents once; the agent reads them and stores the key facts in long-term project memory           |
| Chat tools and project boards are separate      | Conversations, notes, and documents all live as connected nodes on one canvas                              |

## Features

### 🤖 An AI agent that works as a teammate

- **Project-scoped agent:** Lyzy works on one project from briefing to delivery and stays within that project's scope.
- **Persistent memory:** shared _soul_ and _memory_ blocks persist across every thread, so the agent keeps what it learned after chat history is compacted.
- **Watchlist and scheduled follow-ups:** the agent tracks pending questions, escalations, and reminders, and reviews them periodically on its own.
- **Joins the conversation only when useful:** mention `@lyzy` in a thread, or let it follow along. It replies when it has something to add and stays quiet otherwise.
- **Tool use:** the agent can create workspaces, add notes and comment threads, connect nodes, update statuses, add members, and read uploaded documents.

### 🧭 Visual, multi-workspace canvas

- **Workspaces as teams or stages:** planning, research, legal, creative, or whatever your project needs, each on its own interactive canvas.
- **Nodes and edges:** notes, comment threads, and documents as nodes, with edges showing how they relate.
- **Project overview graph:** see every workspace's status and attention items in one place.

### ⚡ Real-time collaboration

- **Live sync** over WebSockets using Cloudflare Durable Objects.
- **Team presence:** see who is online and when the agent is working.
- **Optimistic UI** so the canvas responds immediately.

### 🔐 Team and access management

- Email/password authentication with [Better Auth](https://www.better-auth.com), plus password reset flows
- Admin roles, project members, and workspace members
- Project archiving

## How it works

```
 Team members ──► Workspace canvas (notes, threads, documents)
                         │
                         ▼
                  Lyzy (AI agent)
       ┌──────────────┼───────────────┐
       ▼              ▼               ▼
  Project memory  Workspace status  Watchlist
  (facts, briefs) (status, notes,   (follow-ups,
                   attention)        escalations)
       │              │               │
       └──────► Cross-workspace handoffs ◄──────┘
```

1. **Create a project** and add workspaces for each team or stage.
2. **Kick off** with a brief or upload documents. Lyzy reads them and saves the key facts to memory.
3. **Collaborate** in threads on the canvas. Lyzy answers, asks clarifying questions, and adds notes.
4. **Hand off** between workspaces. Lyzy brings the relevant context into the next team's workspace and links the related work.
5. **Stay on track.** Lyzy updates workspace statuses, raises blockers, and follows up on its watchlist.

## Architecture

Lyzy OS is a TypeScript monorepo that runs entirely on the **Cloudflare developer platform**.

```
.
├── web/              # Next.js 16 app (React 19, Tailwind 4, React Flow) deployed via OpenNext on Workers
├── agent/            # Lyzy AI agent: Cloudflare Agents SDK + Think, Workers AI, Durable Objects
├── sync/             # Real-time sync worker: WebSockets + Durable Objects
└── packages/
    ├── auth/         # Shared Better Auth configuration (server + client)
    ├── db/           # Drizzle ORM schema, D1 migrations, R2 helpers
    └── utils/        # Shared utilities
```

| Layer        | Technology                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Frontend     | Next.js 16, React 19, Tailwind CSS 4, React Flow (`@xyflow/react`), TanStack Query                                 |
| AI agent     | [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/), `@cloudflare/think`, Vercel AI SDK, Workers AI |
| Real-time    | Cloudflare Durable Objects, WebSockets                                                                             |
| Database     | Cloudflare D1 (SQLite) with Drizzle ORM                                                                            |
| File storage | Cloudflare R2                                                                                                      |
| Auth         | Better Auth                                                                                                        |
| Tooling      | pnpm workspaces, oxlint, oxfmt, Wrangler                                                                           |

## Quick start

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) 11+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (Workers AI, D1, R2, and Durable Objects are needed for deployment; local dev runs through Wrangler)

### 1. Clone and install

```bash
git clone https://github.com/shamilkotta/lyzyos.git
cd lyzyos
pnpm install
```

### 2. Configure environment variables

Copy the example files and fill in the values:

```bash
cp web/.dev.vars.example web/.dev.vars
cp sync/.dev.vars.example sync/.dev.vars
cp agent/.dev.vars.example agent/.dev.vars
```

| Variable             | Description                                                           |
| -------------------- | --------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET` | Random secret for auth sessions (`openssl rand -base64 32`)           |
| `BETTER_AUTH_URL`    | Public URL of the web app, e.g. `http://localhost:3000`               |
| `WEB_ORIGIN`         | Allowed web origin for CORS                                           |
| `INTERNAL_SECRET`    | Shared secret for service-to-service calls; must match across workers |
| `EMAIL_FROM_ADDRESS` | Verified sender address for auth emails                               |

### 3. Set up the database

```bash
pnpm db migrate
```

### 4. Run locally

```bash
pnpm dev
```

This starts the web app at `http://localhost:3000` and the sync + agent workers at `http://localhost:8788`.

### Deploy to Cloudflare

```bash
pnpm db migrate:remote
pnpm agent exec wrangler deploy
pnpm sync exec wrangler deploy
pnpm web deploy
```

## Useful scripts

| Command                       | What it does                                     |
| ----------------------------- | ------------------------------------------------ |
| `pnpm dev`                    | Run web, sync, and agent locally                 |
| `pnpm lint` / `pnpm lint:fix` | Lint every package with oxlint                   |
| `pnpm format`                 | Format the codebase with oxfmt                   |
| `pnpm db generate`            | Generate a new Drizzle migration                 |
| `pnpm db migrate`             | Apply migrations to the local D1 database        |
| `pnpm db reset`               | Reset the local database and re-apply migrations |

## FAQ

**What is an agentic workbench?**
A workspace where an AI agent works as a participant alongside people rather than as a side panel. In Lyzy OS the agent has its own memory, tools, and schedule, and it takes actions on the shared canvas.

**How does Lyzy OS differ from Notion, Linear, or Miro?**
Those tools hold work and leave the coordination to people. Lyzy OS adds an autonomous agent that does part of that coordination: it carries context between teams, tracks blockers, and follows up on open items.

**Which AI model does it use?**
The agent runs on Cloudflare Workers AI through the Vercel AI SDK, so you can switch to another AI SDK-compatible model provider.

**Can I self-host it?**
Yes. Lyzy OS is open source and deploys to your own Cloudflare account.

**Is it only for marketing agencies?**
No. The default agent persona targets brand, product marketing, and go-to-market work, but the system prompt in `agent/src/system.ts` can be changed for any domain: product development, consulting, research, operations, and so on.

## Roadmap

- [ ] More node types (tasks, checklists, rich media)
- [ ] Integrations (Slack, Google Drive, Notion)
- [ ] Configurable agent personas per project
- [ ] Bring-your-own model provider settings in the UI

## Contributing

Contributions are welcome. To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit using [Conventional Commits](https://www.conventionalcommits.org)
4. Run `pnpm lint` and `pnpm format:check`
5. Open a pull request

For anything large, please open an issue first so we can discuss it.

## License

Released under the [MIT License](LICENSE).

---

<div align="center">

If Lyzy OS is useful to you, please ⭐ the repo.

**Keywords:** AI agent, agentic workflow, AI teammate, multi-agent collaboration, team collaboration platform, project management AI, cross-team handoffs, knowledge management, AI project manager, visual canvas, Cloudflare Workers, Durable Objects, Next.js, open source.

</div>
