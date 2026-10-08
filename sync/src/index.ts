import { handleApi } from "./routes";
export { WorkspaceSync } from "./sync/WorkspaceSync";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleApi(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
