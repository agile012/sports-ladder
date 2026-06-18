module.exports = {
  apps: [
    {
      name: "ladder-server",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001",
      instances: 2,
      exec_mode: "cluster",
      cron_restart: "0 3 * * *", // Restart nightly at 3:00 AM
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "ladder-inngest",
      script: "npm",
      args: "run inngest::prod -- -p 3005",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};