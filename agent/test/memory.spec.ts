import { env, evictDurableObject, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Lyzy", () => {
  it("keeps documents and learned facts after the object is evicted", async () => {
    const id = crypto.randomUUID();
    const agent = env.AGENT.getByName(id);

    await agent.learn("The launch color is tide blue.");
    const kept = await agent.keep({
      name: "brand.md",
      text: "Tide blue is the only approved launch color. Green is rejected.",
    });
    await agent.keep({
      name: "notes.txt",
      text: "The spring brief asks for a quiet launch, not a countdown.",
    });

    expect(kept.path).toBe("/library/brand.md");
    await evictDurableObject(agent);

    const woke = env.AGENT.getByName(id);
    const known = await woke.known();
    expect(known.memory).toContain("tide blue");
    expect(known.catalog).toContain("/library/brand.md");
    expect(known.catalog).toContain("/library/notes.txt");
    expect(known.library).toContain("2 entries");

    expect((await woke.read("brand.md")).text).toContain("Green is rejected");
    expect((await woke.recall("quiet launch")).matches).toContain("spring brief");
    expect((await woke.recall("approved")).matches).toContain("Tide blue");
  });

  it("does not share memory between agents", async () => {
    const one = env.AGENT.getByName(crypto.randomUUID());
    const two = env.AGENT.getByName(crypto.randomUUID());
    await one.learn("Only the first agent knows this.");
    await one.keep({ name: "secret.md", text: "A private note for the first agent." });

    const known = await two.known();
    expect(known.memory).toBe("");
    expect(known.catalog).toBe("");
    expect(known.library).toBe("");
    expect((await two.read("secret.md")).text).toBe("");
  });

  it("replaces a document without duplicating its catalog line", async () => {
    const agent = env.AGENT.getByName(crypto.randomUUID());
    await agent.keep({ name: "brand.md", text: "The obsolete palette uses crimson." });
    await agent.keep({ name: "brand.md", text: "The current palette uses tide." });

    const known = await agent.known();
    expect(known.catalog).toBe("- brand.md: /library/brand.md");
    expect((await agent.read("brand.md")).text).toBe("The current palette uses tide.");
    expect((await agent.recall("tide")).matches).toContain("current palette");
    expect((await agent.recall("crimson")).matches).toBe("");
  });

  it("keeps separate transcripts on one shared memory", async () => {
    const id = crypto.randomUUID();
    const agent = env.AGENT.getByName(id);
    const launch = await agent.openThread({ title: "Launch" });
    const budget = await agent.openThread({ title: "Budget" });

    await agent.append({ thread: launch.id, role: "user", text: "The launch is in May." });
    await agent.append({
      thread: budget.id,
      role: "user",
      text: "Keep the budget under ten.",
    });
    await agent.learn("The client is Northwind.");
    await evictDurableObject(agent);

    const woke = env.AGENT.getByName(id);
    const threads = await woke.threads();
    expect(threads.threads.map((thread) => thread.title).sort()).toEqual(["Budget", "Launch"]);
    expect((await woke.transcript(launch.id)).lines.map((line) => line.text)).toEqual([
      "The launch is in May.",
    ]);
    expect((await woke.transcript(budget.id)).lines.map((line) => line.text)).toEqual([
      "Keep the budget under ten.",
    ]);
    expect((await woke.known()).memory).toContain("Northwind");

    const other = env.AGENT.getByName(crypto.randomUUID());
    expect((await other.threads()).threads).toEqual([]);
    expect((await other.known()).memory).toBe("");
  });

  it("serves health but not REST API", async () => {
    const health = await SELF.fetch("https://agent.invalid/health");
    expect(health.status).toBe(200);

    const api = await SELF.fetch("https://agent.invalid/api/projects");
    expect(api.status).toBe(404);
  });
});
