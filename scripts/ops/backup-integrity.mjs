import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { commandExists, findPostgresBin, run } from "./backup-common.mjs";

export function sha256File(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

export function sidecarPaths(dumpFile) {
  return {
    dump: dumpFile,
    sha256: `${dumpFile}.sha256`,
    manifest: `${dumpFile}.manifest.json`,
  };
}

export function writeBackupSidecars(dumpFile, target) {
  const size = statSync(dumpFile).size;
  const sha256 = sha256File(dumpFile);
  const names = sidecarPaths(dumpFile);
  writeFileSync(names.sha256, `${sha256}  ${basename(dumpFile)}\n`);
  const manifest = {
    file: basename(dumpFile),
    format: "custom",
    sha256,
    bytes: size,
    createdAt: new Date().toISOString(),
    database: target.database,
    host: target.host,
    port: target.port,
  };
  writeFileSync(names.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export function latestDump(dir) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((name) => name.startsWith("onetrips-") && name.endsWith(".dump"))
    .map((name) => {
      const full = join(dir, name);
      return { full, mtime: statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return files[0]?.full ?? null;
}

export async function verifyDumpArchive(dumpFile) {
  if (!existsSync(dumpFile)) throw new Error(`Backup file not found: ${dumpFile}`);
  const size = statSync(dumpFile).size;
  if (size < 64) throw new Error(`Backup file is empty or too small (${size} bytes).`);
  const names = sidecarPaths(dumpFile);
  const sha256 = sha256File(dumpFile);
  if (existsSync(names.sha256)) {
    const expected = readFileSync(names.sha256, "utf8").trim().split(/\s+/)[0];
    if (expected && expected !== sha256) {
      throw new Error(`Checksum mismatch for ${basename(dumpFile)}.`);
    }
  }
  if (existsSync(names.manifest)) {
    const manifest = JSON.parse(readFileSync(names.manifest, "utf8"));
    if (manifest.sha256 && manifest.sha256 !== sha256) {
      throw new Error(`Manifest checksum mismatch for ${basename(dumpFile)}.`);
    }
    if (manifest.bytes && manifest.bytes !== size) {
      throw new Error(`Manifest size mismatch for ${basename(dumpFile)}.`);
    }
  }
  const pgRestore = findPostgresBin("pg_restore");
  if (pgRestore === "pg_restore" && !(await commandExists("pg_restore"))) {
    throw new Error("pg_restore is not installed; cannot list the dump archive.");
  }
  const listed = await run(pgRestore, ["--list", dumpFile]);
  if (!listed.stdout.includes("TABLE") && !listed.stdout.includes("TABLE DATA")) {
    throw new Error("pg_restore --list did not show table objects. The dump may be corrupt.");
  }
  return { file: dumpFile, bytes: size, sha256, listed: true };
}

function applyOffsiteRetention(dir, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const deleted = [];
  if (!existsSync(dir)) return deleted;
  for (const name of readdirSync(dir)) {
    if (!name.startsWith("onetrips-")) continue;
    const full = join(dir, name);
    if (statSync(full).mtimeMs < cutoff) {
      unlinkSync(full);
      deleted.push(name);
    }
  }
  return deleted;
}

export async function copyOffsite(dumpFile, log = () => {}) {
  const required = process.env.BACKUP_OFFSITE_REQUIRED === "YES";
  const destDir = process.env.BACKUP_OFFSITE_DIR?.trim()
    ? resolve(process.env.BACKUP_OFFSITE_DIR.trim())
    : "";
  const rcloneRemote = process.env.BACKUP_RCLONE_REMOTE?.trim();
  if (!destDir && !rcloneRemote) {
    if (required) {
      throw new Error(
        "Offsite backup is required. Set BACKUP_OFFSITE_DIR (second disk/mount) or BACKUP_RCLONE_REMOTE (rclone destination).",
      );
    }
    log("Offsite copy skipped (BACKUP_OFFSITE_DIR / BACKUP_RCLONE_REMOTE not set).");
    return { copied: false, reason: "not-configured" };
  }

  const names = sidecarPaths(dumpFile);
  const extras = [names.sha256, names.manifest].filter((path) => existsSync(path));
  const results = [];

  if (destDir) {
    mkdirSync(destDir, { recursive: true });
    const copied = join(destDir, basename(dumpFile));
    copyFileSync(dumpFile, copied);
    for (const extra of extras) copyFileSync(extra, join(destDir, basename(extra)));
    const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 14);
    const deleted = Number.isFinite(retentionDays) && retentionDays >= 1 ? applyOffsiteRetention(destDir, retentionDays) : [];
    log(`Offsite directory copy ${copied}`);
    results.push({ kind: "dir", path: copied, deleted });
  }

  if (rcloneRemote) {
    if (!(await commandExists("rclone"))) {
      throw new Error("BACKUP_RCLONE_REMOTE is set but rclone is not installed.");
    }
    const remote = rcloneRemote.replace(/\/$/, "");
    await run("rclone", ["copyto", dumpFile, `${remote}/${basename(dumpFile)}`]);
    for (const extra of extras) {
      await run("rclone", ["copyto", extra, `${remote}/${basename(extra)}`]);
    }
    log(`Offsite rclone copy ${remote}/${basename(dumpFile)}`);
    results.push({ kind: "rclone", path: `${remote}/${basename(dumpFile)}` });
  }

  return { copied: true, results };
}
