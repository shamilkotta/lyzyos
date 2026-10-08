export function clientIdFromRequest(request: Request): string | null {
  const header = request.headers.get("X-Client-Id")?.trim();
  return header && header.length > 0 ? header : null;
}
