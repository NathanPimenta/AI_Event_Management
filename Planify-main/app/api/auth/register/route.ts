import { NextResponse } from "next/server"
import { createUser, getUserByEmail, getCommunities } from "@/lib/db"
import { sendCommunityInvitationsEmail } from "@/lib/email"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json()

    // Check if user already exists
    const existingUser = await getUserByEmail(email)
    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await createUser({
      name,
      email,
      password: hashedPassword,
      role: "audience",
      createdAt: new Date(),
    })

    try {
      console.log(`📬 Fetching communities for new user: ${email}`)
      const communities = await getCommunities()
      console.log(`📬 Found ${communities.length} communities`)
      
      // Extract necessary fields for email
      const communitiesForEmail = communities.map((community: any) => ({
        id: community.id,
        name: community.name,
        description: community.description,
        inviteCode: community.inviteCode,
      }))

      console.log(`📬 Sending community invitations email to: ${email}`)
      const emailSent = await sendCommunityInvitationsEmail(email, name, communitiesForEmail)
      console.log(`📬 Community invitations email ${emailSent ? 'sent successfully' : 'failed to send'}`)
    } catch (emailError) {
      console.error("Error sending community invitations email:", emailError)
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ error: "An error occurred during registration" }, { status: 500 })
  }
}

