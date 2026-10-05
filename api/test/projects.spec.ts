import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("API worker", () => {
  it("serves health and project routes", async () => {
    const health = await SELF.fetch("https://api.invalid/health");
    expect(health.status).toBe(200);

    const create = await SELF.fetch("https://api.invalid/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brief: "Launch SecureEdge for enterprise CTOs in US and UK.",
        documents: [
          {
            name: "hero.png",
            mime: "image/png",
            text: "fake-image-bytes",
          },
        ],
      }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as {
      projectId: string;
      project?: { name: string };
      nodes: { kind: string; title?: string }[];
    };
    expect(created.projectId.length).toBeGreaterThan(0);
    expect(created.project?.name).toBe("Untitled project");
    expect(created.nodes.some((n) => n.kind === "brief")).toBe(true);
    const doc = created.nodes.find((n) => n.kind === "doc");
    expect(doc).toBeTruthy();
    expect(doc?.title ?? "").toBe("");

    const list = await SELF.fetch("https://api.invalid/api/projects");
    const listed = (await list.json()) as { projects: { id: string; name: string }[] };
    const row = listed.projects.find((p) => p.id === created.projectId);
    expect(row?.name).toBe("Untitled project");
  });
});
