import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

type Email = {
  id: string
  timestamp: string
  to: string
  subject: string
  body: string
}

function parseEmailsFromLog(logContent: string): Email[] {
  const emails: Email[] = []
  const emailPattern = /--- EMAIL SENT AT (.+?) ---\nTo: (.+?)\nSubject: (.+?)\nBody:\n([\s\S]*?)\n---+/g

  let match
  let id = 0
  while ((match = emailPattern.exec(logContent)) !== null) {
    const [, timestamp, to, subject, body] = match
    emails.push({
      id: `email_${id++}`,
      timestamp: timestamp.trim(),
      to: to.trim(),
      subject: subject.trim(),
      body: body.trim(),
    })
  }

  return emails.reverse() // Most recent first
}

export async function GET() {
  try {
    // Look for sent_emails.log in scraper_module directory
    // From Planify-main/app/api/scraper/emails/route.ts:
    // process.cwd() = Planify-main
    // ".." = AI_Event_Management (parent)
    // "scraper_module" = scraper_module directory
    const logPath = path.join(process.cwd(), "..", "scraper_module", "sent_emails.log")

    console.log("[emails] Looking for sent emails at:", logPath)

    if (!fs.existsSync(logPath)) {
      console.log("[emails] Sent emails log not found")
      return NextResponse.json(
        {
          success: true,
          emails: [],
          message: "No emails found",
        },
        { status: 200 },
      )
    }

    const logContent = fs.readFileSync(logPath, "utf-8")
    const emails = parseEmailsFromLog(logContent)

    console.log("[emails] Successfully loaded", emails.length, "emails")

    return NextResponse.json(
      {
        success: true,
        emails,
        total: emails.length,
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("[emails] Error reading emails:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to read emails" },
      { status: 500 },
    )
  }
}
