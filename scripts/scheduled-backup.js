const cron = require("node-cron");
const { exec } = require("child_process");

// Run daily at 2:00 AM
cron.schedule(
  "0 2 * * *",
  () => {
    console.log("🕒 Running scheduled database backup...");

    exec("npm run backup:all", (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Scheduled backup failed:", error);
        // Could add email/notification here
        return;
      }
      console.log("✅ Scheduled backup completed:", stdout);
    });
  },
  {
    timezone: "America/New_York", // Adjust to your timezone
  },
);

console.log("⏰ Backup scheduler started. Daily backups at 2:00 AM");
