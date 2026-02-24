"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Images, CheckCircle, Download, ExternalLink, AlertCircle } from "lucide-react"

export default function ImageCuratorPage() {
    const [requestId, setRequestId] = useState<string | null>(null)
    const [pollingInterval, setPollingInterval] = useState<number | null>(null)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Input State
    const [driveUrl, setDriveUrl] = useState("")
    const [numImages, setNumImages] = useState([10])

    // Result State
    const [curatedImages, setCuratedImages] = useState<string[]>([])
    const [totalProcessed, setTotalProcessed] = useState(0)

    const handleCurate = async () => {
        if (!driveUrl) {
            setError("Please enter a valid Google Drive Folder URL")
            return
        }

        setLoading(true)
        setError(null)
        setSuccess(false)
        setCuratedImages([])

        try {
            // Step 1: Submit curation request (returns immediately)
            const response = await fetch("/api/image-curator", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    drive_url: driveUrl,
                    num_images: numImages[0]
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || data.detail || "Failed to submit curation request")
            }

            // Step 2: Extract request ID and start polling
            const reqId = data.request_id
            setRequestId(reqId)
            setStatusMessage("Queued...")

            // Poll every 2 seconds
            const interval = window.setInterval(async () => {
                try {
                    const statusResponse = await fetch(`/api/image-curator/status/${reqId}`)
                    const statusData = await statusResponse.json()

                    if (statusData.status === "completed" && statusData.result) {
                        // Curation complete
                        clearInterval(interval)
                        setRequestId(null)
                        setStatusMessage(null)

                        const infoWithFullUrls = statusData.result.curated_images.map((url: string) =>
                            url.startsWith("http") ? url : `http://localhost:8005${url}`
                        )

                        setCuratedImages(infoWithFullUrls)
                        setTotalProcessed(statusData.result.total_processed)
                        setSuccess(true)
                        setLoading(false)
                    } else if (statusData.status === "failed") {
                        // Curation failed
                        clearInterval(interval)
                        setRequestId(null)
                        setStatusMessage(null)
                        setError(statusData.error || "Curation failed")
                        setLoading(false)
                    } else if (statusData.error) {
                        // Catch cases where the proxy returns a 404 or other error directly
                        clearInterval(interval)
                        setRequestId(null)
                        setStatusMessage(null)
                        setError(statusData.error)
                        setLoading(false)
                    } else {
                        // Still processing, show progress (non-error)
                        setStatusMessage(statusData.progress || "Processing...")
                    }
                } catch (err: any) {
                    console.error("Status check error:", err)
                    // Continue polling even if status check fails
                }
            }, 2000)

            setPollingInterval(interval)

        } catch (err: any) {
            console.error(err)
            setError(err.message || "An unexpected error occurred")
            setLoading(false)
        }
    }

    // Cleanup polling interval on unmount
    useEffect(() => {
        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval)
            }
        }
    }, [pollingInterval])

    // Download all images sequentially to avoid browser blocking
    const downloadAll = async () => {
        for (let i = 0; i < curatedImages.length; i++) {
            const url = curatedImages[i]
            try {
                const resp = await fetch(url)
                const blob = await resp.blob()
                const a = document.createElement('a')
                const objectUrl = URL.createObjectURL(blob)
                a.href = objectUrl
                a.download = `curated_image_${i + 1}.jpg`
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(objectUrl)
                // Small delay to reduce download conflicts
                await new Promise((r) => setTimeout(r, 300))
            } catch (e) {
                console.error('Download failed for', url, e)
            }
        }
    }

    return (
        <div className="container mx-auto p-6 md:p-12 max-w-6xl">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    AI Image Curator
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Transform your messy event folders into a curated gallery.
                    Our AI analyzes technical quality and aesthetics to pick the best shots for you.
                </p>
            </div>

            {/* Input Section */}
            <div className="grid gap-8 mb-12">
                <Card className="border-2 border-primary/10 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Images className="h-6 w-6 text-primary" />
                            Source Configuration
                        </CardTitle>
                        <CardDescription>
                            Provide a public Google Drive folder link containing your event photos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="drive-url" className="text-base font-medium">
                                Google Drive Folder Link
                            </Label>
                            <Input
                                id="drive-url"
                                placeholder="https://drive.google.com/drive/folders/..."
                                value={driveUrl}
                                onChange={(e) => setDriveUrl(e.target.value)}
                                className="h-12 text-lg"
                            />
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Ensure the folder is set to "Anyone with the link"
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="num-images" className="text-base font-medium">
                                    Number of Best Images to key
                                </Label>
                                <span className="text-xl font-bold text-primary">{numImages[0]}</span>
                            </div>
                            <Slider
                                id="num-images"
                                min={5}
                                max={50}
                                step={1}
                                value={numImages}
                                onValueChange={setNumImages}
                                className="py-2"
                            />
                            <p className="text-sm text-muted-foreground">
                                We'll analyze the entire folder you provided; this may take several minutes for large folders.
                            </p>
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <Button
                            onClick={handleCurate}
                            disabled={loading || !driveUrl}
                            className="w-full h-14 text-lg font-semibold shadow-md transition-all hover:scale-[1.01]"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Curating Your Gallery...
                                </>
                            ) : (
                                "Curate My Photos"
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Results Section */}
            {success && curatedImages.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-10 duration-700">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <CheckCircle className="text-green-500 h-6 w-6" />
                            Curated Collection ({curatedImages.length})
                        </h2>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={downloadAll}>
                                <Download className="mr-2 h-4 w-4" />
                                Download All
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {curatedImages.map((src, idx) => (
                            <div key={idx} className="group relative aspect-[3/4] overflow-hidden rounded-xl bg-muted shadow-sm hover:shadow-xl transition-all duration-300">
                                <img
                                    src={src}
                                    alt={`Curated ${idx + 1}`}
                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <a
                                        href={src}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 text-white transition-colors"
                                        title="View Full Size"
                                    >
                                        <ExternalLink className="h-5 w-5" />
                                    </a>
                                    <a
                                        href={src}
                                        download={`curated_image_${idx + 1}.jpg`}
                                        className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 text-white transition-colors"
                                        title="Download"
                                    >
                                        <Download className="h-5 w-5" />
                                    </a>
                                </div>
                                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white font-mono">
                                    #{idx + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Show processing indicator independently from success state */}
            {loading && statusMessage && !success && (
                <div className="mt-8 animate-in fade-in duration-500">
                    <Alert className="border-2 border-primary/20 bg-primary/5">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <AlertTitle className="ml-2 font-semibold">Processing Images</AlertTitle>
                        <AlertDescription className="ml-2 font-mono mt-1 text-sm bg-white/50 p-2 rounded w-fit">
                            {statusMessage}
                        </AlertDescription>
                    </Alert>
                </div>
            )}
        </div>
    )
}
