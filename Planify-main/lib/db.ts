/**
 * Database operations using PostgreSQL
 * All functions use parameterized queries to prevent SQL injection
 */

import { query } from './postgres'

/**
 * Helper to transform database rows to camelCase
 */
function toCamelCase(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(toCamelCase)
  
  const newObj: any = {}
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    newObj[camelKey] = obj[key]
  }
  return newObj
}

/* ==================== USER OPERATIONS ==================== */

export async function createUser(userData: any) {
  const { name, email, password, role = 'audience', image = null } = userData
  
  const result = await query(
    `INSERT INTO users (name, email, password, role, image)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, email, password, role, image]
  )
  
  return toCamelCase(result.rows[0])
}

export async function getUserByEmail(email: string) {
  if (!email) return null
  
  const result = await query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [email]
  )
  
  if (result.rows.length === 0) return null
  return toCamelCase(result.rows[0])
}

export async function getUserById(id: string) {
  const result = await query(
    'SELECT * FROM users WHERE id = $1 LIMIT 1',
    [id]
  )
  
  if (result.rows.length === 0) return null
  return toCamelCase(result.rows[0])
}

export async function updateUser(id: string, data: any) {
  const { name, email, image, role } = data
  const result = await query(
    `UPDATE users 
     SET name = COALESCE($1, name),
         email = COALESCE($2, email),
         image = COALESCE($3, image),
         role = COALESCE($4, role)
     WHERE id = $5
     RETURNING *`,
    [name, email, image, role, id]
  )
  
  if (result.rows.length === 0) return null
  return toCamelCase(result.rows[0])
}

export async function updateLastLogin(userId: string) {
  await query(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
    [userId]
  )
}

/* ==================== TASK OPERATIONS ==================== */

export async function getTasks() {
  const result = await query(
    `SELECT t.*, u.name as assigned_to_name 
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     ORDER BY t.created_at DESC`
  )
  
  return result.rows.map(toCamelCase)
}

export async function getClubTasks(clubId: string) {
  const result = await query(
    `SELECT t.*, u.name as assigned_to_name
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     WHERE t.club_id = $1
     ORDER BY t.created_at DESC`,
    [clubId]
  )
  
  return result.rows.map(toCamelCase)
}

export async function getUserTasks(userId: string) {
  const result = await query(
    `SELECT t.*, u.name as assigned_to_name
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     WHERE t.assigned_to = $1 OR t.created_by = $1
     ORDER BY t.created_at DESC`,
    [userId]
  )
  
  return result.rows.map(toCamelCase)
}

export async function createTask(taskData: any) {
  const { 
    title, 
    description, 
    status = 'pending', 
    priority = 'medium',
    dueDate,
    clubId,
    eventId,
    assignedTo,
    createdBy
  } = taskData
  
  const result = await query(
    `INSERT INTO tasks (title, description, status, priority, due_date, club_id, event_id, assigned_to, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [title, description, status, priority, dueDate, clubId, eventId, assignedTo, createdBy]
  )
  
  return toCamelCase(result.rows[0])
}

export async function getTaskById(id: string) {
  const result = await query(
    `SELECT t.*, u.name as assigned_to_name
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     WHERE t.id = $1`,
    [id]
  )
  
  if (result.rows.length === 0) return null
  return toCamelCase(result.rows[0])
}

export async function updateTask(id: string, data: any) {
  const { title, description, status, priority, dueDate, assignedTo } = data
  
  const result = await query(
    `UPDATE tasks
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         status = COALESCE($3, status),
         priority = COALESCE($4, priority),
         due_date = COALESCE($5, due_date),
         assigned_to = COALESCE($6, assigned_to)
     WHERE id = $7
     RETURNING *`,
    [title, description, status, priority, dueDate, assignedTo, id]
  )
  
  if (result.rows.length === 0) return null
  return toCamelCase(result.rows[0])
}

export async function deleteTask(id: string) {
  const result = await query(
    'DELETE FROM tasks WHERE id = $1 RETURNING id',
    [id]
  )
  
  return result.rowCount ? result.rowCount > 0 : false
}

/* ==================== QUERY OPERATIONS ==================== */

export async function createQuery(queryData: any) {
  const { eventId, userId, userName, userImage, question } = queryData
  
  const result = await query(
    `INSERT INTO event_queries (event_id, user_id, user_name, user_image, question)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [eventId, userId, userName, userImage, question]
  )
  
  return toCamelCase(result.rows[0])
}

export async function getEventQueries(eventId: string) {
  const result = await query(
    `SELECT * FROM event_queries
     WHERE event_id = $1
     ORDER BY created_at DESC`,
    [eventId]
  )
  
  return result.rows.map(toCamelCase)
}

export async function updateQuery(id: string, data: any) {
  const { answer } = data
  
  const result = await query(
    `UPDATE event_queries
     SET answer = $1,
         answered_at = CASE WHEN $1 IS NOT NULL THEN CURRENT_TIMESTAMP ELSE answered_at END
     WHERE id = $2
     RETURNING *`,
    [answer, id]
  )
  
  if (result.rows.length === 0) return null
  return toCamelCase(result.rows[0])
}

/* ==================== EVENT OPERATIONS ==================== */

export async function getEventById(id: string) {
  const result = await query(
    `SELECT e.*, 
            c.name as club_name,
            comm.name as community_name,
            u.name as organizer_name,
            (SELECT COUNT(*) FROM event_attendees WHERE event_id = e.id) as attendee_count,
            (SELECT json_agg(json_build_object(
              'userId', ea.user_id,
              'name', ea.name,
              'email', ea.email,
              'registeredAt', ea.registered_at
            )) FROM event_attendees ea WHERE ea.event_id = e.id) as attendees
     FROM events e
     LEFT JOIN clubs c ON e.club_id = c.id
     LEFT JOIN communities comm ON e.community_id = comm.id
     LEFT JOIN users u ON e.organizer_id = u.id
     WHERE e.id = $1`,
    [id]
  )
  
  if (result.rows.length === 0) return null
  const event = toCamelCase(result.rows[0])
  event.attendees = event.attendees || []
  return event
}

export async function createEvent(eventData: any) {
  const {
    title,
    description,
    date,
    endDate,
    location,
    maxAttendees = 100,
    clubId,
    communityId,
    organizerId
  } = eventData
  
  const result = await query(
    `INSERT INTO events (title, description, date, end_date, location, max_attendees, club_id, community_id, organizer_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [title, description, date, endDate, location, maxAttendees, clubId, communityId, organizerId]
  )
  
  return toCamelCase(result.rows[0])
}

export async function updateEvent(id: string, data: any) {
  const { title, description, date, endDate, location, maxAttendees } = data
  
  const result = await query(
    `UPDATE events
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         date = COALESCE($3, date),
         end_date = COALESCE($4, end_date),
         location = COALESCE($5, location),
         max_attendees = COALESCE($6, max_attendees)
     WHERE id = $7
     RETURNING *`,
    [title, description, date, endDate, location, maxAttendees, id]
  )
  
  if (result.rows.length === 0) return null
  return toCamelCase(result.rows[0])
}

export async function deleteEvent(id: string) {
  const result = await query(
    'DELETE FROM events WHERE id = $1 RETURNING id',
    [id]
  )
  
  return result.rowCount ? result.rowCount > 0 : false
}

export async function addAttendeeToEvent(eventId: string, attendee: any) {
  const { userId, name, email } = attendee
  
  const result = await query(
    `INSERT INTO event_attendees (event_id, user_id, name, email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_id, user_id) DO NOTHING
     RETURNING *`,
    [eventId, userId, name, email]
  )
  
  if (result.rows.length === 0) return null
  return toCamelCase(result.rows[0])
}

export async function getEventsByClub(clubId: string) {
  const result = await query(
    `SELECT e.*,
            (SELECT COUNT(*) FROM event_attendees WHERE event_id = e.id) as attendee_count
     FROM events e
     WHERE e.club_id = $1
     ORDER BY e.date DESC`,
    [clubId]
  )
  
  return result.rows.map(toCamelCase)
}

export async function getEventsByCommunity(communityId: string) {
  const result = await query(
    `SELECT e.*,
            c.name as club_name,
            (SELECT COUNT(*) FROM event_attendees WHERE event_id = e.id) as attendee_count
     FROM events e
     LEFT JOIN clubs c ON e.club_id = c.id
     WHERE e.community_id = $1
     ORDER BY e.date DESC`,
    [communityId]
  )
  
  return result.rows.map(toCamelCase)
}

/* ==================== COMMUNITY OPERATIONS ==================== */

export async function createCommunity(communityData: any) {
  const { name, description, inviteCode, adminId, members = [] } = communityData
  
  // Insert community
  const result = await query(
    `INSERT INTO communities (name, description, invite_code, admin_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, description, inviteCode, adminId]
  )
  
  const community = toCamelCase(result.rows[0])
  
  // Add admin as member
  if (adminId) {
    await query(
      `INSERT INTO community_members (community_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [community.id, adminId]
    )
  }
  
  return community
}

export async function getCommunityById(id: string) {
  const result = await query(
    `SELECT c.*,
            u.name as admin_name,
            (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as member_count,
            (SELECT json_agg(json_build_object(
              'userId', cm.user_id,
              'role', cm.role,
              'joinedAt', cm.joined_at,
              'name', usr.name,
              'email', usr.email,
              'image', usr.image
            )) FROM community_members cm
            LEFT JOIN users usr ON cm.user_id = usr.id
            WHERE cm.community_id = c.id) as members
     FROM communities c
     LEFT JOIN users u ON c.admin_id = u.id
     WHERE c.id = $1`,
    [id]
  )
  
  if (result.rows.length === 0) return null
  const community = toCamelCase(result.rows[0])
  community.members = community.members || []
  return community
}

export async function getCommunityByInviteCode(inviteCode: string) {
  const result = await query(
    `SELECT c.*,
            (SELECT json_agg(json_build_object(
              'userId', cm.user_id,
              'role', cm.role
            )) FROM community_members cm WHERE cm.community_id = c.id) as members
     FROM communities c
     WHERE c.invite_code = $1`,
    [inviteCode]
  )
  
  if (result.rows.length === 0) return null
  const community = toCamelCase(result.rows[0])
  community.members = community.members || []
  return community
}

export async function updateCommunity(id: string, data: any) {
  const { name, description, inviteCode } = data
  
  const result = await query(
    `UPDATE communities
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         invite_code = COALESCE($3, invite_code)
     WHERE id = $4
     RETURNING *`,
    [name, description, inviteCode, id]
  )
  
  if (result.rows.length === 0) return null
  return toCamelCase(result.rows[0])
}

export async function addMemberToCommunity(communityId: string, memberData: any) {
  const { userId, role = 'member' } = memberData
  
  const result = await query(
    `INSERT INTO community_members (community_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (community_id, user_id) DO NOTHING
     RETURNING *`,
    [communityId, userId, role]
  )
  
  if (result.rows.length === 0) return null
  return toCamelCase(result.rows[0])
}

export async function getUserCommunities(userId: string) {
  const result = await query(
    `SELECT c.*,
            cm.role as user_role,
            (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as member_count
     FROM communities c
     INNER JOIN community_members cm ON c.id = cm.community_id
     WHERE cm.user_id = $1
     ORDER BY cm.joined_at DESC`,
    [userId]
  )
  
  return result.rows.map(toCamelCase)
}

/* ==================== CLUB OPERATIONS ==================== */

export async function createClub(clubData: any) {
  const { name, description, communityId, leadId } = clubData
  
  const result = await query(
    `INSERT INTO clubs (name, description, community_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, description, communityId]
  )
  
  const club = toCamelCase(result.rows[0])
  
  // Add lead as member
  if (leadId) {
    await query(
      `INSERT INTO club_members (club_id, user_id, role)
       VALUES ($1, $2, 'lead')`,
      [club.id, leadId]
    )
  }
  
  return club
}

export async function getClubById(id: string) {
  const result = await query(
    `SELECT cl.*,
            comm.name as community_name,
            (SELECT COUNT(*) FROM club_members WHERE club_id = cl.id) as member_count,
            (SELECT json_agg(json_build_object(
              'userId', cm.user_id,
              'role', cm.role,
              'joinedAt', cm.joined_at,
              'name', u.name,
              'email', u.email,
              'image', u.image
            )) FROM club_members cm
            LEFT JOIN users u ON cm.user_id = u.id
            WHERE cm.club_id = cl.id) as members
     FROM clubs cl
     LEFT JOIN communities comm ON cl.community_id = comm.id
     WHERE cl.id = $1`,
    [id]
  )
  
  if (result.rows.length === 0) return null
  const club = toCamelCase(result.rows[0])
  club.members = club.members || []
  return club
}

export async function updateClub(id: string, data: any) {
  const { name, description } = data
  
  const result = await query(
    `UPDATE clubs
     SET name = COALESCE($1, name),
         description = COALESCE($2, description)
     WHERE id = $3
     RETURNING *`,
    [name, description, id]
  )
  
  if (result.rows.length === 0) return null
  return toCamelCase(result.rows[0])
}

export async function addMemberToClub(clubId: string, memberData: any) {
  const { userId, role = 'member' } = memberData
  
  const result = await query(
    `INSERT INTO club_members (club_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (club_id, user_id) DO NOTHING
     RETURNING *`,
    [clubId, userId, role]
  )
  
  if (result.rows.length === 0) return null
  return toCamelCase(result.rows[0])
}

export async function getUserClubs(userId: string) {
  const result = await query(
    `SELECT cl.*,
            cm.role as user_role,
            comm.name as community_name,
            (SELECT COUNT(*) FROM club_members WHERE club_id = cl.id) as member_count
     FROM clubs cl
     INNER JOIN club_members cm ON cl.id = cm.club_id
     LEFT JOIN communities comm ON cl.community_id = comm.id
     WHERE cm.user_id = $1
     ORDER BY cm.joined_at DESC`,
    [userId]
  )
  
  return result.rows.map(toCamelCase)
}

/* ==================== PERMISSION CHECKS ==================== */

/**
 * Check if user has permission from database
 */
export async function checkPermission(userId: string, resource: string, action: string): Promise<boolean> {
  const result = await query(
    `SELECT p.* FROM permissions p
     INNER JOIN users u ON u.role = p.role
     WHERE u.id = $1 AND p.resource = $2 AND p.action = $3
     LIMIT 1`,
    [userId, resource, action]
  )
  
  return result.rows.length > 0
}

// Export default object for compatibility
export default {
  // Users
  createUser,
  getUserByEmail,
  getUserById,
  updateUser,
  updateLastLogin,
  
  // Tasks
  getTasks,
  getClubTasks,
  getUserTasks,
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  
  // Queries
  createQuery,
  getEventQueries,
  updateQuery,
  
  // Events
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  addAttendeeToEvent,
  getEventsByClub,
  getEventsByCommunity,
  
  // Communities
  createCommunity,
  getCommunityById,
  getCommunityByInviteCode,
  updateCommunity,
  addMemberToCommunity,
  getUserCommunities,
  
  // Clubs
  createClub,
  getClubById,
  updateClub,
  addMemberToClub,
  getUserClubs,
  
  // Permissions
  checkPermission,
}

// Additional helper functions for API routes

// Get all communities for a user
export async function getCommunities(userId?: string) {
  if (userId) {
    const result = await query(`
      SELECT c.*, cm.role,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as member_count
      FROM communities c
      INNER JOIN community_members cm ON c.id = cm.community_id
      WHERE cm.user_id = $1
      ORDER BY c.created_at DESC
    `, [userId])
    return result.rows.map(row => toCamelCase(row))
  }
  const result = await query(`
    SELECT c.*,
      (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as member_count
    FROM communities c
    ORDER BY c.created_at DESC
  `)
  return result.rows.map(row => toCamelCase(row))
}

// Get all events with optional filtering
export async function getEvents(userId?: string) {
  if (userId) {
    const result = await query(`
      SELECT e.*, 
        c.name as club_name, 
        comm.name as community_name,
        u.name as organizer_name,
        (SELECT COUNT(*) FROM event_attendees WHERE event_id = e.id) as attendee_count,
        CASE WHEN e.organizer_id = $1 THEN true ELSE false END as is_organizer
      FROM events e
      LEFT JOIN clubs c ON e.club_id = c.id
      LEFT JOIN communities comm ON e.community_id = comm.id
      LEFT JOIN users u ON e.organizer_id = u.id
      WHERE e.organizer_id = $1 
        OR e.id IN (SELECT event_id FROM event_attendees WHERE user_id = $1)
        OR e.community_id IN (SELECT community_id FROM community_members WHERE user_id = $1)
      ORDER BY e.date DESC
    `, [userId])
    return result.rows.map(row => toCamelCase(row))
  }
  
  const result = await query(`
    SELECT e.*, 
      c.name as club_name, 
      comm.name as community_name,
      u.name as organizer_name,
      (SELECT COUNT(*) FROM event_attendees WHERE event_id = e.id) as attendee_count
    FROM events e
    LEFT JOIN clubs c ON e.club_id = c.id
    LEFT JOIN communities comm ON e.community_id = comm.id
    LEFT JOIN users u ON e.organizer_id = u.id
    ORDER BY e.date DESC
  `)
  return result.rows.map(row => toCamelCase(row))
}

// Alias functions for compatibility
export const getClubEvents = getEventsByClub
export const getUserEvents = getEvents

// Delete community
export async function deleteCommunity(id: string) {
  await query('DELETE FROM communities WHERE id = $1', [id])
}

// Get all clubs
export async function getClubs() {
  const result = await query(`
    SELECT c.*,
      (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as member_count,
      comm.name as community_name
    FROM clubs c
    LEFT JOIN communities comm ON c.community_id = comm.id
    ORDER BY c.created_at DESC
  `)
  return result.rows.map(row => toCamelCase(row))
}

// Get clubs by community
export async function getCommunityClubs(communityId: string) {
  const result = await query(`
    SELECT c.*,
      (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as member_count
    FROM clubs c
    WHERE c.community_id = $1
    ORDER BY c.created_at DESC
  `, [communityId])
  return result.rows.map(row => toCamelCase(row))
}
