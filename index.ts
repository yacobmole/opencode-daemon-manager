#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

type Command = "start" | "stop" | "status" | "help";

const PORT = 45023;
const STATE_DIR = getStateDir();
const PID_FILE = resolve(STATE_DIR, "opencode.pid");
const META_FILE = resolve(STATE_DIR, "opencode.json");

function getStateDir(): string {
  const override = process.env.OPENCODE_DAEMON_STATE_DIR;
  if (override && override.trim().length > 0) {
    return resolve(override);
  }

  const home = homedir();

  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA ?? process.env.APPDATA ?? home;
    return resolve(base, "opencode-daemon-manager");
  }

  if (process.platform === "darwin") {
    return resolve(home, "Library", "Application Support", "opencode-daemon-manager");
  }

  const xdgStateHome = process.env.XDG_STATE_HOME;
  if (xdgStateHome && xdgStateHome.trim().length > 0) {
    return resolve(xdgStateHome, "opencode-daemon-manager");
  }

  return resolve(home, ".local", "state", "opencode-daemon-manager");
}

type DaemonState = {
  pid: number;
  port: number;
  startedAt: string;
};

function usage(): void {
  console.log(`Usage:
  bun run index.ts start [--port <number>]
  bun run index.ts stop
  bun run index.ts status

Options:
  -p, --port  Port for opencode serve (default: ${PORT})

State directory:
  ${STATE_DIR}
  (override with OPENCODE_DAEMON_STATE_DIR)`);
}

function parseCommand(raw?: string): Command {
  if (!raw || raw === "help" || raw === "--help" || raw === "-h") {
    return "help";
  }

  if (raw === "start" || raw === "stop" || raw === "status") {
    return raw;
  }

  console.error(`Unknown command: ${raw}`);
  usage();
  process.exit(1);
}

function parsePort(args: string[]): number {
  let port = PORT;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) {
      continue;
    }

    if (arg === "-p" || arg === "--port") {
      const value = args[i + 1];
      if (!value) {
        console.error("Missing value for --port");
        process.exit(1);
      }
      port = Number.parseInt(value, 10);
      i += 1;
      continue;
    }

    if (arg.startsWith("--port=")) {
      port = Number.parseInt(arg.slice("--port=".length), 10);
      continue;
    }

    console.error(`Unknown argument: ${arg}`);
    usage();
    process.exit(1);
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${port}. Expected integer between 1 and 65535.`);
    process.exit(1);
  }

  return port;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function writeState(state: DaemonState): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(PID_FILE, `${state.pid}\n`, "utf8");
  await writeFile(META_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function clearState(): Promise<void> {
  await rm(PID_FILE, { force: true });
  await rm(META_FILE, { force: true });
}

async function readState(): Promise<DaemonState | null> {
  if (!existsSync(PID_FILE)) {
    return null;
  }

  const pidRaw = (await readFile(PID_FILE, "utf8")).trim();
  const pid = Number.parseInt(pidRaw, 10);

  if (!Number.isInteger(pid) || pid <= 0) {
    await clearState();
    return null;
  }

  let port = PORT;
  let startedAt = "unknown";

  if (existsSync(META_FILE)) {
    try {
      const meta = JSON.parse(await readFile(META_FILE, "utf8")) as Partial<DaemonState>;
      if (typeof meta.port === "number") {
        port = meta.port;
      }
      if (typeof meta.startedAt === "string") {
        startedAt = meta.startedAt;
      }
    } catch {
      // Ignore bad metadata; PID file is source of truth.
    }
  }

  return { pid, port, startedAt };
}

async function start(port: number): Promise<void> {
  const state = await readState();

  if (state && isProcessRunning(state.pid)) {
    console.log(`Already running (pid: ${state.pid}, port: ${state.port}).`);
    process.exit(1);
  }

  if (state && !isProcessRunning(state.pid)) {
    await clearState();
  }

  const child = Bun.spawn(["opencode", "serve", "--port", `${port}`], {
    detached: true,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });

  child.unref();

  const newState: DaemonState = {
    pid: child.pid,
    port,
    startedAt: new Date().toISOString(),
  };

  await writeState(newState);

  console.log(`Started opencode service (pid: ${child.pid}, port: ${port}).`);
}

async function stop(): Promise<void> {
  const state = await readState();

  if (!state) {
    console.log("Service is not running.");
    return;
  }

  if (!isProcessRunning(state.pid)) {
    await clearState();
    console.log("Found stale PID file. Service is not running.");
    return;
  }

  process.kill(state.pid, "SIGTERM");

  const timeoutMs = 5000;
  const intervalMs = 250;
  const checks = Math.ceil(timeoutMs / intervalMs);

  for (let i = 0; i < checks; i++) {
    if (!isProcessRunning(state.pid)) {
      await clearState();
      console.log(`Stopped service (pid: ${state.pid}).`);
      return;
    }
    await sleep(intervalMs);
  }

  process.kill(state.pid, "SIGKILL");
  await clearState();
  console.log(`Force-stopped service (pid: ${state.pid}).`);
}

async function status(): Promise<void> {
  const state = await readState();

  if (!state) {
    console.log("Service status: stopped");
    return;
  }

  if (!isProcessRunning(state.pid)) {
    await clearState();
    console.log("Service status: stopped (removed stale PID file)");
    return;
  }

  console.log("Service status: running");
  console.log(`PID: ${state.pid}`);
  console.log(`Port: ${state.port}`);
  console.log(`Started: ${state.startedAt}`);
}

async function main(): Promise<void> {
  const args = Bun.argv.slice(2);
  const command = parseCommand(args[0]);

  if (command === "help") {
    usage();
    return;
  }

  const extraArgs = args.slice(1);

  if (command === "start") {
    const port = parsePort(extraArgs);
    await start(port);
    return;
  }

  if (extraArgs.length > 0) {
    console.error(`Unexpected arguments for '${command}': ${extraArgs.join(" ")}`);
    usage();
    process.exit(1);
  }

  if (command === "stop") {
    await stop();
    return;
  }

  await status();
}

main().catch((error) => {
  console.error("Unexpected error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
