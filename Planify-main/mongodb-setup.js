// MongoDB Setup Script for Planify AI
// Run this script using: mongosh < mongodb-setup.js
// Or copy-paste into MongoDB Compass or mongosh

// Switch to planify database (creates if doesn't exist)
use planify

print("🚀 Setting up Planify AI database...")
print("")

// ============================================
// USERS COLLECTION
// ============================================
print("📝 Creating users collection indexes...")
db.users.createIndex({ email: 1 }, { unique: true })
print("✅ Users indexes created")

// ============================================
// COMMUNITIES COLLECTION
// ============================================
print("📝 Creating communities collection indexes...")
db.communities.createIndex({ inviteCode: 1 }, { unique: true })
db.communities.createIndex({ adminId: 1 })
db.communities.createIndex({ "members.userId": 1 })
print("✅ Communities indexes created")

// ============================================
// CLUBS COLLECTION
// ============================================
print("📝 Creating clubs collection indexes...")
db.clubs.createIndex({ communityId: 1 })
db.clubs.createIndex({ leadId: 1 })
db.clubs.createIndex({ "members.userId": 1 })
print("✅ Clubs indexes created")

// ============================================
// EVENTS COLLECTION
// ============================================
print("📝 Creating events collection indexes...")
db.events.createIndex({ clubId: 1 })
db.events.createIndex({ organizerId: 1 })
db.events.createIndex({ date: 1 })
db.events.createIndex({ "attendees.userId": 1 })
db.events.createIndex({ status: 1 })
print("✅ Events indexes created")

// ============================================
// TASKS COLLECTION
// ============================================
print("📝 Creating tasks collection indexes...")
db.tasks.createIndex({ clubId: 1 })
db.tasks.createIndex({ assigneeId: 1 })
db.tasks.createIndex({ status: 1 })
db.tasks.createIndex({ eventId: 1 })
print("✅ Tasks indexes created")

// ============================================
// QUERIES COLLECTION
// ============================================
print("📝 Creating queries collection indexes...")
db.queries.createIndex({ eventId: 1 })
db.queries.createIndex({ userId: 1 })
db.queries.createIndex({ status: 1 })
db.queries.createIndex({ createdAt: -1 })
print("✅ Queries indexes created")

print("")
print("=".repeat(50))
print("✅ Database setup complete!")
print("=".repeat(50))
print("")
print("Collections created:")
print("  - users")
print("  - communities")
print("  - clubs")
print("  - events")
print("  - tasks")
print("  - queries")
print("")
print("All indexes have been created successfully.")
print("")
print("Next steps:")
print("  1. Ensure MONGODB_URI is set in .env.local")
print("  2. Start your Next.js application")
print("  3. Collections will be populated as users interact with the app")
print("")

