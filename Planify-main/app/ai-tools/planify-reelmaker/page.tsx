"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle, Video, Download, ChevronLeft, ChevronRight } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"

type ReelMode = "auto" | "manual"
type ReelStage = "initial" | "captions" | "final"

export default function ReelMakerPage() {
    const [mode, setMode] = useState<ReelMode>("auto")
    const [loading, setLoading] = useState(false)
    const [stage, setStage] = useState<ReelStage>("initial")
    const [resultVideo, setResultVideo] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Form inputs for auto mode
    const [driveLink, setDriveLink] = useState("")
    const [clipText, setClipText] = useState("")
    const [addManualCaptions, setAddManualCaptions] = useState(false)

    // Manual mode states
    const [slideshowImages, setSlideshowImages] = useState<string[]>([])
    const [reelImages, setReelImages] = useState<string[]>([])
    const [captions, setCaptions] = useState<{ [key: number]: string }>({})
    const [slideshowLoading, setSlideshowLoading] = useState(false)
    const [showCaptionEditor, setShowCaptionEditor] = useState(false)
    const [useChatOverlay, setUseChatOverlay] = useState(false)

    const handleAutoSubmit = async (e: React.FormEvent) => {
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
            
            // If manual captions enabled and we have images, go to caption editor
            if (addManualCaptions && data.images && data.images.length > 0) {
                setReelImages(data.images)
                setCaptions({})
                setShowCaptionEditor(true)
                setStage("captions")
            } else if (data.video_filename) {
                setResultVideo(data.video_filename)
                setStage("final")
            } else {
                setError("Response did not return a valid video filename.")
            }

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred while communicating with the backend.")
        } finally {
            setLoading(false)
        }
    }

    const handleGenerateSlideshow = async (e: React.FormEvent) => {
        e.preventDefault()
        setSlideshowLoading(true)
        setError(null)

        if (!driveLink) {
            setError("Please provide a Google Drive link.")
            setSlideshowLoading(false)
            return
        }

        try {
            const payload = {
                drive_link: driveLink
            }

            const response = await fetch("http://127.0.0.1:8006/generate-slideshow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || "Failed to generate slideshow.")
            }

            const data = await response.json()
            if (data.images && data.images.length > 0) {
                setSlideshowImages(data.images)
                setReelImages(data.images)
                setCaptions({})
                setShowCaptionEditor(true)
                setStage("captions")
            } else {
                setError("No images found in the slideshow.")
            }

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred while generating the slideshow.")
        } finally {
            setSlideshowLoading(false)
        }
    }

    const handleCaptionChange = (index: number, text: string) => {
        setCaptions(prev => ({
            ...prev,
            [index]: text
        }))
    }

    const handleSubmitCaptions = async () => {
        setLoading(true)
        setError(null)

        try {
            // Validate all images have captions
            const allCaptioned = reelImages.every((_, idx) => captions[idx]?.trim())
            if (!allCaptioned) {
                setError("Please add captions for all images.")
                setLoading(false)
                return
            }

            const payload = {
                image_paths: reelImages,
                captions: reelImages.map((_, idx) => captions[idx] || ""),
                use_chat_overlay: useChatOverlay
            }

            const response = await fetch("http://127.0.0.1:8006/generate-reel-with-captions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || "Failed to generate reel with captions.")
            }

            const data = await response.json()
            if (data.video_filename) {
                setResultVideo(data.video_filename)
                setShowCaptionEditor(false)
                setStage("final")
            } else {
                setError("Response did not return a valid video filename.")
            }

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred while generating the reel.")
        } finally {
            setLoading(false)
        }
    }

    const downloadReel = () => {
        if (!resultVideo) return
        window.open(`http://127.0.0.1:8006/download-reel/${encodeURIComponent(resultVideo)}`, "_blank")
    }

    // Caption Editor View
    if (showCaptionEditor) {
        return (
            <div className="container mx-auto p-6 md:p-12 bg-gradient-to-b from-slate-900 to-slate-800 min-h-screen">
                <div className="max-w-6xl mx-auto">
                    <div className="mb-8">
                        <Button 
                            variant="outline" 
                            onClick={() => {
                                setShowCaptionEditor(false)
                                setStage("initial")
                                setReelImages([])
                                setCaptions({})
                            }}
                            className="mb-4"
                        >
                            ← Back
                        </Button>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-500 p-4 rounded-md text-sm border border-red-200 mb-4">
                            {error}
                        </div>
                    )}

                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle>Add Captions to Images</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground mb-6">
                                Add custom captions for each image below. These captions will be overlaid at the bottom of each image in your reel.
                            </p>

                            {/* Chat Overlay Checkbox */}
                            <div className="flex items-center gap-3 p-4 mb-6 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                                <Checkbox
                                    id="use-chat-overlay"
                                    checked={useChatOverlay}
                                    onCheckedChange={(checked) => setUseChatOverlay(checked as boolean)}
                                />
                                <div className="flex-1">
                                    <Label htmlFor="use-chat-overlay" className="font-semibold cursor-pointer text-green-900 dark:text-green-100">
                                        Use Chat Bubble Overlay
                                    </Label>
                                    <p className="text-sm text-green-700 dark:text-green-300">
                                        Display captions inside a chat bubble layout (like a text message chat) instead of standard text.
                                    </p>
                                </div>
                            </div>

                            {/* Grid of images with caption inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {reelImages.map((imgPath, idx) => (
                                    <div key={idx} className="border rounded-lg overflow-hidden bg-slate-950">
                                        <div className="aspect-video bg-black relative overflow-hidden">
                                            <img
                                                src={`http://127.0.0.1:8006/image/${imgPath.split('/').pop()}`}
                                                alt={`Image ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23333' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' font-size='14' fill='%23999' text-anchor='middle' dy='.3em'%3EImage not found%3C/text%3E%3C/svg%3E"
                                                }}
                                            />
                                        </div>

                                        {/* Caption Input */}
                                        <div className="p-4 space-y-3">
                                            <Label htmlFor={`caption-${idx}`} className="text-sm font-semibold">
                                                Image {idx + 1} Caption <span className="text-red-500">*</span>
                                            </Label>
                                            <textarea
                                                id={`caption-${idx}`}
                                                value={captions[idx] || ""}
                                                onChange={(e) => handleCaptionChange(idx, e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-white rounded text-sm placeholder-slate-500 focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-none"
                                                placeholder="Enter caption for this image..."
                                                rows={3}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Progress and Submit */}
                            <div className="mt-8 pt-6 border-t space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-muted-foreground">
                                        Progress: <span className="font-semibold text-white">
                                            {Object.keys(captions).filter(k => captions[parseInt(k)]?.trim()).length} / {reelImages.length}
                                        </span> captions added
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Captions will appear at the bottom of each image in your reel
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => {
                                            setShowCaptionEditor(false)
                                            setStage("initial")
                                            setReelImages([])
                                            setCaptions({})
                                        }}
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
                                                Generating Reel...
                                            </>
                                        ) : (
                                            <>
                                                <Video className="mr-2 h-4 w-4" />
                                                Generate Reel with Captions
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    if (loading && stage === "initial") {
        return (
            <div className="container mx-auto p-6 md:p-12">
                <Card className="max-w-4xl mx-auto">
                    <CardContent className="py-16 text-center">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                        <h2 className="text-2xl font-semibold">Generating Your AI Reel...</h2>
                        <p className="text-muted-foreground mt-2">
                            {mode === "auto" 
                                ? "The AI is analyzing the images, generating the script, and producing the video." 
                                : "The AI is generating the slideshow and preparing captions."
                            } This operation usually takes a few minutes.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (stage === "final" && resultVideo) {
        return (
            <div className="container mx-auto p-6 md:p-12">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-3xl font-bold">Your Reel is Ready!</h2>
                        <p className="text-muted-foreground mt-2">
                            {addManualCaptions 
                                ? "Your reel with custom captions has been generated successfully."
                                : "The AI has successfully processed the clips into a cohesive, perfectly-timed reel."
                            }
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
                                <Button variant="outline" onClick={() => {
                                    setResultVideo(null)
                                    setStage("initial")
                                    setMode("auto")
                                    setDriveLink("")
                                    setClipText("")
                                    setAddManualCaptions(false)
                                    setSlideshowImages([])
                                }}>
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
            <div className="max-w-3xl mx-auto">
                {/* Page Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold tracking-tight">AI Reel Maker</h1>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Generate high-quality reels with AI or add custom captions to your images.
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Choose Reel Creation Mode</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={mode} onValueChange={(v) => setMode(v as ReelMode)} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="auto">🤖 Auto Generation</TabsTrigger>
                                <TabsTrigger value="manual">📸 From Slideshow</TabsTrigger>
                            </TabsList>

                            {/* Auto Generation Mode */}
                            <TabsContent value="auto" className="mt-6">
                                <form onSubmit={handleAutoSubmit}>
                                    <div className="space-y-6">
                                        {error && (
                                            <div className="bg-red-50 text-red-500 p-4 rounded-md text-sm border border-red-200">
                                                {error}
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label htmlFor="driveLink-auto" className="text-base font-semibold">
                                                Google Drive Folder Link <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="driveLink-auto"
                                                value={driveLink}
                                                onChange={(e) => setDriveLink(e.target.value)}
                                                placeholder="e.g. https://drive.google.com/drive/folders/1abc9xyz..."
                                                required={mode === "auto"}
                                                className="h-12"
                                            />
                                            <p className="text-xs text-muted-foreground">Make sure the folder is publicly accessible ("Anyone with the link").</p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="clipText-auto" className="text-base font-semibold">
                                                Concept/Script Base (Clip Text) <span className="text-red-500">*</span>
                                            </Label>
                                            <textarea
                                                id="clipText-auto"
                                                value={clipText}
                                                onChange={(e) => setClipText(e.target.value)}
                                                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                placeholder="Describe what the reel is about..."
                                                required={mode === "auto"}
                                            />
                                        </div>

                                        {/* Manual Captions Checkbox */}
                                        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                                            <Checkbox
                                                id="manual-captions-auto"
                                                checked={addManualCaptions}
                                                onCheckedChange={(checked) => setAddManualCaptions(checked as boolean)}
                                            />
                                            <div className="flex-1">
                                                <Label htmlFor="manual-captions-auto" className="font-semibold cursor-pointer">
                                                    Add Manual Captions
                                                </Label>
                                                <p className="text-sm text-muted-foreground">
                                                    Generate reel first, then add custom captions to each image
                                                </p>
                                            </div>
                                        </div>

                                        <Button type="submit" size="lg" className="w-full text-lg h-14" disabled={loading}>
                                            Generate AI Reel
                                        </Button>
                                    </div>
                                </form>
                            </TabsContent>

                            {/* Manual From Slideshow Mode */}
                            <TabsContent value="manual" className="mt-6">
                                <form onSubmit={handleGenerateSlideshow}>
                                    <div className="space-y-6">
                                        {error && (
                                            <div className="bg-red-50 text-red-500 p-4 rounded-md text-sm border border-red-200">
                                                {error}
                                            </div>
                                        )}

                                        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
                                            <p className="font-semibold mb-2">📋 How it works:</p>
                                            <ol className="list-decimal list-inside space-y-1">
                                                <li>Provide your Google Drive folder link</li>
                                                <li>AI generates slideshow of best images</li>
                                                <li>Add custom captions to each image</li>
                                                <li>AI generates reel with your captions overlaid</li>
                                            </ol>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="driveLink-manual" className="text-base font-semibold">
                                                Google Drive Folder Link <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="driveLink-manual"
                                                value={driveLink}
                                                onChange={(e) => setDriveLink(e.target.value)}
                                                placeholder="e.g. https://drive.google.com/drive/folders/1abc9xyz..."
                                                required={mode === "manual"}
                                                className="h-12"
                                            />
                                            <p className="text-xs text-muted-foreground">Make sure the folder is publicly accessible.</p>
                                        </div>

                                        <Button 
                                            type="submit" 
                                            size="lg" 
                                            className="w-full text-lg h-14" 
                                            disabled={slideshowLoading || !driveLink}
                                        >
                                            {slideshowLoading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Generating Slideshow...
                                                </>
                                            ) : (
                                                <>
                                                    <Video className="mr-2 h-4 w-4" />
                                                    Generate Slideshow
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
