#!/usr/bin/env node
const { backupMongoDB } = require("./backup-mongodb");
const { backupPostgreSQL } = require("./backup-postgresql");

async function backupAll() {
  console.log("🔄 Starting complete database backup...");

  try {
    // Run backups sequentially
    await backupMongoDB();
    await backupPostgreSQL();

    console.log("🎉 All backups completed successfully!");
  } catch (error) {
    console.error("💥 Backup process failed:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  backupAll();
}

module.exports = { backupAll };
