import { NextResponse } from "next/server"

// Proxy to the Python Image Curator API running on port 8005
export async function POST(request: Request) {
    try {
        const body = await request.json()

        // Assuming the Python service is running on port 8005
        const res = await fetch("https://affinitive-unicuspid-cinthia.ngrok-free.dev/curate", {
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
                    error: data.detail || `Image Curator API error: ${res.status}`,
                    details: data
                },
                { status: res.status }
            )
        }

        return NextResponse.json(data)

    } catch (error: any) {
        console.error("Error proxying to Image Curator API:", error)
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}

// Proxy status endpoint
export async function GET(request: Request) {
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const requestId = pathSegments[pathSegments.length - 1]

    if (!requestId) {
        return NextResponse.json(
            { error: "Missing request ID" },
            { status: 400 }
        )
    }

    try {
        const res = await fetch(`https://affinitive-unicuspid-cinthia.ngrok-free.dev/status/${requestId}`)
        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
            return NextResponse.json(
                {
                    error: data.detail || `Status check failed: ${res.status}`,
                    details: data
                },
                { status: res.status }
            )
        }

        return NextResponse.json(data)

    } catch (error: any) {
        console.error("Error checking job status:", error)
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}
