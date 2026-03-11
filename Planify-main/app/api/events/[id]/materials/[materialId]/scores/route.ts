import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const { id: eventId, materialId } = await params
    const session = await verifyAuth(req)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user can view scores
    if (!hasPermission(session.user.role as any, 'materials', 'score')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch existing scores for this material submission
    const result = await query(
      `SELECT 
        ms.id,
        ms.score,
        ms.max_score,
        ms.feedback,
        ms.criteria_scores,
        ms.scored_at,
        u.name as judge_name
       FROM material_scores ms
       JOIN users u ON ms.judge_id = u.id
       WHERE ms.submission_id = $1
       ORDER BY ms.scored_at DESC`,
      [materialId]
    )

    return NextResponse.json(result.rows)

  } catch (error) {
    console.error("Error fetching material scores:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const { id: eventId, materialId } = await params
    const session = await verifyAuth(req)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user can score materials
    if (!hasPermission(session.user.role as any, 'materials', 'score')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if user is assigned as judge for this event
    const judgeCheck = await query(
      `SELECT id FROM judge_assignments 
       WHERE event_id = $1 AND judge_id = $2 AND status = 'active'`,
      [eventId, session.user.id]
    )

    if (judgeCheck.rows.length === 0) {
      return NextResponse.json({ error: "Not assigned as judge for this event" }, { status: 403 })
    }

    const { score, maxScore, feedback, criteriaScores } = await req.json()

    // Validate score
    if (typeof score !== 'number' || score < 0 || score > maxScore) {
      return NextResponse.json({ error: "Invalid score value" }, { status: 400 })
    }

    // Check if judge has already scored this submission
    const existingScore = await query(
      `SELECT id FROM material_scores 
       WHERE submission_id = $1 AND judge_id = $2`,
      [materialId, session.user.id]
    )

    if (existingScore.rows.length > 0) {
      // Update existing score
      const result = await query(
        `UPDATE material_scores 
         SET score = $1, max_score = $2, feedback = $3, criteria_scores = $4, scored_at = NOW()
         WHERE submission_id = $5 AND judge_id = $6
         RETURNING id`,
        [score, maxScore, feedback, JSON.stringify(criteriaScores), materialId, session.user.id]
      )

      return NextResponse.json({ 
        id: result.rows[0].id, 
        message: "Score updated successfully" 
      })
    } else {
      // Insert new score
      const result = await query(
        `INSERT INTO material_scores (submission_id, judge_id, event_id, score, max_score, feedback, criteria_scores)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [materialId, session.user.id, eventId, score, maxScore, feedback, JSON.stringify(criteriaScores)]
      )

      return NextResponse.json({ 
        id: result.rows[0].id, 
        message: "Score submitted successfully" 
      })
    }

  } catch (error) {
    console.error("Error submitting material score:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}