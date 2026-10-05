/** Optional HTTP wake-up of the agent worker. API stays usable if agent is offline. */

export function notifyAgent(
  env: Env,
  ctx: ExecutionContext,
  path: "/agent/kickoff" | "/agent/refresh" | "/agent/continue" | "/agent/ingest",
  body: Record<string, unknown>,
): void {
  const origin = env.AGENT_ORIGIN?.replace(/\/+$/, "");
  if (!origin) return;

  ctx.waitUntil(
    fetch(`${origin}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok) {
          console.warn(`agent ${path} → ${res.status}`);
        }
      })
      .catch((err) => {
        console.warn(`agent ${path} failed`, err);
      }),
  );
}
