import { NextResponse } from "next/server"
import { getUserByEmail } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    
    console.log('🔐 Login attempt for:', email)

    // Find user
    const user = await getUserByEmail(email)
    console.log('👤 User found:', user ? `Yes (${user.email})` : 'No')
    
    if (!user) {
      console.log('❌ User not found in database')
      return NextResponse.json({ error: "Invalid email or password" }, { status: 400 })
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password)
    console.log('🔑 Password valid:', isPasswordValid)
    
    if (!isPasswordValid) {
      console.log('❌ Invalid password')
      return NextResponse.json({ error: "Invalid email or password" }, { status: 400 })
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user
    
    console.log('✅ Login successful for:', user.email, 'Role:', user.role)
    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "An error occurred during login" }, { status: 500 })
  }
}

