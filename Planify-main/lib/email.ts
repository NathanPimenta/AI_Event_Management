/**
 * Email service for sending notifications
 * Uses Nodemailer for email delivery with Brevo SMTP
 */

import nodemailer from 'nodemailer'

let transporter: any = null

// Initialize email transporter with Brevo SMTP
function getTransporter() {
  if (transporter) {
    return transporter
  }

  const host = process.env.EMAIL_HOST || 'smtp-relay.brevo.com'
  const port = parseInt(process.env.EMAIL_PORT || '587', 10)
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASSWORD

  console.log(`🔧 Initializing email transporter with host: ${host}:${port}`)
  console.log(`🔧 Using auth user: ${user ? user.substring(0, 10) + '...' : 'Not set'}`)

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    connectionTimeout: 10000,
    socketTimeout: 10000,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  })

  return transporter
}

export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD || !process.env.EMAIL_FROM) {
      console.warn('⚠️  Email service not configured')
      console.warn('Missing:', {
        EMAIL_USER: !!process.env.EMAIL_USER,
        EMAIL_PASSWORD: !!process.env.EMAIL_PASSWORD,
        EMAIL_FROM: !!process.env.EMAIL_FROM,
      })
      return false
    }

    const recipients = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to
    console.log(`📧 Attempting to send email to: ${recipients}`)
    
    const emailTransporter = getTransporter()
    
    const info = await emailTransporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: recipients,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    })

    console.log(`✅ Email sent successfully: ${info.messageId}`)
    return true
  } catch (error) {
    console.error('❌ Email sending failed:')
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error code:', (error as any).code)
    } else {
      console.error('Error:', error)
    }
    return false
  }
}

/**
 * Send event notification email to community members
 */
export async function sendEventNotification(
  recipientEmails: string[],
  eventData: {
    title: string
    description: string
    date: string
    location: string
    maxAttendees: number
    communityName: string
  },
  adminName: string
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 5px; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .event-details { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; }
          .button { display: inline-block; background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
          .footer { color: #666; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 New Event in ${eventData.communityName}</h1>
          </div>
          
          <div class="content">
            <p>Hello,</p>
            <p>An admin has shared a new event in your community:</p>
            
            <div class="event-details">
              <h2 style="margin-top: 0; color: #667eea;">${eventData.title}</h2>
              <p><strong>📍 Location:</strong> ${eventData.location}</p>
              <p><strong>📅 Date:</strong> ${eventData.date}</p>
              <p><strong>👥 Max Attendees:</strong> ${eventData.maxAttendees}</p>
              <p><strong>📝 Description:</strong></p>
              <p>${eventData.description}</p>
            </div>
            
            <p><strong>Posted by:</strong> ${adminName}</p>
            
            <p>This event has been automatically shared with all members of the community. Click the button below to view more details.</p>
            
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/events" class="button">View Event Details</a>
          </div>
          
          <div class="footer">
            <p>You're receiving this email because you're a member of ${eventData.communityName}.</p>
            <p>&copy; ${new Date().getFullYear()} Event Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: recipientEmails,
    subject: `📅 New Event: ${eventData.title}`,
    html,
    text: `New Event: ${eventData.title}\n\nLocation: ${eventData.location}\nDate: ${eventData.date}\n\n${eventData.description}`,
  })
}

/**
 * Send event update notification
 */
