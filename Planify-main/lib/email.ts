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
    console.error(' Email sending failed:')
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
            <h1> Event Cancelled: ${eventData.title}</h1>
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
    subject: ` Event Cancelled: ${eventData.title}`,
    html,
    text: `Event Cancelled: ${eventData.title}\n\nReason: ${reason}`,
  })
}

/**
 * Send email to judges when materials are submitted for evaluation
 */
export async function sendJudgeMaterialSubmissionNotification(
  judgeEmail: string,
  judgeName: string,
  eventData: {
    title: string
    id: string
  },
  submissionData: {
    participantName: string
    participantEmail: string
    materialTitle: string
    submissionType: string
  },
  directLoginLink: string
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ffa726 0%, #fb8c00 100%); color: white; padding: 20px; border-radius: 5px; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .submission-details { background: white; padding: 15px; border-left: 4px solid #ffa726; margin: 15px 0; border-radius: 4px; }
          .button { display: inline-block; background: #ffa726; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold; font-size: 16px; }
          .button:hover { background: #fb8c00; }
          .footer { color: #666; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
          .badge { display: inline-block; background: #fff3e0; color: #e65100; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 New Material Submitted for Evaluation</h1>
          </div>
          
          <div class="content">
            <p>Hello ${judgeName},</p>
            <p>A new material has been submitted for evaluation in your assigned event.</p>
            
            <div class="submission-details">
              <h2 style="margin-top: 0; color: #ffa726;">Event: ${eventData.title}</h2>
              
              <p><strong>🎯 Material Title:</strong> ${submissionData.materialTitle}</p>
              <p><strong>📁 Material Type:</strong> <span class="badge">${submissionData.submissionType}</span></p>
              <p><strong>👤 Submitted by:</strong> ${submissionData.participantName}</p>
              <p><strong>📧 Email:</strong> ${submissionData.participantEmail}</p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              
              <p><strong>Action Required:</strong></p>
              <p>Please review and score this material submission. Click the button below to go directly to the evaluation screen.</p>
            </div>
            
            <p style="text-align: center; margin-top: 25px;">
              <a href="${directLoginLink}" class="button">Review & Score Material</a>
            </p>
            
            <div style="background: #f0f4f8; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0066cc;">
              <p style="margin: 0; font-size: 14px;"><strong>💡 Quick Note:</strong> This link will log you in automatically and take you directly to the evaluation section. No additional login required!</p>
            </div>
          </div>
          
          <div class="footer">
            <p>You're receiving this email because you're assigned as a judge for ${eventData.title}.</p>
            <p>&copy; ${new Date().getFullYear()} Event Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: judgeEmail,
    subject: `📋 Material Submitted: ${submissionData.materialTitle} - ${eventData.title}`,
    html,
    text: `New Material Submitted for Evaluation\n\nEvent: ${eventData.title}\nMaterial: ${submissionData.materialTitle}\nSubmitted by: ${submissionData.participantName}\nMaterial Type: ${submissionData.submissionType}\n\nPlease review the material and provide your evaluation.`,
  })
}

/**
 * Send event registration confirmation with QR code to participant
 */
export async function sendRegistrationConfirmationWithQRCode(
  participantEmail: string,
  participantName: string,
  eventData: {
    title: string
    id: string
    date: string
    location: string
    description: string
  },
  qrCodeDataUrl: string
): Promise<boolean> {
  const eventUrl = `${process.env.NEXT_PUBLIC_APP_URL}/events/${eventData.id}`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 5px; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .event-details { background: white; padding: 15px; border-left: 4px solid #10b981; margin: 15px 0; border-radius: 4px; }
          .qr-section { text-align: center; padding: 20px; background: white; border: 2px dashed #10b981; border-radius: 8px; margin: 20px 0; }
          .qr-section img { max-width: 200px; height: auto; margin: 10px 0; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold; }
          .footer { color: #666; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
          .info-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 12px; border-radius: 4px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Registration Confirmed!</h1>
          </div>
          
          <div class="content">
            <p>Hello ${participantName},</p>
            <p>Thank you for registering for our event! We're excited to have you participate. Here are your event details:</p>
            
            <div class="event-details">
              <h2 style="margin-top: 0; color: #10b981;">${eventData.title}</h2>
              <p><strong>📍 Location:</strong> ${eventData.location}</p>
              <p><strong>📅 Date:</strong> ${eventData.date}</p>
              <p><strong>📝 Description:</strong></p>
              <p>${eventData.description}</p>
            </div>

            <div class="qr-section">
              <p style="margin-top: 0; font-weight: bold;">Scan to View Event Details</p>
              <img src="${qrCodeDataUrl}" alt="Event QR Code" />
              <p style="margin-bottom: 0; font-size: 12px; color: #666;">Your unique event QR code</p>
            </div>

            <div class="info-box">
              <strong>📱 How to Use Your QR Code:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Save or screenshot this email</li>
                <li>Share with friends - they can scan to register</li>
                <li>Check your registration status anytime</li>
                <li>Access event updates and materials</li>
              </ul>
            </div>
            
            <p style="text-align: center;">
              <a href="${eventUrl}" class="button">View Full Event Details</a>
            </p>
          </div>
          
          <div class="footer">
            <p>You're receiving this email because you registered for ${eventData.title}.</p>
            <p>&copy; ${new Date().getFullYear()} Event Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: participantEmail,
    subject: `✅ Registration Confirmed: ${eventData.title}`,
    html,
    text: `Registration Confirmed for ${eventData.title}\n\nLocation: ${eventData.location}\nDate: ${eventData.date}\n\nThank you for registering! View your event details at: ${eventUrl}`,
  })
}

/**
 * Send QR code to participants (admin bulk distribution)
 */
export async function sendQRCodeToParticipants(
  participantEmails: string[],
  eventData: {
    title: string
    id: string
    date: string
  },
  qrCodeDataUrl: string,
  adminName: string
): Promise<boolean> {
  const eventUrl = `${process.env.NEXT_PUBLIC_APP_URL}/events/${eventData.id}`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 20px; border-radius: 5px; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .event-details { background: white; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0; }
          .qr-section { text-align: center; padding: 20px; background: white; border: 2px solid #3b82f6; border-radius: 8px; margin: 20px 0; }
          .qr-section img { max-width: 220px; height: auto; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold; }
          .footer { color: #666; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📱 Event QR Code</h1>
          </div>
          
          <div class="content">
            <p>Hello,</p>
            <p>${adminName} from the organizing team has shared the event QR code with you. Scan it to view event details and access all materials!</p>
            
            <div class="event-details">
              <h2 style="margin-top: 0; color: #3b82f6;">${eventData.title}</h2>
              <p><strong>📅 Date:</strong> ${eventData.date}</p>
            </div>

            <div class="qr-section">
              <p style="font-weight: bold; margin-bottom: 15px;">Scan to Access Event</p>
              <img src="${qrCodeDataUrl}" alt="Event QR Code" />
              <p style="margin-top: 10px; font-size: 12px; color: #666;">Point your camera at this QR code</p>
            </div>

            <p style="text-align: center;">
              <a href="${eventUrl}" class="button">View Event Details</a>
            </p>
          </div>
          
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Event Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: participantEmails,
    subject: `📱 Event QR Code: ${eventData.title}`,
    html,
    text: `Event QR Code for ${eventData.title}\n\nDate: ${eventData.date}\n\nScan the QR code in the attached email to access event details.\n\nView online: ${eventUrl}`,
  })
}

/**
 * Send round advancement notification to team/participant
 */
export async function sendRoundAdvancementNotification(
  recipientEmails: string[],
  eventData: {
    title: string
    id: string
    eventType: string
  },
  teamData: {
    teamName: string
    currentRound: number
    nextRound: number
  },
  adminName: string
): Promise<boolean> {
  const eventUrl = `${process.env.NEXT_PUBLIC_APP_URL}/events/${eventData.id}`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; border-radius: 5px; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .celebration { text-align: center; padding: 20px; background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; margin: 20px 0; }
          .celebration h2 { color: #d97706; margin: 0; font-size: 28px; }
          .team-info { background: white; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0; border-radius: 4px; }
          .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold; }
          .footer { color: #666; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
          </div>
          
          <div class="content">
            <p>Hello Team ${teamData.teamName},</p>
            
            <div class="celebration">
              <h2>🚀 Advanced to Round ${teamData.nextRound}!</h2>
              <p style="font-size: 16px; margin: 10px 0;">Your submission was impressive. Keep up the amazing work!</p>
            </div>

            <div class="team-info">
              <p style="margin: 0;"><strong>📊 Event:</strong> ${eventData.title}</p>
              <p style="margin: 8px 0;"><strong>🏆 Event Type:</strong> ${eventData.eventType}</p>
              <p style="margin: 8px 0;"><strong>📍 Round Progress:</strong> Round ${teamData.currentRound} → Round ${teamData.nextRound}</p>
              <p style="margin: 8px 0;"><strong>✅ Approved by:</strong> ${adminName}</p>
            </div>

            <div style="background: #e0f2fe; border-left: 4px solid #0284c7; padding: 15px; border-radius: 4px; margin: 15px 0;">
              <strong>📋 What's Next?</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Check the event page for Round ${teamData.nextRound} requirements</li>
                <li>Review the submission guidelines</li>
                <li>Prepare and submit your materials before the deadline</li>
              </ul>
            </div>

            <p style="text-align: center;">
              <a href="${eventUrl}" class="button">View Event & Round Details</a>
            </p>
          </div>
          
          <div class="footer">
            <p>You're receiving this email because your team advanced in ${eventData.title}.</p>
            <p>&copy; ${new Date().getFullYear()} Event Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: recipientEmails,
    subject: `🎉 Congratulations! You Advanced to Round ${teamData.nextRound}!`,
    html,
    text: `Congratulations Team ${teamData.teamName}!\n\nYour team has been selected to advance to Round ${teamData.nextRound} in ${eventData.title}.\n\nView event details: ${eventUrl}`,
  })
}

/**
 * Send round elimination notification
 */
export async function sendRoundEliminationNotification(
  recipientEmails: string[],
  eventData: {
    title: string
    id: string
  },
  teamData: {
    teamName: string
    round: number
  },
  adminName: string,
  feedback: string
): Promise<boolean> {
  const eventUrl = `${process.env.NEXT_PUBLIC_APP_URL}/events/${eventData.id}`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 20px; border-radius: 5px; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .feedback-section { background: white; padding: 15px; border-left: 4px solid #6366f1; margin: 15px 0; border-radius: 4px; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold; }
          .footer { color: #666; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Round ${eventData.title} Results</h1>
          </div>
          
          <div class="content">
            <p>Hello Team ${teamData.teamName},</p>
            <p>Thank you for participating in Round ${teamData.round} of ${eventData.title}. After careful review, we've made our final decisions.</p>
            
            <div class="feedback-section">
              <p style="margin: 0; color: #666;"><strong>Judge Feedback:</strong></p>
              <p style="margin: 10px 0; font-style: italic;">"${feedback}"</p>
              <p style="margin: 0; font-size: 12px; color: #999;">Provided by: ${adminName}</p>
            </div>

            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; border-radius: 4px; margin: 15px 0;">
              <strong>💡 Next Steps:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Review the judge feedback provided above</li>
                <li>Consider this valuable learning experience</li>
                <li>Look for future events and opportunities</li>
                <li>Don't hesitate to participate again!</li>
              </ul>
            </div>

            <p>We appreciate your participation and effort. Keep improving!</p>

            <p style="text-align: center;">
              <a href="${eventUrl}" class="button">View Event Details</a>
            </p>
          </div>
          
          <div class="footer">
            <p>You're receiving this email regarding your participation in ${eventData.title}.</p>
            <p>&copy; ${new Date().getFullYear()} Event Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: recipientEmails,
    subject: `📊 ${eventData.title} - Round ${teamData.round} Results`,
    html,
    text: `Thank you for participating in Round ${teamData.round} of ${eventData.title}.\n\nFeedback: ${feedback}\n\nView event details: ${eventUrl}`,
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
