import { MongoClient } from "mongodb"

if (!process.env.MONGODB_URI) {
  throw new Error("Please add your MongoDB URI to .env.local")
}

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || "planify"
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
}

let client
let clientPromise: Promise<MongoClient>

const createClient = async () => {
  try {
    const newClient = new MongoClient(uri, options)
    await newClient.connect()
    // Test the connection
    await newClient.db("admin").command({ ping: 1 })
    console.log("Successfully connected to MongoDB.")
    return newClient
  } catch (error: any) {
    console.error("MongoDB connection error:", error.message)
    throw error
  }
}

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    globalWithMongo._mongoClientPromise = createClient()
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  // In production mode, it's best to not use a global variable.
  clientPromise = createClient()
}

export default clientPromise

