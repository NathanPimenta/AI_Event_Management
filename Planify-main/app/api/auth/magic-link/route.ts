import { NextResponse } from 'next/server'
import { verifyDirectLoginToken } from '@/lib/auth'
import { cookies } from 'next/headers'

/**
 * Handle magic link login for judges
 * Verifies the token and sets the auth cookie, then redirects to the specified page
 * If token is invalid/expired or missing, redirects to login page with return_to parameter
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const redirect = searchParams.get('redirect') || '/dashboard'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    if (!token) {
      console.log('❌ Missing login token, redirecting to login')
      // Redirect to login page with return_to parameter
      const loginUrl = new URL('/login', baseUrl)
      loginUrl.searchParams.set('return_to', redirect)
      return NextResponse.redirect(loginUrl, { status: 302 })
    }

    // Verify the token
    const session = await verifyDirectLoginToken(token)

    if (!session) {
      console.log('❌ Invalid or expired token, redirecting to login')
      // Token is invalid or expired - redirect to login with return_to parameter
      const loginUrl = new URL('/login', baseUrl)
      loginUrl.searchParams.set('return_to', redirect)
      loginUrl.searchParams.set('error', 'token_expired')
      return NextResponse.redirect(loginUrl, { status: 302 })
    }

    // Set the auth cookie
    const cookieStore = await cookies()
    cookieStore.set('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })

    console.log(`✅ Magic link login successful for user: ${session.user.email}`)

    // Redirect to the specified path
    const redirectUrl = new URL(redirect, baseUrl)
    return NextResponse.redirect(redirectUrl, { status: 302 })
  } catch (error) {
    console.error('Magic link login error:', error)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirect = new URL(request.url).searchParams.get('redirect') || '/dashboard'
    
    // On any error, redirect to login page
    const loginUrl = new URL('/login', baseUrl)
    loginUrl.searchParams.set('return_to', redirect)
    loginUrl.searchParams.set('error', 'login_failed')
    return NextResponse.redirect(loginUrl, { status: 302 })
  }
}
