import { spawn } from "child_process";
import type { ChildProcess } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve as pathResolve } from "path";

// dist/cli/ is two levels below the project root
const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), "../..");

export async function startServer(
  port: number,
  timeoutMs?: number,
): Promise<ChildProcess> {
  const proc = spawn(
    "npx",
    ["vite", "preview", "--port", String(port), "--host", "127.0.0.1"],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  await waitForReady(port, proc, timeoutMs);
  return proc;
}

export function stopServer(proc: ChildProcess): void {
  proc.kill("SIGTERM");
}

async function waitForReady(port: number, proc: ChildProcess, timeout = 60000): Promise<void> {
  const deadline = Date.now() + timeout;
  let output = "";

  await new Promise<void>((res, rej) => {
    let settled = false;
    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      res();
    };
    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      rej(error);
    };
    const appendOutput = (chunk: Buffer) => {
      output += chunk.toString("utf8");
      if (output.includes("Local:")) resolveOnce();
    };

    proc.stdout?.on("data", appendOutput);
    proc.stderr?.on("data", appendOutput);
    proc.on("error", rejectOnce);
    proc.on("exit", (code) => {
      if (code !== 0) {
        rejectOnce(new Error(`vite preview exited with code ${code}\n${output}`));
      }
    });

    const poll = async () => {
      if (settled) return;
      if (Date.now() > deadline) {
        rejectOnce(
          new Error(
            `Server on port ${port} did not start within ${timeout}ms\n${output}`,
          ),
        );
        return;
      }
      try {
        const response = await fetch(`http://localhost:${port}`);
        if (response.ok || response.status < 500) return resolveOnce();
      } catch {
        // not ready yet
      }
      setTimeout(poll, 400);
    };

    setTimeout(poll, 500);
  });
}
