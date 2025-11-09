"use client"

import type React from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import type { Resource, Action } from '@/lib/rbac'

interface ProtectedProps {
  children: React.ReactNode
  resource: Resource
  action: Action
  fallback?: React.ReactNode
  hideIfUnauthorized?: boolean
}

/**
 * Component that conditionally renders children based on user permissions
 * @param resource - The resource to check permission for
 * @param action - The action to check permission for  
 * @param fallback - Optional component to show if unauthorized (default: null)
 * @param hideIfUnauthorized - If true, render nothing when unauthorized (default: true)
 */
export function Protected({ 
  children, 
  resource, 
  action, 
  fallback = null,
  hideIfUnauthorized = true 
}: ProtectedProps) {
  const { can } = usePermissions()

  if (!can(resource, action)) {
    return hideIfUnauthorized ? null : <>{fallback}</>
  }

  return <>{children}</>
}

interface AdminOnlyProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Component that only shows content to admins
 */
export function AdminOnly({ children, fallback = null }: AdminOnlyProps) {
  const { isAdmin } = usePermissions()

  if (!isAdmin) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface MemberOnlyProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Component that only shows content to community members and above
 */
export function MemberOnly({ children, fallback = null }: MemberOnlyProps) {
  const { isCommunityMember } = usePermissions()

  if (!isCommunityMember) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface RoleGateProps {
  children: React.ReactNode
  allowedRoles: string[]
  fallback?: React.ReactNode
}

/**
 * Component that checks if user has one of the allowed roles
 */
export function RoleGate({ children, allowedRoles, fallback = null }: RoleGateProps) {
  const { role } = usePermissions()

  if (!role || !allowedRoles.includes(role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
