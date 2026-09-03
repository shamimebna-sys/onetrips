import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

config({ path: resolve(fileURLToPath(new URL("../../../.env", import.meta.url))) });
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });
