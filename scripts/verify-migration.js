const mongoose = require('mongoose');
const { sqlPool } = require('../db/sql');
const User = require('../models/User');

async function verifyMigration() {
  try {
    console.log('🔍 Verifying user migration...');

    // Get counts from both databases
    const mongoCount = await User.countDocuments();
    const postgresResult = await sqlPool.query('SELECT COUNT(*) as count FROM users');
    const postgresCount = parseInt(postgresResult.rows[0].count);

    console.log(`📊 MongoDB users: ${mongoCount}`);
    console.log(`📊 PostgreSQL users: ${postgresCount}`);

    // Get usernames from both databases
    const mongoUsers = await User.find({}, 'username role').lean();
    const postgresUsers = await sqlPool.query('SELECT username, role FROM users');

    const mongoUsernames = mongoUsers.map(u => u.username).sort();
    const postgresUsernames = postgresUsers.rows.map(u => u.username).sort();

    console.log('\n👥 User Comparison:');
    console.log('MongoDB users:', mongoUsernames);
    console.log('PostgreSQL users:', postgresUsernames);

    // Check if all users were migrated
    const allMigrated = mongoUsernames.every(username => 
      postgresUsernames.includes(username)
    );

    if (allMigrated) {
      console.log('\n✅ SUCCESS: All MongoDB users migrated to PostgreSQL!');
    } else {
      console.log('\n❌ WARNING: Not all users were migrated');
      const missing = mongoUsernames.filter(u => !postgresUsernames.includes(u));
      console.log('Missing users:', missing);
    }

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await mongoose.connection.close();
    await sqlPool.end();
  }
}

// Run verification
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/inventoryDB";
mongoose.connect(MONGO_URI)
  .then(() => verifyMigration())
  .catch(err => console.error('MongoDB connection failed:', err));