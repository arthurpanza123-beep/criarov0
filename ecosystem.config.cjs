// PM2 process definitions for v0-farm-console (web + queue worker).
// Does not touch any other project's PM2 processes.
const { execSync } = require("node:child_process")

/**
 * Resolves the commit actually checked out on disk, so APP_COMMIT is never
 * hand-edited and can never drift from the deployed code. Falls back to the
 * APP_COMMIT already in the environment (e.g. a CI-provided value baked into
 * an immutable release), then to "unknown" — never throws on a dirty
 * checkout or a missing .git directory.
 */
function resolveAppCommit() {
  try {
    return execSync("git rev-parse HEAD", { cwd: __dirname, encoding: "utf-8" }).trim()
  } catch {
    return process.env.APP_COMMIT || "unknown"
  }
}

const APP_COMMIT = resolveAppCommit()

module.exports = {
  apps: [
    {
      name: "v0-farmar-web",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3200",
      interpreter: "/home/panza/.nvm/versions/node/v24.18.0/bin/node",
      env: {
        APP_COMMIT,
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      out_file: "./logs/web-out.log",
      error_file: "./logs/web-error.log",
      time: true,
    },
    {
      name: "v0-farmar-worker",
      cwd: __dirname,
      script: "scripts/worker.ts",
      interpreter: "/home/panza/.nvm/versions/node/v24.18.0/bin/node",
      interpreter_args: "--conditions=react-server --import tsx",
      env: {
        APP_COMMIT,
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      out_file: "./logs/worker-out.log",
      error_file: "./logs/worker-error.log",
      time: true,
    },
  ],
}
