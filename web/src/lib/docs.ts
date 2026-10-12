export const PROJECT_DOC_ACCEPT =
  "image/png,image/jpeg,image/jpg,image/gif,image/webp,image/avif,image/svg+xml,.pdf,application/pdf";

/** Per-file upload cap, enforced by the API (Workers buffer uploads in memory). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
/** Max attachments on a single project kickoff. */
export const MAX_KICKOFF_FILES = 10;

export function isAllowedProjectDoc(file: Pick<File, "name" | "type">): boolean {
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|avif)$/.test(name)) {
    return true;
  }
  return mime === "application/pdf" || name.endsWith(".pdf");
}

export function filterAllowedProjectDocs(files: FileList | File[]): File[] {
  return Array.from(files).filter(
    (file) => isAllowedProjectDoc(file) && file.size <= MAX_UPLOAD_BYTES,
  );
}
