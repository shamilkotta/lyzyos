import { eq } from "drizzle-orm";
import { user } from "./auth.schema";
import { createDb } from "./client";

export const getUserById = async (d1: D1Database, userId: string) => {
  const db = createDb(d1);
  return db.query.user.findFirst({
    where: eq(user.id, userId),
  });
};
