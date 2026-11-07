module.exports = {
  apps: [
    {
      name: "radar-web",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: __dirname,
      instances: "max",
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "radar-api",
      script: "api/dist/main.js",
      cwd: __dirname,
      instances: "max",
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 4000,
      },
    },
  ],
};
