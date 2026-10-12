import {
  createDb,
  documents,
  getObject,
  getWorkspaceForUser,
  previewKindFromMime,
} from "@lyzyos/db";
import { eq } from "drizzle-orm";
import { apiContext, HttpError, route } from "@/server/http";

type Params = { params: Promise<{ projectId: string; docId: string }> };

export const GET = route<Params>(async (_request, { params }) => {
  const [{ projectId, docId }, { session, env }] = await Promise.all([params, apiContext()]);

  const doc = await createDb(env.DB).query.documents.findFirst({
    where: eq(documents.id, docId),
    with: { thread: { columns: { workspaceId: true } } },
  });
  if (!doc?.thread) throw new HttpError(404, "Document not found");

  const workspace = await getWorkspaceForUser(env.DB, doc.thread.workspaceId, session.user.id);
  if (!workspace || workspace.projectId !== projectId) {
    throw new HttpError(404, "Document not found");
  }

  const obj = await getObject(env.FILES, doc.r2Key);
  if (!obj) throw new HttpError(404, "File missing");

  return new Response(obj.body, {
    headers: fileHeaders(doc.name, doc.mime || obj.httpMetadata?.contentType || ""),
  });
});

/**
 * Uploaded files are user-controlled and served from the app origin, so never let the browser
 * execute them: only media/PDF render inline with their own type, text is forced to text/plain,
 * and anything else is a download. The CSP sandbox also neuters scripts inside SVGs.
 */
function fileHeaders(name: string, rawMime: string) {
  const mime = rawMime.toLowerCase();
  const kind = previewKindFromMime(mime, name);
  // previewKindFromMime also trusts the extension; only echo the stored type back when it
  // really is that kind of media.
  const mediaType =
    (kind === "image" && mime.startsWith("image/")) ||
    (kind === "video" && mime.startsWith("video/")) ||
    (kind === "audio" && mime.startsWith("audio/")) ||
    (kind === "pdf" && mime === "application/pdf")
      ? mime
      : null;
  const contentType =
    mediaType ?? (kind === "text" ? "text/plain; charset=utf-8" : "application/octet-stream");
  const inline = contentType !== "application/octet-stream";

  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  if (kind === "image") headers.set("Content-Security-Policy", "sandbox");

  const filename = name.replace(/["\\\r\n]/g, "") || "file";
  headers.set(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${filename.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  return headers;
}
