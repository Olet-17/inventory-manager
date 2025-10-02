const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const BACKUP_DIR = path.join(__dirname, "../backups/mongodb");
const DATE = new Date().toISOString().split("T")[0];
const backupPath = path.join(BACKUP_DIR, `mongodb-backup-${DATE}.json`);

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function backupMongoDB() {
  try {
    console.log("🚀 Starting MongoDB backup...");

    // Connect to MongoDB
    await mongoose.connect("mongodb://127.0.0.1:27017/inventoryDB");

    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();

    const backupData = {};

    // Backup each collection
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`📦 Backing up collection: ${collectionName}`);

      const collection = mongoose.connection.db.collection(collectionName);
      const documents = await collection.find({}).toArray();

      backupData[collectionName] = documents;
    }

    // Save to file
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`✅ MongoDB backup completed: ${backupPath}`);

    // Cleanup old backups
    cleanupOldBackups(BACKUP_DIR, 7, ".json");

    await mongoose.connection.close();
  } catch (error) {
    console.error("❌ MongoDB backup failed:", error.message);
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
  backupMongoDB();
}

module.exports = { backupMongoDB };
