// PM2 process definitions for v0-farm-console (web + queue worker).
// Does not touch any other project's PM2 processes.
module.exports = {
  apps: [
    {
      name: "v0-farmar-web",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3200",
      interpreter: "/home/panza/.nvm/versions/node/v24.18.0/bin/node",
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
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      out_file: "./logs/worker-out.log",
      error_file: "./logs/worker-error.log",
      time: true,
    },
  ],
}
