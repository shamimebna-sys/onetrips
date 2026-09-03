import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "@prisma/config";
import { assertApplicationDatabaseUrl } from "./src/assert-url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: path.join(rootDir, ".env") });
assertApplicationDatabaseUrl(process.env.DATABASE_URL, { required: true, production: false });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
