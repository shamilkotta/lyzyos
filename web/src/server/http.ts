import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "./env";
import { getSession } from "./session";

/** Thrown inside a route handler to short-circuit with a JSON error response. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/** Wraps a route handler so thrown `HttpError`s become `{ error }` JSON and nothing leaks a 500 page. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json(
          { error: error.message, ...(error.details ? { details: error.details } : {}) },
          { status: error.status },
        );
      }
      console.error(`${request.method} ${new URL(request.url).pathname} failed`, error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  };
}

/**
 * Resolves the signed-in user for an API call. Unlike page guards this never redirects: fetch
 * callers need a 401, not the login page's HTML.
 */
export async function requireApiSession() {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Unauthorized");
  return session;
}

/** Session + Cloudflare bindings, the preamble of nearly every route. */
export async function apiContext() {
  const [session, env] = await Promise.all([requireApiSession(), getEnv()]);
  return { session, env };
}

export function parseWith<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(400, "Validation failed", z.treeifyError(parsed.error));
  }
  return parsed.data;
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const raw: unknown = await request.json().catch(() => {
    throw new HttpError(400, "Invalid JSON");
  });
  return parseWith(schema, raw);
}

export async function readForm(request: Request) {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw new HttpError(400, "Expected multipart/form-data");
  }
  return request.formData().catch(() => {
    throw new HttpError(400, "Invalid form data");
  });
}

export function clientIdFromRequest(request: Request) {
  return request.headers.get("X-Client-Id")?.trim() || null;
}
