"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle, Video, Download } from "lucide-react"

type ReelStage = "initial" | "slideshow" | "captions" | "generating" | "final"

export default function ReelMakerPage() {
    const [loading, setLoading] = useState(false)
    const [stage, setStage] = useState<ReelStage>("initial")
    const [resultVideo, setResultVideo] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [driveLink, setDriveLink] = useState("")
    const [images, setImages] = useState<string[]>([])
    const [captions, setCaptions] = useState<{ [key: number]: string }>({})
    const [slideshowLoading, setSlideshowLoading] = useState(false)

    const handleGenerateSlideshow = async (e: React.FormEvent) => {
        e.preventDefault()
        setSlideshowLoading(true)
        setError(null)
        setStage("slideshow")

        if (!driveLink) {
            setError("Please provide a Google Drive link.")
            setSlideshowLoading(false)
            setStage("initial")
            return
        }

        try {
            const response = await fetch("http://127.0.0.1:8006/generate-slideshow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drive_link: driveLink }),
            })

            if (!response.ok) {
                throw new Error("Failed to generate slideshow")
            }

            const data = await response.json()
            if (data.images && data.images.length > 0) {
                setImages(data.images)
                setCaptions({})
                setStage("captions")
            } else {
                setError("No images found")
                setStage("initial")
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred")
            setStage("initial")
        } finally {
            setSlideshowLoading(false)
        }
    }

    const handleCaptionChange = (index: number, text: string) => {
        setCaptions(prev => ({ ...prev, [index]: text }))
    }

    const handleSubmitCaptions = async () => {
        setLoading(true)
        setError(null)

        try {
            const allCaptioned = images.every((_, idx) => captions[idx]?.trim())
            if (!allCaptioned) {
                setError("Please add captions for all images")
                setLoading(false)
                return
            }

            setStage("generating")
            const response = await fetch("http://127.0.0.1:8006/generate-reel-with-captions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image_paths: images,
                    captions: images.map((_, idx) => captions[idx] || "")
                }),
            })

            if (!response.ok) {
                throw new Error("Failed to generate reel")
            }

            const data = await response.json()
            if (data.video_filename) {
                setResultVideo(data.video_filename)
                setStage("final")
            } else {
                setError("No video filename returned")
                setStage("captions")
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred")
            setStage("captions")
        } finally {
            setLoading(false)
        }
    }

    // Caption Editor View
    if (stage === "captions") {
        return (
            <div className="container mx-auto p-6 md:p-12">
                <div className="max-w-6xl mx-auto">
                    <Button 
                        variant="outline" 
                        onClick={() => { setStage("initial"); setImages([]); setCaptions({}) }}
                        className="mb-4"
                    >
                        ← Back
                    </Button>

                    {error && (
                        <div className="bg-red-50 text-red-500 p-4 rounded-md text-sm border border-red-200 mb-4">
                            {error}
                        </div>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Add Captions for Narration</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground mb-6">
                                Add narration for each image. Your captions will become the audio narration.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                {images.map((imgPath, idx) => (
                                    <div key={idx} className="border rounded-lg overflow-hidden">
                                        <div className="aspect-video bg-black">
                                            <img
                                                src={`http://127.0.0.1:8006/image/${imgPath.split('/').pop()}`}
                                                alt={`Image ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23333' width='400' height='300'/%3E%3C/svg%3E"
                                                }}
                                            />
                                        </div>
                                        <div className="p-4 space-y-2">
                                            <Label htmlFor={`caption-${idx}`} className="text-sm font-semibold">
                                                Image {idx + 1} <span className="text-red-500">*</span>
                                            </Label>
                                            <textarea
                                                id={`caption-${idx}`}
                                                value={captions[idx] || ""}
                                                onChange={(e) => handleCaptionChange(idx, e.target.value)}
                                                className="w-full px-3 py-2 border rounded text-sm resize-none bg-white dark:bg-slate-900"
                                                placeholder="Narration for this image..."
                                                rows={3}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={() => { setStage("initial"); setImages([]); setCaptions({}) }}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmitCaptions}
                                    disabled={loading || !Object.keys(captions).filter(k => captions[parseInt(k)]?.trim()).length}
                                    className="flex-1"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Video className="mr-2 h-4 w-4" />
                                            Generate Reel
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    // Loading screens
    if (loading && stage === "slideshow") {
        return (
            <div className="container mx-auto p-6 md:p-12">
                <Card className="max-w-4xl mx-auto">
                    <CardContent className="py-16 text-center">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                        <h2 className="text-2xl font-semibold">Selecting Best Images...</h2>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (loading && stage === "generating") {
        return (
            <div className="container mx-auto p-6 md:p-12">
                <Card className="max-w-4xl mx-auto">
                    <CardContent className="py-16 text-center">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                        <h2 className="text-2xl font-semibold">Creating Your Reel...</h2>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Final screen
    if (stage === "final" && resultVideo) {
        return (
            <div className="container mx-auto p-6 md:p-12">
                <div className="max-w-4xl mx-auto text-center">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-3xl font-bold mb-2">Your Reel is Ready!</h2>
                    <p className="text-muted-foreground mb-8">Download your reel with narration</p>
                    
                    <Card>
                        <CardContent className="pt-6">
                            <video
                                className="w-full max-w-sm mx-auto rounded-lg mb-6"
                                src={`http://127.0.0.1:8006/download-reel/${encodeURIComponent(resultVideo)}`}
                                autoPlay
                                loop
                                controls
                            />
                            <div className="flex gap-3">
                                <Button 
                                    onClick={() => window.open(`http://127.0.0.1:8006/download-reel/${encodeURIComponent(resultVideo)}`, "_blank")}
                                    className="flex-1"
                                >
                                    <Download className="mr-2 h-4 w-4" /> Download
                                </Button>
                                <Button
                                    onClick={() => { setResultVideo(null); setStage("initial"); setDriveLink(""); setImages([]); setCaptions({}) }}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    Create Another
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    // Main form
    return (
        <div className="container mx-auto p-6 md:p-12">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold">AI Reel Maker</h1>
                    <p className="mt-2 text-lg text-muted-foreground">
                        Create reels with custom narration from captions
                    </p>
                </div>

                <Card>
                    <CardContent className="pt-6">
                        <form onSubmit={handleGenerateSlideshow} className="space-y-6">
                            {error && (
                                <div className="bg-red-50 text-red-500 p-4 rounded text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded text-sm">
                                <p className="font-semibold mb-2">📋 Steps:</p>
                                <ol className="list-decimal list-inside space-y-1 text-sm">
                                    <li>Provide Google Drive folder link</li>
                                    <li>AI selects best images</li>
                                    <li>Add narration for each image</li>
                                    <li>Download your reel</li>
                                </ol>
                            </div>

                            <div className="space-y-2">
                                <Label className="font-semibold">
                                    Google Drive Folder <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={driveLink}
                                    onChange={(e) => setDriveLink(e.target.value)}
                                    placeholder="https://drive.google.com/drive/folders/..."
                                    className="h-12"
                                />
                            </div>

                            <Button 
                                type="submit" 
                                size="lg" 
                                className="w-full"
                                disabled={slideshowLoading || !driveLink}
                            >
                                {slideshowLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Selecting Images...
                                    </>
                                ) : (
                                    <>
                                        <Video className="mr-2 h-4 w-4" />
                                        Select Images
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
