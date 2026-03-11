import { NextResponse } from "next/server"

// Proxy status endpoint
export async function GET(
    request: Request,
    { params }: { params: { requestId: string } }
) {
    const requestId = params.requestId

    if (!requestId) {
        return NextResponse.json(
            { error: "Missing request ID" },
            { status: 400 }
        )
    }

    try {
        const curatorUrl = process.env.IMAGE_CURATOR_URL || "http://127.0.0.1:8005"
        const res = await fetch(`${curatorUrl}/status/${requestId}`)
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
