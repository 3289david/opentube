module.exports = {
  apps: [
    {
      name: "opentube",
      script: ".next/standalone/server.js",
      cwd: "/root/yt-clone",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "3002",
        YOUTUBE_API_KEY: "AIzaSyBcTJHDdslZmIrm6txfMSVY4oU5kzfL3KQ",
        STORAGE_PATH: "/root/yt-clone/storage",
      },
    },
  ],
};
