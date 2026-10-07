import { z } from "zod";

export const authorKindSchema = z.enum(["human", "agent"]);
export type AuthorKind = z.infer<typeof authorKindSchema>;

export const commentStatusSchema = z.enum(["open", "resolved"]);
export type CommentStatus = z.infer<typeof commentStatusSchema>;

export const commentReplySchema = z.object({
  id: z.string(),
  authorKind: authorKindSchema,
  authorName: z.string(),
  body: z.string(),
  createdAt: z.number(),
});
export type CommentReply = z.infer<typeof commentReplySchema>;

export const commentOpenAudienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("everyone") }),
  z.object({ kind: z.literal("users"), names: z.array(z.string().trim().min(1)).nonempty() }),
]);
export type CommentOpenAudience = z.infer<typeof commentOpenAudienceSchema>;
