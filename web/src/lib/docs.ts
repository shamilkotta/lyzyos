export const PROJECT_DOC_ACCEPT =
  "image/png,image/jpeg,image/jpg,image/gif,image/webp,image/avif,image/svg+xml,.pdf,application/pdf";

export function isAllowedProjectDoc(file: Pick<File, "name" | "type">): boolean {
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|avif)$/.test(name)) {
    return true;
  }
  if (mime === "application/pdf" || name.endsWith(".pdf")) return true;
  return false;
}

export function filterAllowedProjectDocs(files: FileList | File[]): File[] {
  return Array.from(files).filter(isAllowedProjectDoc);
}
