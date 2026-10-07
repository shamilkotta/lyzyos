"use client";

import { useSession } from "@/lib/auth-client";

export function useCurrentUser() {
  const { data, isPending, error } = useSession();
  return {
    user: data?.user ?? null,
    isPending,
    error,
  };
}
