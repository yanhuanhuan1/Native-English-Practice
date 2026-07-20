import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const nextDir = path.join(projectRoot, ".next");
const port = Number(process.env.PORT || 3000);

function isPortOpen() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });

    socket.setTimeout(800);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      resolve(false);
    });
  });
}

try {
  if (await isPortOpen()) {
    console.log(`Port ${port} is already in use. Skipping .next cleanup.`);
  } else if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log("Removed stale .next cache before starting dev server.");
  }
} catch (error) {
  console.warn(`Could not clean .next cache: ${error.message}`);
}
