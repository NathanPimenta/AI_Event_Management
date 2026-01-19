/**
 * Notification service - Handles event notifications to community members
 */

import { query } from './postgres'
import {
  sendEventNotification,
  sendEventUpdateNotification,
  sendEventCancellationNotification,
} from './email'

/**
 * Helper to convert snake_case to camelCase
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

/**
 * Get all community member emails (excluding the sender)
 */
export async function getCommunityMemberEmails(communityId: string, excludeUserId?: string): Promise<string[]> {
  try {
    const result = await query(
      `SELECT DISTINCT u.email
       FROM users u
       INNER JOIN community_members cm ON u.id = cm.user_id
       WHERE cm.community_id = $1
       AND u.email IS NOT NULL
       ${excludeUserId ? 'AND u.id != $2' : ''}
       ORDER BY u.email`,
      excludeUserId ? [communityId, excludeUserId] : [communityId]
    )

    return result.rows.map((row: any) => row.email)
  } catch (error) {
    console.error('Error fetching community member emails:', error)
    return []
  }
}

/**
 * Get event attendee emails
 */
export async function getEventAttendeeEmails(eventId: string): Promise<string[]> {
  try {
    const result = await query(
      `SELECT DISTINCT email
       FROM event_attendees
       WHERE event_id = $1
       AND email IS NOT NULL
       ORDER BY email`,
      [eventId]
    )

    return result.rows.map((row: any) => row.email)
  } catch (error) {
    console.error('Error fetching event attendee emails:', error)
    return []
  }
}

/**
 * Get user details
 */
export async function getUserDetails(userId: string): Promise<any> {
  try {
    const result = await query('SELECT id, name, email, role FROM users WHERE id = $1', [userId])
    return toCamelCase(result.rows[0]) || null
  } catch (error) {
    console.error('Error fetching user details:', error)
    return null
  }
}

/**
 * Get event details
 */
export async function getEventDetails(eventId: string): Promise<any> {
  try {
    const result = await query(
      `SELECT id, title, description, date, end_date, location, max_attendees, community_id
       FROM events
       WHERE id = $1`,
      [eventId]
    )
    return toCamelCase(result.rows[0]) || null
  } catch (error) {
    console.error('Error fetching event details:', error)
    return null
  }
}

/**
 * Get community details
 */
export async function getCommunityDetails(communityId: string): Promise<any> {
  try {
    const result = await query('SELECT id, name, description FROM communities WHERE id = $1', [communityId])
    return toCamelCase(result.rows[0]) || null
  } catch (error) {
    console.error('Error fetching community details:', error)
    return null
  }
}

/**
 * Notify community members about new event
 */
export async function notifyNewEvent(eventId: string, createdByUserId: string): Promise<boolean> {
  try {
    console.log(`🔍 Fetching event details for ${eventId}`)
    const event = await getEventDetails(eventId)
    if (!event) {
      console.warn(`❌ Event ${eventId} not found`)
      return false
    }

    console.log(`👤 Fetching admin details for ${createdByUserId}`)
    const admin = await getUserDetails(createdByUserId)
    console.log(`🏘️  Fetching community details for ${event.communityId}`)
    const community = await getCommunityDetails(event.communityId)

    if (!admin || !community) {
      console.warn('❌ Admin or community not found', { admin: !!admin, community: !!community })
      return false
    }

    console.log(`📬 Fetching member emails for community ${event.communityId}`)
    const memberEmails = await getCommunityMemberEmails(event.communityId, createdByUserId)
    console.log(`📧 Found ${memberEmails.length} members to notify:`, memberEmails)
    
    if (memberEmails.length === 0) {
      console.log('⚠️  No community members to notify')
      return true
    }

    const eventDate = new Date(event.date).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    console.log(`📤 Sending notifications to ${memberEmails.length} members`)
    const result = await sendEventNotification(memberEmails, {
      title: event.title,
      description: event.description,
      date: eventDate,
      location: event.location,
      maxAttendees: event.maxAttendees,
      communityName: community.name,
    }, admin.name)
    
    console.log(`✅ Notification result: ${result}`)
    return result
  } catch (error) {
    console.error('❌ Error notifying new event:', error)
    return false
  }
}

/**
 * Notify event attendees about event update
 */
export async function notifyEventUpdate(
  eventId: string,
  updatedByUserId: string,
  updateDetails: string
): Promise<boolean> {
  try {
    const event = await getEventDetails(eventId)
    if (!event) {
      console.warn(`Event ${eventId} not found`)
      return false
    }

    const admin = await getUserDetails(updatedByUserId)
    const community = await getCommunityDetails(event.communityId)

    if (!admin || !community) {
      console.warn('Admin or community not found')
      return false
    }

    // Notify attendees
    const attendeeEmails = await getEventAttendeeEmails(eventId)
    if (attendeeEmails.length === 0) {
      console.log('No attendees to notify')
      return true
    }

    const eventDate = new Date(event.date).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    return await sendEventUpdateNotification(attendeeEmails, {
      title: event.title,
      description: event.description,
      date: eventDate,
      location: event.location,
      communityName: community.name,
    }, admin.name, updateDetails)
  } catch (error) {
    console.error('Error notifying event update:', error)
    return false
  }
}

/**
 * Notify event cancellation
 */
export async function notifyEventCancellation(
  eventId: string,
  cancelledByUserId: string,
  cancellationReason: string
): Promise<boolean> {
  try {
    const event = await getEventDetails(eventId)
    if (!event) {
      console.warn(`Event ${eventId} not found`)
      return false
    }

    const admin = await getUserDetails(cancelledByUserId)
    const community = await getCommunityDetails(event.communityId)

    if (!admin || !community) {
      console.warn('Admin or community not found')
      return false
    }

    // Notify both community members and attendees
    const memberEmails = await getCommunityMemberEmails(event.communityId)
    const attendeeEmails = await getEventAttendeeEmails(eventId)
    const allEmails = [...new Set([...memberEmails, ...attendeeEmails])]

    if (allEmails.length === 0) {
      console.log('No users to notify')
      return true
    }

    return await sendEventCancellationNotification(allEmails, {
      title: event.title,
      communityName: community.name,
    }, admin.name, cancellationReason)
  } catch (error) {
    console.error('Error notifying event cancellation:', error)
    return false
  }
}
