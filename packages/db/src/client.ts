import { drizzle } from "drizzle-orm/d1";
import * as authSchema from "./auth.schema";
import { schema as appSchema } from "./project.schema";

export const schema = {
  ...appSchema,
  ...authSchema,
};

export type Db = ReturnType<typeof createDb>;

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}
