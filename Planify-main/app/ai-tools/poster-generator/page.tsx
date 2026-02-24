"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Image as ImageIcon, Loader2, CheckCircle, Download, Wand2, Sparkles } from "lucide-react"

export default function PosterGeneratorPage() {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Step 1: Theme & Size
    const [themePrompt, setThemePrompt] = useState("")
    const [width, setWidth] = useState("1080")
    const [height, setHeight] = useState("1350")

    // Step 2: Generated Image
    const [generatedImageUrl, setGeneratedImageUrl] = useState("")
    const [imageFilename, setImageFilename] = useState("")

    // Step 3: Text Content
    const [posterContent, setPosterContent] = useState("")
    const [layoutIntent, setLayoutIntent] = useState("")

    // Step 4: Final Result
    const [finalPosterUrl, setFinalPosterUrl] = useState("")
    const [designConfig, setDesignConfig] = useState<any>(null)

    const handleGenerateBackground = async () => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch("/api/poster-generator/generate-background", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: themePrompt,
                    width: parseInt(width),
                    height: parseInt(height)
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || "Failed to generate background")
            }

            const data = await response.json()
            setGeneratedImageUrl(`http://localhost:8003${data.image_url}`)
            setImageFilename(data.filename)
            setStep(2)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
            setLoading(false)
        }
    }

    const handleDesignOverlay = async () => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch("/api/poster-generator/design-overlay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image_filename: imageFilename,
                    content: posterContent,
                    intent: layoutIntent
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || "Failed to design overlay")
            }

            const data = await response.json()
            setFinalPosterUrl(`http://localhost:8003${data.preview_url}`)
            setDesignConfig(data.config)
            setStep(3)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
            setLoading(false)
        }
    }

    const downloadPoster = () => {
        if (!finalPosterUrl) return
        const a = document.createElement("a")
        a.href = finalPosterUrl
        a.download = "poster.png"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }

    if (loading) {
        return (
            <div className="container mx-auto p-6 md:p-12">
                <Card className="max-w-4xl mx-auto">
                    <CardContent className="py-16 text-center">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                        <h2 className="text-2xl font-semibold">
                            {step === 1 ? "Generating Background..." : "Designing Your Poster..."}
                        </h2>
                        <p className="text-muted-foreground mt-2">
                            {step === 1
                                ? "Creating your custom background image"
                                : "AI is analyzing and placing text elements"}
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (step === 3 && finalPosterUrl) {
        return (
            <div className="container mx-auto p-6 md:p-12">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-3xl font-bold">Your Poster is Ready!</h2>
                        <p className="text-muted-foreground mt-2">
                            AI-designed and ready to share on Instagram
                        </p>
                    </div>
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Final Poster</CardTitle>
                                <Button onClick={downloadPoster}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-center">
                                <img
                                    src={finalPosterUrl}
                                    alt="Generated Poster"
                                    className="max-w-full h-auto rounded-lg shadow-lg"
                                />
                            </div>
                        </CardContent>
                    </Card>
                    <div className="text-center mt-8">
                        <Button variant="outline" onClick={() => window.location.reload()}>
                            Create Another Poster
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 md:p-12">
            <div className="max-w-4xl mx-auto">
                {/* Page Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold">AI Poster Generator</h1>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Create stunning, Instagram-worthy event posters with AI
                    </p>
                </div>

                {/* Step 1: Theme & Size */}
                {step === 1 && (
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm">1</span>
                                Design Theme & Size
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="theme" className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-yellow-500" />
                                    Theme Description *
                                </Label>
                                <Textarea
                                    id="theme"
                                    value={themePrompt}
                                    onChange={(e) => setThemePrompt(e.target.value)}
                                    placeholder="e.g., Neon cyberpunk hackathon with electric blue and purple gradients"
                                    rows={3}
                                    required
                                />
                                <p className="text-sm text-muted-foreground">
                                    Describe the visual style, colors, and mood for your poster background
                                </p>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="width">Width (px)</Label>
                                    <Select value={width} onValueChange={setWidth}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1080">1080 (Instagram Portrait)</SelectItem>
                                            <SelectItem value="1200">1200 (Square+)</SelectItem>
                                            <SelectItem value="1920">1920 (Landscape)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="height">Height (px)</Label>
                                    <Select value={height} onValueChange={setHeight}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1350">1350 (Instagram Portrait)</SelectItem>
                                            <SelectItem value="1200">1200 (Square)</SelectItem>
                                            <SelectItem value="1080">1080 (Landscape)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="text-center">
                                <Button
                                    onClick={handleGenerateBackground}
                                    size="lg"
                                    disabled={!themePrompt.trim()}
                                >
                                    <ImageIcon className="mr-2 h-5 w-5" />
                                    Generate Background
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2: Add Text Content */}
                {step === 2 && (
                    <>
                        <Card className="mb-8">
                            <CardHeader>
                                <CardTitle>Generated Background</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-center mb-4">
                                    <img
                                        src={generatedImageUrl}
                                        alt="Background"
                                        className="max-w-full h-auto rounded-lg shadow-lg"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="mb-8">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm">2</span>
                                    Add Text Content
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="content">Poster Content *</Label>
                                    <Textarea
                                        id="content"
                                        value={posterContent}
                                        onChange={(e) => setPosterContent(e.target.value)}
                                        placeholder="e.g., HackXplore 2024&#10;Crack the Code&#10;Feb 14-15&#10;Contact: info@hackxplore.com"
                                        rows={4}
                                        required
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        Enter all text that should appear on the poster (event name, date, contact, etc.)
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="intent">Layout & Style Intent *</Label>
                                    <Input
                                        id="intent"
                                        value={layoutIntent}
                                        onChange={(e) => setLayoutIntent(e.target.value)}
                                        placeholder="e.g., Cybertech hacker vibe, bold title at top, details at bottom"
                                        required
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        Describe how you want the text arranged and styled
                                    </p>
                                </div>

                                {error && (
                                    <Alert variant="destructive">
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="flex gap-4 justify-center">
                                    <Button variant="outline" onClick={() => setStep(1)}>
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleDesignOverlay}
                                        size="lg"
                                        disabled={!posterContent.trim() || !layoutIntent.trim()}
                                    >
                                        <Wand2 className="mr-2 h-5 w-5" />
                                        Design Poster
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    )
}
