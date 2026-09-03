import { spawn } from "node:child_process";
import { loadRootEnv, repoRoot } from "./load-root-env.mjs";

loadRootEnv();

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node scripts/run-with-root-env.mjs <command> [args...]");
  process.exit(1);
}

const child = spawn(args[0], args.slice(1), {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
