import "server-only";

import type { AppEnv } from "./env";

export function notifyAgent(
  env: AppEnv,
  body: Record<string, unknown>,
  ctx?: { waitUntil: (p: Promise<unknown>) => void },
) {
  const agent = env.AGENT;
  if (!agent) return;

  const p = agent
    .fetch(
      new Request("https://agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": env.INTERNAL_SECRET,
        },
        body: JSON.stringify(body),
      }),
    )
    .then((res: Response) => {
      if (!res.ok) console.warn(`agent chat → ${res.status}`);
    })
    .catch((err: unknown) => {
      console.warn("agent chat failed", err);
    });

  if (ctx) {
    ctx.waitUntil(p);
  }
}
