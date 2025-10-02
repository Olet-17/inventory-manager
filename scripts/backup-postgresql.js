const { sqlPool } = require("../db/sql");
const fs = require("fs");
const path = require("path");

const BACKUP_DIR = path.join(__dirname, "../backups/postgresql");
const DATE = new Date().toISOString().replace(/:/g, "-");
const BACKUP_FILE = path.join(BACKUP_DIR, `postgresql-backup-${DATE}.json`);

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function backupPostgreSQL() {
  try {
    console.log("🚀 Starting PostgreSQL backup...");

    // Get all tables
    const tablesResult = await sqlPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);

    const backupData = {};

    // Backup each table
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      console.log(`📦 Backing up table: ${tableName}`);

      const data = await sqlPool.query(`SELECT * FROM ${tableName}`);
      backupData[tableName] = data.rows;
    }

    // Save to file
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backupData, null, 2));
    console.log(`✅ PostgreSQL backup completed: ${BACKUP_FILE}`);

    // Cleanup old backups
    cleanupOldBackups(BACKUP_DIR, 7, ".json");
  } catch (error) {
    console.error("❌ PostgreSQL backup failed:", error.message);
  }
}

function cleanupOldBackups(backupDir, keepDays, extension) {
  try {
    const files = fs.readdirSync(backupDir);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    files.forEach((file) => {
      if (file.endsWith(extension)) {
        const filePath = path.join(backupDir, file);
        const stat = fs.statSync(filePath);

        if (now - stat.mtimeMs > keepDays * dayMs) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Deleted old backup: ${file}`);
        }
      }
    });
  } catch (error) {
    console.log("Cleanup error:", error.message);
  }
}

// Run if called directly
if (require.main === module) {
  backupPostgreSQL();
}

module.exports = { backupPostgreSQL };
