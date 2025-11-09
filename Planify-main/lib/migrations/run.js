const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...')
    
    const migrationFile = path.join(__dirname, '001_initial_schema.sql')
    const sql = fs.readFileSync(migrationFile, 'utf-8')
    
    await pool.query(sql)
    
    console.log('✅ Migrations completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

runMigrations()
