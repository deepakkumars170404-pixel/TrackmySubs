const { spawn } = require("child_process");
const path = require("path");

const backendDir = path.join(__dirname, "backend");

console.log("[Render Bridge] Launching backend server from directory:", backendDir);

const child = spawn("node", ["server.js"], {
  cwd: backendDir,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code || 0);
});

child.on("error", (err) => {
  console.error("[Render Bridge] Failed to launch backend server:", err);
  process.exit(1);
});
