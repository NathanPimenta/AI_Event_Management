import { NextResponse } from "next/server"

// Proxy to the Python scraper_module FastAPI service running on port 8002
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const res = await fetch("http://localhost:8002/scrape/", {
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
          error: data.detail || data.error || `Scraper API error: ${res.status}`,
          raw: data,
        },
        { status: res.status },
      )
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error proxying to scraper API:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 },
    )
  }
}


