const ALLOW_HEADERS = "Content-Type, Authorization, X-Client-Id";
const ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";

export function corsHeaders(origin: string | null): HeadersInit {
  const allowed =
    origin && (origin.includes("localhost") || origin.includes("127.0.0.1")) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
  };
}

export function json(data: unknown, init: ResponseInit = {}, origin: string | null = null) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    headers.set(key, value);
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}
