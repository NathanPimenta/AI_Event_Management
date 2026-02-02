import { NextResponse } from "next/server"
import { getUserByEmail } from "@/lib/db"
import { SignJWT } from "jose"
import bcrypt from "bcryptjs"

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key'
)

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

    // Create JWT token
    const token = await new SignJWT({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.image,
      },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret)

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user
    
    console.log('✅ Login successful for:', user.email, 'Role:', user.role)
    
    const response = NextResponse.json(userWithoutPassword)
    response.cookies.set({
      name: 'authToken',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400, // 24 hours
      path: '/',
    })
    
    return response
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "An error occurred during login" }, { status: 500 })
  }
}

