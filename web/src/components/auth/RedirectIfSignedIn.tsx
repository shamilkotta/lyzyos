"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { routes } from "@/lib/routes";

/**
 * Sends already signed-in users from the auth pages into the app. This asks the server whether
 * the session is valid — a cookie alone can outlive its session, so the proxy can't decide this.
 */
export function RedirectIfSignedIn() {
  const router = useRouter();
  const { data } = useSession();
  const signedIn = Boolean(data?.session);

  useEffect(() => {
    if (signedIn) router.replace(routes.projects);
  }, [router, signedIn]);

  return null;
}
