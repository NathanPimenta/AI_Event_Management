const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

async function runMigrations() {
  const client = await pool.connect()
  try {
    console.log('🔄 Running database migrations...')
    
    // Run initial schema
    const initialFile = path.join(__dirname, '001_initial_schema.sql')
    const initialSql = fs.readFileSync(initialFile, 'utf-8')
    try {
      await client.query(initialSql)
    } catch (e) {
      // Ignore errors about already existing objects
      if (!e.message.includes('already exists') && !e.message.includes('duplicate key')) {
        throw e
      }
    }
    console.log('✅ Initial schema migration completed')
    
    // Run material requests schema
    const materialFile = path.join(__dirname, '002_material_requests.sql')
    const materialSql = fs.readFileSync(materialFile, 'utf-8')
    try {
      await client.query(materialSql)
    } catch (e) {
      if (!e.message.includes('already exists') && !e.message.includes('duplicate key')) {
        throw e
      }
    }
    console.log('✅ Material requests schema migration completed')
    
    console.log('✅ All migrations completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    client.release()
  }
}

runMigrations()
