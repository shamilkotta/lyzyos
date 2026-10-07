import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/project.schema.ts", "./src/auth.schema.ts"],
  out: "./migrations",
  dialect: "sqlite",
});
