"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle, Video, Download } from "lucide-react"

export default function ReelMakerPage() {
    const [loading, setLoading] = useState(false)
    const [resultVideo, setResultVideo] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Form inputs
    const [driveLink, setDriveLink] = useState("")
    const [clipText, setClipText] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setResultVideo(null)

        if (!driveLink || !clipText) {
            setError("Please provide both a Google Drive link and the Clip Text.")
            setLoading(false)
            return
        }

        try {
            const payload = {
                drive_link: driveLink,
                clip_text: clipText
            }

            // Using port 8006 as configured in our new API
            const response = await fetch("http://127.0.0.1:8006/generate-reel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || "Failed to generate reel.")
            }

            const data = await response.json()
            if (data.video_filename) {
                setResultVideo(data.video_filename)
            } else {
                setError("Response did not return a valid video filename.")
            }

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred while communicating with the backend.")
        } finally {
            setLoading(false)
        }
    }

    const downloadReel = () => {
        if (!resultVideo) return
        window.open(`http://127.0.0.1:8006/download-reel/${encodeURIComponent(resultVideo)}`, "_blank")
    }

    if (loading) {
        return (
            <div className="container mx-auto p-6 md:p-12">
                <Card className="max-w-4xl mx-auto">
                    <CardContent className="py-16 text-center">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                        <h2 className="text-2xl font-semibold">Generating Your AI Reel...</h2>
                        <p className="text-muted-foreground mt-2">
                            The AI is analyzing the images, generating the script, and producing the video. This operation usually takes a few minutes.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (resultVideo) {
        return (
            <div className="container mx-auto p-6 md:p-12">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-3xl font-bold">Your Reel is Ready!</h2>
                        <p className="text-muted-foreground mt-2">
                            The AI has successfully processed the clips into a cohesive, perfectly-timed 60-second reel.
                        </p>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                Generated Video
                                <Button size="sm" onClick={downloadReel}>
                                    <Download className="mr-2 h-4 w-4" /> Download .mp4
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center">
                            <video
                                className="w-full max-w-sm rounded-[2rem] border-[8px] border-zinc-200 dark:border-zinc-800 shadow-xl"
                                src={`http://127.0.0.1:8006/download-reel/${encodeURIComponent(resultVideo)}`}
                                autoPlay
                                loop
                                controls
                            />
                            <div className="mt-8">
                                <Button variant="outline" onClick={() => setResultVideo(null)}>
                                    Generate Another Reel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 md:p-12">
            <div className="max-w-2xl mx-auto">
                {/* Page Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold tracking-tight">AI Reel Maker</h1>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Provide a Google Drive link alongside your core marketing or visual concept text, and let the AI generate a high-retention 60-second short video.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <Card className="mb-8 p-4">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-2xl">
                                <Video className="h-6 w-6" /> Configuration
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {error && (
                                <div className="bg-red-50 text-red-500 p-4 rounded-md text-sm border border-red-200">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="driveLink" className="text-base font-semibold">Google Drive Folder Link <span className="text-red-500">*</span></Label>
                                <Input
                                    id="driveLink"
                                    value={driveLink}
                                    onChange={(e) => setDriveLink(e.target.value)}
                                    placeholder="e.g. https://drive.google.com/drive/folders/1abc9xyz..."
                                    required
                                    className="h-12"
                                />
                                <p className="text-xs text-muted-foreground">Make sure the folder is publicly accessible ("Anyone with the link").</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="clipText" className="text-base font-semibold">Concept/Script Base (Clip Text) <span className="text-red-500">*</span></Label>
                                <textarea
                                    id="clipText"
                                    value={clipText}
                                    onChange={(e) => setClipText(e.target.value)}
                                    className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Enter exactly what the reel is about. The AI will strictly script and synchronize around this text for roughly a 1-minute read..."
                                    required
                                />
                            </div>

                            <div className="pt-4">
                                <Button type="submit" size="lg" className="w-full text-lg h-14" disabled={loading}>
                                    Generate AI Reel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </div>
        </div>
    )
}
