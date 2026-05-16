import { spawn } from "node:child_process";

const children = new Map();
let shuttingDown = false;

function start(name, command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
  });

  children.set(name, child);

  child.on("exit", (code, signal) => {
    children.delete(name);

    if (shuttingDown) {
      return;
    }

    if (name === "ai" && code === 1) {
      console.warn(
        "[start:all] AI server failed to start, but Expo will keep running. If port 8000 is already used, stop the existing AI server or change the AI port.",
      );
      return;
    }

    if (code === 0) {
      console.log(`[start:all] ${name} exited cleanly.`);
    } else {
      console.error(
        `[start:all] ${name} exited with code ${code ?? "null"}${signal ? ` (${signal})` : ""}. Stopping remaining processes.`,
      );
      shutdown();
      process.exit(code ?? 1);
    }
  });

  return child;
}

function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children.values()) {
    try {
      child.kill("SIGINT");
    } catch {
      // Ignore shutdown errors.
    }
  }
}

process.on("SIGINT", () => {
  console.log("\n[start:all] Received SIGINT, stopping Expo and AI servers...");
  shutdown();
});

process.on("SIGTERM", () => {
  console.log(
    "\n[start:all] Received SIGTERM, stopping Expo and AI servers...",
  );
  shutdown();
});

console.log("[start:all] Starting Expo (LAN) and AI server...");
if (process.platform === "win32") {
  start("expo", "cmd", ["/c", "npm", "run", "start:go"]);
  start("ai", "cmd", ["/c", "npm", "run", "ai:start"]);
} else {
  start("expo", "npm", ["run", "start:go"]);
  start("ai", "npm", ["run", "ai:start"]);
}
