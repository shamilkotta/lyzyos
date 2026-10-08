const ALLOW_HEADERS = "Content-Type, Authorization, X-Client-Id";
const ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";

export function corsHeaders(origin: string | null): HeadersInit {
  const allowed =
    origin && (origin.includes("localhost") || origin.includes("127.0.0.1")) ? origin : null;
  return {
    ...(allowed
      ? {
          "Access-Control-Allow-Origin": allowed,
          "Access-Control-Allow-Credentials": "true",
        }
      : { "Access-Control-Allow-Origin": "*" }),
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
  };
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}
