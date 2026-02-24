import { jwtVerify } from 'jose'
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
