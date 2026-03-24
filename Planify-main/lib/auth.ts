import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key'
)

export interface Session {
  user: {
    id: string
    email: string
    name: string
    role: string
    image?: string
  }
  iat?: number
  exp?: number
}

/**
 * Generate a direct login link for judges (expires in 24 hours)
 * This creates a special token that can be used to auto-login to the platform
 */
export async function generateDirectLoginLink(
  userId: string,
  email: string,
  name: string,
  role: string,
  redirectPath: string = '/dashboard'
): Promise<string> {
  try {
    const token = await new SignJWT({
      user: { id: userId, email, name, role },
      type: 'direct-login',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret)

    // Create the full login URL with the token
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const loginUrl = `${baseUrl}/api/auth/magic-link?token=${token}&redirect=${encodeURIComponent(redirectPath)}`

    return loginUrl
  } catch (error) {
    console.error('Error generating direct login link:', error)
    throw new Error('Failed to generate login link')
  }
}

/**
 * Verify and process a direct login link token
 */
export async function verifyDirectLoginToken(token: string): Promise<Session | null> {
  try {
    const verified = await jwtVerify(token, secret)
    const payload = verified.payload as any

    // Check if this is a direct-login token
    if (payload.type !== 'direct-login') {
      console.warn('Invalid token type')
      return null
    }

    return {
      user: payload.user,
      iat: payload.iat as number,
      exp: payload.exp as number,
    }
  } catch (error) {
    console.error('Direct login token verification failed:', error)
    return null
  }
}

/**
 * Verify the authentication token from cookies and return session
 * @param request - Next.js Request object
 * @returns Session object if valid token exists, null otherwise
 */
export async function verifyAuth(request: Request): Promise<Session | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('authToken')?.value || cookieStore.get('next-auth.session-token')?.value

    if (!token) {
      return null
    }

    const verified = await jwtVerify(token, secret)
    return verified.payload as unknown as Session
  } catch (error) {
    console.error('Auth verification failed:', error)
    return null
  }
}

/**
 * Get session from request headers (for API routes)
 * Useful as an alternative to verifyAuth if token is sent via Authorization header
 */
export async function getSessionFromRequest(request: Request): Promise<Session | null> {
  try {
    // Try to get from Authorization header first
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const verified = await jwtVerify(token, secret)
      return verified.payload as unknown as Session
    }

    // Fall back to cookie-based auth
    return await verifyAuth(request)
  } catch (error) {
    console.error('Session retrieval failed:', error)
    return null
  }
}
