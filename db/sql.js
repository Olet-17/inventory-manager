const { Pool } = require('pg');

// Create a single connection pool (reusable)
const sqlPool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'inventory_app',
  password: '1234',
  port: 5432,
});

// Initialize tables once
// Initialize tables once
async function initializeTables() {
  try {
    // First, check if table exists and needs updating
    const tableCheck = await sqlPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'email'
    `);

    // Create or update users table
    await sqlPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'sales',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add email column if it doesn't exist
    if (tableCheck.rows.length === 0) {
      await sqlPool.query('ALTER TABLE users ADD COLUMN email VARCHAR(100)');
      console.log('✅ Added email column to users table');
    }

    // Add other columns if they don't exist
    const additionalColumns = [
      { name: 'is_active', type: 'BOOLEAN DEFAULT true' },
      { name: 'last_login', type: 'TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMP DEFAULT NOW()' }
    ];

    for (const column of additionalColumns) {
      const colCheck = await sqlPool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = $1
      `, [column.name]);

      if (colCheck.rows.length === 0) {
        await sqlPool.query(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`);
        console.log(`✅ Added ${column.name} column to users table`);
      }
    }

    console.log('✅ PostgreSQL users table ready!');
  } catch (error) {
    console.error('❌ Table initialization failed:', error.message);
  }
}

// Test connection
sqlPool.query('SELECT NOW() as time')
  .then(result => console.log('✅ PostgreSQL connected:', result.rows[0].time))
  .catch(err => console.error('❌ PostgreSQL connection failed:', err));

module.exports = { sqlPool, initializeTables };