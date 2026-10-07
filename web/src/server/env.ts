import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export type AppEnv = CloudflareEnv;

export async function getEnv() {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

export async function getExecutionContext() {
  const { ctx } = await getCloudflareContext({ async: true });
  return ctx;
}
