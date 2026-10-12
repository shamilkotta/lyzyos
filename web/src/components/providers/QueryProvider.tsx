"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { routes } from "@/lib/routes";

/**
 * Pages are static shells, so an expired session only surfaces when an API call answers 401
 * (the proxy just checks that a session cookie exists). Send the user to sign in again.
 */
function redirectOnUnauthorized(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 401) return;
  const { pathname, search } = window.location;
  if (pathname.startsWith(routes.login)) return;
  const login = new URL(routes.login, window.location.origin);
  login.searchParams.set("next", `${pathname}${search}`);
  window.location.replace(login);
}

function shouldRetry(failureCount: number, error: unknown) {
  // Client errors (auth, validation, not found) won't fix themselves on retry.
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 1;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: redirectOnUnauthorized }),
        mutationCache: new MutationCache({ onError: redirectOnUnauthorized }),
        defaultOptions: {
          queries: { staleTime: 5_000, retry: shouldRetry },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
