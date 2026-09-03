import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { latestDump, verifyDumpArchive } from "./backup-integrity.mjs";
import { loadEnvFile, repoRoot } from "./backup-common.mjs";

loadEnvFile(join(repoRoot, ".env"));

function fail(message) {
  console.error(`[backup-verify] FAIL ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[backup-verify] ${message}`);
}

async function main() {
  const backupDir = resolve(process.env.BACKUP_DIR || join(repoRoot, "backups"));
  const file = process.env.RESTORE_FILE || process.argv[2] || latestDump(backupDir);
  if (!file) fail("No dump found. Run npm run backup first, or pass RESTORE_FILE.");
  log(`Verifying ${file}`);
  const result = await verifyDumpArchive(file);
  log(`SUCCESS bytes=${result.bytes} sha256=${result.sha256}`);
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
}