export async function sendEventUpdateNotification(
  recipientEmails: string[],
  eventData: {
    title: string
    description: string
    date: string
    location: string
    communityName: string
  },
  adminName: string,
  updateDetails: string
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 5px; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .event-details { background: white; padding: 15px; border-left: 4px solid #f5576c; margin: 15px 0; }
          .button { display: inline-block; background: #f5576c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
          .footer { color: #666; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Event Update: ${eventData.title}</h1>
          </div>
          
          <div class="content">
            <p>Hello,</p>
            <p>An event you're registered for has been updated:</p>
            
            <div class="event-details">
              <h2 style="margin-top: 0; color: #f5576c;">${eventData.title}</h2>
              <p><strong>⚠️ What Changed:</strong></p>
              <p>${updateDetails}</p>
              <hr />
              <p><strong>📍 Location:</strong> ${eventData.location}</p>
              <p><strong>📅 Date:</strong> ${eventData.date}</p>
            </div>
            
            <p><strong>Updated by:</strong> ${adminName}</p>
            
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/events" class="button">View Updated Event</a>
          </div>
          
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Event Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: recipientEmails,
    subject: `🔔 Event Updated: ${eventData.title}`,
    html,
    text: `Event Update: ${eventData.title}\n\nChanges:\n${updateDetails}`,
  })
}

/**
 * Send cancellation notification
 */
export async function sendEventCancellationNotification(
  recipientEmails: string[],
  eventData: {
    title: string
    communityName: string
  },
  adminName: string,
  reason: string
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); color: white; padding: 20px; border-radius: 5px; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .alert { background: #ffe0e0; border-left: 4px solid #eb3349; padding: 15px; margin: 15px 0; }
          .footer { color: #666; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Event Cancelled: ${eventData.title}</h1>
          </div>
          
          <div class="content">
            <p>Hello,</p>
            <p>Unfortunately, the following event has been cancelled:</p>
            
            <div class="alert">
              <h2 style="margin-top: 0; color: #eb3349;">${eventData.title}</h2>
              <p><strong>Reason:</strong></p>
              <p>${reason}</p>
            </div>
            
            <p><strong>Cancelled by:</strong> ${adminName}</p>
            <p>We apologize for any inconvenience. If you have any questions, please contact the community administrators.</p>
          </div>
          
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Event Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: recipientEmails,
    subject: `❌ Event Cancelled: ${eventData.title}`,
    html,
    text: `Event Cancelled: ${eventData.title}\n\nReason: ${reason}`,
  })
}

/**
 * Send community invitations to newly registered user
 */
export async function sendCommunityInvitationsEmail(
  recipientEmail: string,
  userName: string,
  communities: Array<{
    id: string
    name: string
    description?: string
    inviteCode: string
  }>
): Promise<boolean> {
  if (communities.length === 0) {
    console.log(' No communities available to send invitations')
    return true
  }

  const communitiesList = communities
    .map(
      (community, index) => `
      <div class="community-card">
        <h3 style="margin-top: 0; color: #667eea;">${index + 1}. ${community.name}</h3>
        ${community.description ? `<p><strong>About:</strong> ${community.description}</p>` : ''}
        <div class="invite-code">
          <p><strong>Invite Code:</strong> <code>${community.inviteCode}</code></p>
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/communities/join?code=${community.inviteCode}" class="button">Join Community</a>
      </div>
    `
    )
    .join('')

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 700px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 5px; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .communities-section { margin: 20px 0; }
          .community-card { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; border-radius: 4px; }
          .invite-code { background: #f0f4ff; padding: 10px; border-radius: 4px; margin: 10px 0; }
          .invite-code code { background: #e0e6ff; padding: 5px 10px; border-radius: 3px; font-family: monospace; font-weight: bold; }
          .button { display: inline-block; background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px; font-size: 14px; }
          .button:hover { background: #764ba2; }
          .footer { color: #666; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
          .welcome-text { font-size: 16px; line-height: 1.8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>👋 Welcome to Our Community Platform, ${userName}!</h1>
          </div>
          
          <div class="content">
            <p class="welcome-text">Thank you for registering! We're excited to have you on board. Here are some communities you can join to connect with others, collaborate on projects, and participate in amazing events.</p>
            
            <div class="communities-section">
              <h2 style="color: #667eea;">🌐 Available Communities</h2>
              <p>Click any button below to join a community using the provided invite code:</p>
              
              ${communitiesList}
            </div>
            
            <div style="background: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #0066cc;">💡 Tip</h3>
              <p>You can also browse all communities directly from your dashboard and use the invite codes to join at any time!</p>
            </div>
            
            <p style="margin-top: 20px;">Happy connecting,<br><strong>The Community Team</strong></p>
          </div>
          
          <div class="footer">
            <p>You're receiving this email because you just registered for an account on our platform.</p>
            <p>&copy; ${new Date().getFullYear()} Event Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: recipientEmail,
    subject: `🎉 Welcome! Join Available Communities`,
    html,
    text: `Welcome to our community platform!\n\nHere are communities you can join:\n\n${communities
      .map((c) => `${c.name}\nInvite Code: ${c.inviteCode}\n`)
      .join('\n')}`,
  })
}
