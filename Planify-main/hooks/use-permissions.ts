"use client"

import { useAuth } from './use-auth'
import { 
  hasPermission, 
  canManage, 
  canCreate, 
  canUpdate, 
  canDelete, 
  canRead,
  isAdmin,
  isCommunityMember,
  type UserRole,
  type Resource,
  type Action
} from '@/lib/rbac'

/**
 * Hook to check permissions for the current user
 */
export function usePermissions() {
  const { user } = useAuth()
  const userRole = user?.role as UserRole | undefined

  return {
    // Check specific permission
    can: (resource: Resource, action: Action) => hasPermission(userRole, resource, action),
    
    // Convenience methods
    canManage: (resource: Resource) => canManage(userRole, resource),
    canCreate: (resource: Resource) => canCreate(userRole, resource),
    canUpdate: (resource: Resource) => canUpdate(userRole, resource),
    canDelete: (resource: Resource) => canDelete(userRole, resource),
    canRead: (resource: Resource) => canRead(userRole, resource),
    
    // Role checks
    isAdmin: isAdmin(userRole),
    isCommunityMember: isCommunityMember(userRole),
    
    // Current user role
    role: userRole,
  }
}

/**
 * Hook to check a single permission and get loading state
 */
export function usePermission(resource: Resource, action: Action) {
  const { user } = useAuth()
  const userRole = user?.role as UserRole | undefined

  return {
    hasPermission: hasPermission(userRole, resource, action),
    loading: !user,
    role: userRole,
  }
}
