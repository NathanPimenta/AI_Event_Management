import { NextResponse } from "next/server"
import { getClubById } from "@/lib/db"
import fs from "fs"
import path from "path"

// Path to team formation module
const TEAM_FORMATION_SCRIPT = path.join(process.cwd(), "..", "team_formation", "src", "main.py")

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const clubId = params.id
    const { requirements, members } = await request.json()

    // Verify club exists
    const club = await getClubById(clubId)
    if (!club) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 })
    }

    // Write requirements and members data to temporary files
    const dataDir = path.join(process.cwd(), "..", "team_formation", "data")
    fs.mkdirSync(dataDir, { recursive: true })

    fs.writeFileSync(
      path.join(dataDir, "event_requirements.json"),
      JSON.stringify({ requirements }, null, 2)
    )

    fs.writeFileSync(
      path.join(dataDir, "participants.csv"),
      "id,name,email,current_role\n" +
      members.map((m: any) => 
        `${m.userId},${m.name},${m.email},${m.role}`
      ).join("\n")
    )

    // Run team formation script
    const { spawn } = require("child_process")
    const python = spawn("python", [TEAM_FORMATION_SCRIPT])

    return new Promise((resolve) => {
      python.on("close", () => {
        try {
          // Read results
          const teamsData = fs.readFileSync(
            path.join(dataDir, "output", "optimal_teams.json"),
            "utf8"
          )
          const teams = JSON.parse(teamsData)

          resolve(NextResponse.json({ teams }))
        } catch (error) {
          console.error("Error reading team formation results:", error)
          resolve(NextResponse.json(
            { error: "Failed to process team formation results" },
            { status: 500 }
          ))
        }
      })
    })

  } catch (error) {
    console.error("Error in team formation:", error)
    return NextResponse.json(
      { error: "An error occurred during team formation" },
      { status: 500 }
    )
  }
}