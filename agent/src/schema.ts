import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

const messageSchema = z.object({
  // Lazy default: Workers forbid random generation at global scope, and an eager
  // value would also give every message the same id.
  id: z.string().default(() => crypto.randomUUID()),
  role: z.enum(["user", "assistant"]),
  name: nonEmpty,
  message: nonEmpty,
});

export const chatBodySchema = z
  .object({
    projectId: nonEmpty,
    threadId: nonEmpty,
    workspaceId: nonEmpty,
    message: z.array(messageSchema).nonempty(),
  })
  .strict();

export type ChatBody = z.infer<typeof chatBodySchema>;
