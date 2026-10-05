import { createAuthClient } from "better-auth/react";

/** Browser client. Auth is not enforced yet — API treats everyone as the default user. */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
