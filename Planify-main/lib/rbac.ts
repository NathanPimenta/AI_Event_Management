/**
 * Role-Based Access Control (RBAC) utilities
 * Defines permissions and provides helper functions for authorization
 */

export type UserRole = 'audience' | 'community_member' | 'community_admin'

export type Resource = 
  | 'events' 
  | 'communities' 
  | 'clubs' 
  | 'tasks' 
  | 'queries'
  | 'members'

export type Action = 'create' | 'read' | 'update' | 'delete' | 'register' | 'manage'

/**
 * Permission matrix defining what each role can do
 */
const PERMISSIONS: Record<UserRole, Record<Resource, Action[]>> = {
  audience: {
    events: ['read', 'register'],
    communities: ['read'],
    clubs: ['read'],
    tasks: [],
    queries: ['read'],
    members: [],
  },
  community_member: {
    events: ['read', 'register'],
    communities: ['read'],
    clubs: ['read', 'create'],
    tasks: ['read'],
    queries: ['create', 'read'],
    members: ['read'],
  },
  community_admin: {
    events: ['create', 'read', 'update', 'delete', 'manage'],
    communities: ['create', 'read', 'update', 'delete', 'manage'],
    clubs: ['create', 'read', 'update', 'delete', 'manage'],
    tasks: ['create', 'read', 'update', 'delete'],
    queries: ['create', 'read', 'update', 'delete'],
    members: ['create', 'read', 'update', 'delete'],
  },
}

/**
 * Check if a user has permission to perform an action on a resource
 */
export function hasPermission(
  userRole: UserRole | undefined,
  resource: Resource,
  action: Action
): boolean {
  if (!userRole) return false
  
  const rolePermissions = PERMISSIONS[userRole]
  if (!rolePermissions) return false
  
  const resourcePermissions = rolePermissions[resource]
  if (!resourcePermissions) return false
  
  return resourcePermissions.includes(action)
}

/**
 * Check if user can manage (full CRUD) a resource
 */
export function canManage(userRole: UserRole | undefined, resource: Resource): boolean {
  return hasPermission(userRole, resource, 'manage')
}

/**
 * Check if user can create a resource
 */
export function canCreate(userRole: UserRole | undefined, resource: Resource): boolean {
  return hasPermission(userRole, resource, 'create')
}

/**
 * Check if user can update a resource
 */
export function canUpdate(userRole: UserRole | undefined, resource: Resource): boolean {
  return hasPermission(userRole, resource, 'update')
}

/**
 * Check if user can delete a resource
 */
export function canDelete(userRole: UserRole | undefined, resource: Resource): boolean {
  return hasPermission(userRole, resource, 'delete')
}

/**
 * Check if user can read a resource
 */
export function canRead(userRole: UserRole | undefined, resource: Resource): boolean {
  return hasPermission(userRole, resource, 'read')
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(userRole: UserRole): Record<Resource, Action[]> {
  return PERMISSIONS[userRole] || {}
}

/**
 * Check if user is admin
 */
export function isAdmin(userRole: UserRole | undefined): boolean {
  return userRole === 'community_admin'
}

/**
 * Check if user is community member or higher
 */
export function isCommunityMember(userRole: UserRole | undefined): boolean {
  return userRole === 'community_member' || userRole === 'community_admin'
}

/**
 * Get role hierarchy level (higher number = more permissions)
 */
export function getRoleLevel(userRole: UserRole): number {
  const levels: Record<UserRole, number> = {
    audience: 1,
    community_member: 2,
    community_admin: 3,
  }
  return levels[userRole] || 0
}

/**
 * Check if one role is higher than another
 */
export function isRoleHigher(role1: UserRole, role2: UserRole): boolean {
  return getRoleLevel(role1) > getRoleLevel(role2)
}

/**
 * Authorization error
 */
export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized access') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

/**
 * Require permission middleware helper
 */
export function requirePermission(
  userRole: UserRole | undefined,
  resource: Resource,
  action: Action
): void {
  if (!hasPermission(userRole, resource, action)) {
    throw new UnauthorizedError(
      `Permission denied: ${action} on ${resource} requires higher privileges`
    )
  }
}
