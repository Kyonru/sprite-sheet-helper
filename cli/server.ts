import { spawn } from "child_process";
import type { ChildProcess } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve as pathResolve } from "path";

// dist/cli/ is two levels below the project root
const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), "../..");

export async function startServer(port: number): Promise<ChildProcess> {
  const proc = spawn("npx", ["vite", "preview", "--port", String(port), "--host"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });

  await waitForReady(port, proc);
  return proc;
}

export function stopServer(proc: ChildProcess): void {
  proc.kill("SIGTERM");
}

async function waitForReady(port: number, proc: ChildProcess, timeout = 15000): Promise<void> {
  const deadline = Date.now() + timeout;

  await new Promise<void>((res, rej) => {
    proc.on("error", rej);
    proc.on("exit", (code) => {
      if (code !== 0) rej(new Error(`vite preview exited with code ${code}`));
    });

    const poll = async () => {
      if (Date.now() > deadline) {
        rej(new Error(`Server on port ${port} did not start within ${timeout}ms`));
        return;
      }
      try {
        const response = await fetch(`http://localhost:${port}`);
        if (response.ok || response.status < 500) return res();
      } catch {
        // not ready yet
      }
      setTimeout(poll, 400);
    };

    setTimeout(poll, 500);
  });
}
