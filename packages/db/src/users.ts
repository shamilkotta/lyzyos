import { asc, eq } from "drizzle-orm";
import { user } from "./auth.schema";
import { createDb } from "./client";

export const getUserById = async (d1: D1Database, userId: string) => {
  const db = createDb(d1);
  return db.query.user.findFirst({
    where: eq(user.id, userId),
  });
};

/** Directory listing: public profile fields only (no auth/session data). */
export const listUsers = async (d1: D1Database) => {
  const db = createDb(d1);
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.name));
};
