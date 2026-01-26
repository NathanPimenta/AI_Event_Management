import { NextResponse } from "next/server"

// Proxy to the Python poster_generator FastAPI service running on port 8003
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const res = await fetch("http://localhost:8003/generate-background", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.detail || data.error || `Poster Generator API error: ${res.status}`,
          raw: data,
        },
        { status: res.status },
      )
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error proxying to poster generator API:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 },
    )
  }
}