const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { sqlPool } = require("../db/sql");
const User = require("../models/User"); // MongoDB User model

async function migrateUsers() {
  try {
    console.log("🚀 Starting user migration from MongoDB to PostgreSQL...");

    // 1. Get all users from MongoDB
    const mongoUsers = await User.find({});
    console.log(`📊 Found ${mongoUsers.length} users in MongoDB`);

    if (mongoUsers.length === 0) {
      console.log("✅ No users to migrate");
      return;
    }

    let migratedCount = 0;
    let errorCount = 0;

    // 2. Migrate each user to PostgreSQL
    for (const mongoUser of mongoUsers) {
      try {
        console.log(`🔄 Migrating user: ${mongoUser.username}`);

        // Check if user already exists in PostgreSQL
        const existingUser = await sqlPool.query("SELECT id FROM users WHERE username = $1", [
          mongoUser.username,
        ]);

        if (existingUser.rows.length > 0) {
          console.log(`⏭️  User ${mongoUser.username} already exists in PostgreSQL, skipping...`);
          continue;
        }

        // Hash password (if it's not already hashed in MongoDB)
        let password_hash = mongoUser.password;
        if (!password_hash.startsWith("$2a$") && !password_hash.startsWith("$2b$")) {
          // Password is not hashed, hash it
          const saltRounds = 10;
          password_hash = await bcrypt.hash(mongoUser.password, saltRounds);
        }

        // Insert into PostgreSQL
        const result = await sqlPool.query(
          `INSERT INTO users (username, password_hash, role, email, created_at) 
           VALUES ($1, $2, $3, $4, $5) 
           RETURNING id`,
          [
            mongoUser.username,
            password_hash,
            mongoUser.role || "sales",
            mongoUser.email || null,
            mongoUser.createdAt || new Date(),
          ],
        );

        migratedCount++;
        console.log(`✅ Migrated user: ${mongoUser.username} (ID: ${result.rows[0].id})`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to migrate user ${mongoUser.username}:`, error.message);
      }
    }

    // 3. Migration Summary
    console.log("\n🎉 USER MIGRATION COMPLETE!");
    console.log("📊 Summary:");
    console.log(`   Total users in MongoDB: ${mongoUsers.length}`);
    console.log(`   Successfully migrated: ${migratedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Skipped (already exists): ${mongoUsers.length - migratedCount - errorCount}`);

    // 4. Verify migration
    const postgresUsers = await sqlPool.query("SELECT COUNT(*) as count FROM users");
    console.log(`🔍 Total users in PostgreSQL: ${postgresUsers.rows[0].count}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    // Close connections
    await mongoose.connection.close();
    await sqlPool.end();
    process.exit(0);
  }
}

// Run migration if called directly
if (require.main === module) {
  // Connect to MongoDB first
  const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/inventoryDB";

  mongoose
    .connect(MONGO_URI)
    .then(() => {
      console.log("✅ Connected to MongoDB");
      migrateUsers();
    })
    .catch((err) => {
      console.error("❌ MongoDB connection failed:", err);
      process.exit(1);
    });
}

module.exports = { migrateUsers };
