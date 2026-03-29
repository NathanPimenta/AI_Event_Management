import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

type EmailDraft = {
  id: string
  to: string
  subject: string
  body: string
  timestamp: string
  person_data?: {
    name?: string
    title?: string
    company?: string
    email?: string
  }
}

export async function GET() {
  try {
    // Look for draft files in scraper_module directory
    // From Planify-main/app/api/scraper/email-drafts/route.ts:
    // process.cwd() = Planify-main
    // ".." = AI_Event_Management (parent)
    // "scraper_module" = scraper_module directory
    const baseDir = path.join(process.cwd(), "..", "scraper_module")
    
    console.log("[email-drafts] Looking for drafts in:", baseDir)
    
    // First try email_drafts_latest.json in scraper_module
    let latestPath = path.join(baseDir, "email_drafts_latest.json")
    console.log("[email-drafts] Checking latest path:", latestPath)
    
    if (!fs.existsSync(latestPath)) {
      console.log("[email-drafts] Latest file not found, looking for session files...")
      
      // If no latest file, look for session-specific files in scraper_module
      if (!fs.existsSync(baseDir)) {
        console.log("[email-drafts] Scraper_module directory does not exist:", baseDir)
        return NextResponse.json(
          {
            success: true,
            drafts: [],
            message: "No draft files found",
          },
          { status: 200 },
        )
      }

      const files = fs.readdirSync(baseDir)
      console.log("[email-drafts] Files in scraper_module:", files.filter(f => f.includes("draft")))
      
      const draftFiles = files
        .filter((f) => f.startsWith("email_drafts_session_") && f.endsWith(".json"))
        .sort()
        .reverse()

      console.log("[email-drafts] Found session files:", draftFiles)

      if (draftFiles.length === 0) {
        console.log("[email-drafts] No session draft files found")
        return NextResponse.json(
          {
            success: true,
            drafts: [],
            message: "No draft files found",
          },
          { status: 200 },
        )
      }

      latestPath = path.join(baseDir, draftFiles[0])
      console.log("[email-drafts] Using session file:", latestPath)
    }

    if (!fs.existsSync(latestPath)) {
      console.log("[email-drafts] Final path does not exist:", latestPath)
      return NextResponse.json(
        {
          success: true,
          drafts: [],
          message: "No drafts available",
        },
        { status: 200 },
      )
    }

    console.log("[email-drafts] Reading file:", latestPath)
    const content = fs.readFileSync(latestPath, "utf-8")
    const draftsData = JSON.parse(content)

    // Transform to include IDs and proper structure
    const drafts: EmailDraft[] = draftsData.map((draft: any, index: number) => ({
      id: `draft_${index}`,
      to: draft.to,
      subject: draft.subject,
      body: draft.body,
      timestamp: draft.timestamp,
      person_data: draft.person_data || {},
    }))

    console.log("[email-drafts] Successfully loaded", drafts.length, "drafts")

    return NextResponse.json(
      {
        success: true,
        drafts,
        total: drafts.length,
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("[email-drafts] Error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to read email drafts", details: error?.stack },
      { status: 500 },
    )
  }
}
