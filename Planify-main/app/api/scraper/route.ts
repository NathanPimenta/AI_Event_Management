import { NextResponse } from "next/server"

// Proxy to the Python scraper_module FastAPI service running on port 8001
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Use AbortController with a 10-minute timeout (600 seconds)
    // Web scraping can take a while
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 600000) // 10 minutes

    try {
      const res = await fetch("http://localhost:8001/scrape/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeout)

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
    } catch (fetchError: any) {
      clearTimeout(timeout)
      if (fetchError.name === "AbortError") {
        console.error("Scraper request timed out after 10 minutes")
        return NextResponse.json(
          { success: false, error: "Scraper request timed out. The backend took too long to complete." },
          { status: 504 },
        )
      }
      throw fetchError
    }
  } catch (error: any) {
    console.error("Error proxying to scraper API:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 },
    )
  }
}


