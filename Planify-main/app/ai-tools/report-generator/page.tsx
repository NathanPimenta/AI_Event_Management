"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { FileText, Upload, Loader2, CheckCircle, Download, ChevronDown, Wand2, FileCode } from "lucide-react"

export default function ReportGeneratorPage() {
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{ content: string; filename: string } | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Step 1: Event Details
    const [eventName, setEventName] = useState("")
    const [eventType, setEventType] = useState("")
    const [institutionName, setInstitutionName] = useState("")

    // File states
    const [attendeesFileName, setAttendeesFileName] = useState("")
    const [feedbackFileName, setFeedbackFileName] = useState("")
    const [crowdFileName, setCrowdFileName] = useState("")
    const [socialFileName, setSocialFileName] = useState("")
    const [posterFileName, setPosterFileName] = useState("")
    const [snapshotFileName, setSnapshotFileName] = useState("")
    const [templateFileName, setTemplateFileName] = useState("")
    const [logoFileName, setLogoFileName] = useState("")

    // Custom template toggle
    const [useCustomTemplate, setUseCustomTemplate] = useState(false)

    // Image configuration (front-end): user can specify number of images to include beforehand
    const [includeImages, setIncludeImages] = useState(false)
    const [numImages, setNumImages] = useState<number>(0)
    const [imageFiles, setImageFiles] = useState<Array<File | null>>([])
    const [imagePurposes, setImagePurposes] = useState<Array<string>>([]) // 'auto' | 'poster' | 'snapshot' | 'logo' | 'other'

    // Backend may respond with missing template assets; capture them to prompt user for uploads
    const [missingAssets, setMissingAssets] = useState<Array<any>>([])

    // File refs
    const attendeesRef = useRef<HTMLInputElement>(null)
    const feedbackRef = useRef<HTMLInputElement>(null)
    const crowdRef = useRef<HTMLInputElement>(null)
    const socialRef = useRef<HTMLInputElement>(null)
    const posterRef = useRef<HTMLInputElement>(null)
    const snapshotRef = useRef<HTMLInputElement>(null)
    const templateRef = useRef<HTMLInputElement>(null)
    const imageRefs = useRef<Array<HTMLInputElement | null>>([])
    const logoRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        setFileName: (name: string) => void
    ) => {
        const file = e.target.files?.[0]
        setFileName(file ? file.name : "")
    }

    const isFormValid = () => {
        return (
            eventName.trim() !== "" &&
            eventType.trim() !== "" &&
            institutionName.trim() !== "" &&
            attendeesFileName !== "" &&
            feedbackFileName !== ""
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setResult(null)

        const attendeesFile = attendeesRef.current?.files?.[0]
        const feedbackFile = feedbackRef.current?.files?.[0]
        const crowdFile = crowdRef.current?.files?.[0]
        const socialFile = socialRef.current?.files?.[0]
        const templateFile = templateRef.current?.files?.[0]

        if (!attendeesFile || !feedbackFile) {
            setError("Please upload required files (Attendees CSV and Feedback CSV)")
            setLoading(false)
            return
        }

        try {
            // Upload attendees file
            const attendeesFormData = new FormData()
            attendeesFormData.append("file", attendeesFile)
            await fetch("http://127.0.0.1:8003/upload/attendees.csv", {
                method: "POST",
                body: attendeesFormData,
            })

            // Upload feedback file
            const feedbackFormData = new FormData()
            feedbackFormData.append("file", feedbackFile)
            await fetch("http://127.0.0.1:8003/upload/feedback.csv", {
                method: "POST",
                body: feedbackFormData,
            })

            // Upload optional crowd analytics file
            if (crowdFile) {
                const crowdFormData = new FormData()
                crowdFormData.append("file", crowdFile)
                await fetch("http://127.0.0.1:8003/upload/crowd_analytics.json", {
                    method: "POST",
                    body: crowdFormData,
                })
            }

            // Upload optional social mentions file
            if (socialFile) {
                const socialFormData = new FormData()
                socialFormData.append("file", socialFile)
                await fetch("http://127.0.0.1:8003/upload/social_mentions.json", {
                    method: "POST",
                    body: socialFormData,
                })
            }

            // Upload optional poster
            const posterFile = posterRef.current?.files?.[0]
            if (posterFile) {
                const posterFormData = new FormData()
                posterFormData.append("file", posterFile)
                await fetch(`http://127.0.0.1:8003/upload/poster.png`, {
                    method: "POST",
                    body: posterFormData,
                })
            }

            // Upload optional snapshot
            const snapshotFile = snapshotRef.current?.files?.[0]
            if (snapshotFile) {
                const snapshotFormData = new FormData()
                snapshotFormData.append("file", snapshotFile)
                await fetch(`http://127.0.0.1:8003/upload/snapshot.png`, {
                    method: "POST",
                    body: snapshotFormData,
                })
            }

            // Upload optional Overleaf template
            if (useCustomTemplate && templateFile) {
                const templateFormData = new FormData()
                templateFormData.append("file", templateFile)
                // Determine literal filename for upload based on extension
                const endpoint = templateFile.name.endsWith(".docx")
                    ? "http://127.0.0.1:8003/upload/custom_template.docx"
                    : "http://127.0.0.1:8003/upload/custom_template.tex"

                await fetch(endpoint, {
                    method: "POST",
                    body: templateFormData,
                })
            }

            // Upload optional logo
            const logoFile = logoRef.current?.files?.[0]
            if (logoFile) {
                const logoFd = new FormData()
                logoFd.append('file', logoFile)
                await fetch(`http://127.0.0.1:8003/upload/logo.png`, {
                    method: 'POST',
                    body: logoFd,
                })
            }

            // If the user specified images up front, upload them now (filenames like report_image_1.png)
            if (includeImages && numImages > 0) {
                for (let i = 0; i < numImages; i++) {
                    const f = imageFiles[i]
                    if (!f) continue
                    // keep original extension
                    const ext = f.name.split('.').pop() || 'png'
                    // Determine filename based on user-selected purpose
                    const purpose = imagePurposes[i] || 'auto'
                    let filename = `report_image_${i + 1}.${ext}`
                    if (purpose === 'poster') filename = `poster.${ext}`
                    if (purpose === 'snapshot') filename = `snapshot.${ext}`
                    if (purpose === 'logo') filename = `logo.${ext}`
                }
            }


            // Generate report
            const response = await fetch("http://127.0.0.1:8003/generate-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    event_name: eventName,
                    event_type: eventType,
                    institution_name: institutionName,
                    use_custom_template: useCustomTemplate && !!templateFile,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()

                // New behavior: if backend returns structured missing_assets info, surface upload UI
                if (errorData && errorData.detail && errorData.detail.error === 'missing_template_assets') {
                    setMissingAssets(errorData.detail.missing_assets || [])
                    setLoading(false)
                    return
                }

                throw new Error(typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail) || "Failed to generate report")
            }

            const data = await response.json()
            setResult({
                content: data.content,
                filename: data.report_filename || "event_report.md",
            })
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
            setLoading(false)
        }
    }

    const downloadMarkdown = () => {
        if (!result) return
        const blob = new Blob([result.content], { type: "text/markdown" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = result.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const downloadPDF = () => {
        if (!result) return
        window.open(
            `http://127.0.0.1:8003/download-report/pdf?filename=${encodeURIComponent(result.filename)}`,
            "_blank"
        )
    }

    // Mapping for markers -> default upload filename used by the backend
    const _mapMarkerToFilename = (marker: string, idx: number) => {
        if (/logo/i.test(marker)) return `logo.png`
        if (/poster/i.test(marker)) return `poster.png`
        if (/snapshot/i.test(marker)) return `snapshot.png`
        if (/feedback/i.test(marker) || /ratings/i.test(marker)) return `ratings_chart.png`
        // fallback
        return `report_image_${idx + 1}.png`
    }

    // Store files provided by user specifically for missing assets
    const [missingAssetFiles, setMissingAssetFiles] = useState<Record<number, File | null>>({})

    const uploadMissingAssetsAndRetry = async () => {
        if (!missingAssets || missingAssets.length === 0) return
        setLoading(true)
        setError(null)

        try {
            // Upload each provided file to backend under a sensible name
            for (let i = 0; i < missingAssets.length; i++) {
                const asset = missingAssets[i]
                const file = missingAssetFiles[i]
                if (!file) {
                    throw new Error(`Missing file for asset: ${asset.marker}`)
                }
                const filename = _mapMarkerToFilename(asset.marker, i)
                const fd = new FormData()
                fd.append("file", file)
                const resp = await fetch(`http://127.0.0.1:8003/upload/${filename}`, {
                    method: "POST",
                    body: fd,
                })
                if (!resp.ok) {
                    const data = await resp.json().catch(() => ({}))
                    throw new Error(data.detail || `Failed to upload ${filename}`)
                }
            }

            // After uploading all assets, try to generate the report again
            const response = await fetch("http://127.0.0.1:8003/generate-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    event_name: eventName,
                    event_type: eventType,
                    institution_name: institutionName,
                    use_custom_template: useCustomTemplate && !!templateRef.current?.files?.[0],
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail) || "Failed to generate report")
            }

            const data = await response.json()
            setMissingAssets([])
            setResult({ content: data.content, filename: data.report_filename || "event_report.md" })
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred while uploading assets")
        } finally {
            setLoading(false)
        }
    }

    // Simple markdown to HTML converter
    const renderMarkdown = (content: string) => {
        let html = content
            .replace(/# (.*)/g, "<h1>$1</h1>")
            .replace(/## (.*)/g, "<h2>$1</h2>")
            .replace(/### (.*)/g, "<h3>$1</h3>")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/- (.*)/g, "<li>$1</li>")
            .replace(/\n/g, "<br>")
        return html
    }

    if (loading) {
        return (
            <div className="container mx-auto p-6 md:p-12">
                <Card className="max-w-4xl mx-auto">
                    <CardContent className="py-16 text-center">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                        <h2 className="text-2xl font-semibold">Generating Your Report...</h2>
                        <p className="text-muted-foreground mt-2">
                            The AI is analyzing the data. This may take a moment.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (result) {
        return (
            <div className="container mx-auto p-6 md:p-12">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-3xl font-bold">Your Report is Ready!</h2>
                        <p className="text-muted-foreground mt-2">
                            Review the AI-generated analysis for the <span className="font-bold">{eventName}</span> event.
                        </p>
                    </div>
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Generated Report</CardTitle>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={downloadMarkdown}>
                                        <FileCode className="mr-2 h-4 w-4" />
                                        Download .md
                                    </Button>
                                    <Button size="sm" onClick={downloadPDF}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Download .pdf
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div
                                className="prose dark:prose-invert max-w-none max-h-[500px] overflow-y-auto p-4 bg-muted rounded-lg"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(result.content) }}
                            />
                        </CardContent>
                    </Card>
                    <div className="text-center mt-8">
                        <Button variant="outline" onClick={() => window.location.reload()}>
                            Generate Another Report
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
                    <h1 className="text-4xl font-bold">AI Event Report Generator</h1>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Upload your event data to generate a comprehensive, AI-powered analysis.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Step 1: Configure Report */}
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm">1</span>
                                Configure Your Report
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="eventName">Event Name *</Label>
                                    <Input
                                        id="eventName"
                                        value={eventName}
                                        onChange={(e) => setEventName(e.target.value)}
                                        placeholder="e.g., TechFest 2025"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="eventType">Event Type *</Label>
                                    <Input
                                        id="eventType"
                                        value={eventType}
                                        onChange={(e) => setEventType(e.target.value)}
                                        placeholder="e.g., AI/ML Workshop Series"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="institutionName">Institution / Department *</Label>
                                <Input
                                    id="institutionName"
                                    value={institutionName}
                                    onChange={(e) => setInstitutionName(e.target.value)}
                                    placeholder="e.g., Department of Computer Science"
                                    required
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Step 2: Upload Data */}
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm">2</span>
                                Upload Your Data
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                {/* Attendees CSV (Required) */}
                                <div className="space-y-2">
                                    <Label>
                                        Participant Data <span className="text-red-500">*</span>
                                    </Label>
                                    <p className="text-xs text-muted-foreground">attendees.csv (Required)</p>
                                    <div
                                        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors ${attendeesFileName ? "border-green-500" : "border-muted"
                                            }`}
                                        onClick={() => attendeesRef.current?.click()}
                                    >
                                        <input
                                            type="file"
                                            ref={attendeesRef}
                                            className="hidden"
                                            accept=".csv"
                                            onChange={(e) => handleFileChange(e, setAttendeesFileName)}
                                        />
                                        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                                        <span className="text-sm">
                                            {attendeesFileName || "Click to upload"}
                                        </span>
                                    </div>
                                </div>

                                {/* Feedback CSV (Required) */}
                                <div className="space-y-2">
                                    <Label>
                                        Feedback Data <span className="text-red-500">*</span>
                                    </Label>
                                    <p className="text-xs text-muted-foreground">feedback.csv (Required)</p>
                                    <div
                                        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors ${feedbackFileName ? "border-green-500" : "border-muted"
                                            }`}
                                        onClick={() => feedbackRef.current?.click()}
                                    >
                                        <input
                                            type="file"
                                            ref={feedbackRef}
                                            className="hidden"
                                            accept=".csv"
                                            onChange={(e) => handleFileChange(e, setFeedbackFileName)}
                                        />
                                        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                                        <span className="text-sm">
                                            {feedbackFileName || "Click to upload"}
                                        </span>
                                    </div>
                                </div>

                                {/* Crowd Analytics JSON (Optional) */}
                                <div className="space-y-2">
                                    <Label>Crowd Analytics</Label>
                                    <p className="text-xs text-yellow-500">crowd_analytics.json (Optional)</p>
                                    <div
                                        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors ${crowdFileName ? "border-green-500" : "border-muted"
                                            }`}
                                        onClick={() => crowdRef.current?.click()}
                                    >
                                        <input
                                            type="file"
                                            ref={crowdRef}
                                            className="hidden"
                                            accept=".json"
                                            onChange={(e) => handleFileChange(e, setCrowdFileName)}
                                        />
                                        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                                        <span className="text-sm">
                                            {crowdFileName || "Click to upload"}
                                        </span>
                                    </div>
                                </div>

                                {/* Social Mentions JSON (Optional) */}
                                <div className="space-y-2">
                                    <Label>Social Media Mentions</Label>
                                    <p className="text-xs text-yellow-500">social_mentions.json (Optional)</p>
                                    <div
                                        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors ${socialFileName ? "border-green-500" : "border-muted"
                                            }`}
                                        onClick={() => socialRef.current?.click()}
                                    >
                                        <input
                                            type="file"
                                            ref={socialRef}
                                            className="hidden"
                                            accept=".json"
                                            onChange={(e) => handleFileChange(e, setSocialFileName)}
                                        />
                                        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                                        <span className="text-sm">
                                            {socialFileName || "Click to upload"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 mt-4">
                                {/* Event Poster (Optional) */}
                                <div className="space-y-2">
                                    <Label>Event Poster</Label>
                                    <p className="text-xs text-yellow-500">poster.png/jpg (Optional)</p>
                                    <div
                                        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors ${posterFileName ? "border-green-500" : "border-muted"
                                            }`}
                                        onClick={() => posterRef.current?.click()}
                                    >
                                        <input
                                            type="file"
                                            ref={posterRef}
                                            className="hidden"
                                            accept=".png,.jpg,.jpeg"
                                            onChange={(e) => handleFileChange(e, setPosterFileName)}
                                        />
                                        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                                        <span className="text-sm">
                                            {posterFileName || "Click to upload"}
                                        </span>
                                    </div>
                                </div>

                                {/* Event Snapshot (Optional) */}
                                <div className="space-y-2">
                                    <Label>Event Snapshot</Label>
                                    <p className="text-xs text-yellow-500">snapshot.png/jpg (Optional)</p>
                                    <div
                                        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors ${snapshotFileName ? "border-green-500" : "border-muted"
                                            }`}
                                        onClick={() => snapshotRef.current?.click()}
                                    >
                                        <input
                                            type="file"
                                            ref={snapshotRef}
                                            className="hidden"
                                            accept=".png,.jpg,.jpeg"
                                            onChange={(e) => handleFileChange(e, setSnapshotFileName)}
                                        />
                                        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                                        <span className="text-sm">
                                            {snapshotFileName || "Click to upload"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Custom Overleaf Template (Optional) */}
                            <Collapsible open={useCustomTemplate} onOpenChange={setUseCustomTemplate}>
                                <CollapsibleTrigger asChild>
                                    <Button variant="outline" type="button" className="w-full justify-between">
                                        <span className="flex items-center gap-2">
                                            <FileCode className="h-4 w-4" />
                                            Custom Template (Optional)
                                        </span>
                                        <ChevronDown className={`h-4 w-4 transition-transform ${useCustomTemplate ? "rotate-180" : ""}`} />
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-4">
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">
                                            Upload a custom Overleaf/LaTeX template (.tex) or Word Document (.docx) to customize the report format.
                                            The template should include placeholders (e.g., {"{{event_name}}"}) that will be filled by the AI.
                                        </p>
                                        <div
                                            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors ${templateFileName ? "border-green-500" : "border-muted"
                                                }`}
                                            onClick={() => templateRef.current?.click()}
                                        >
                                            <input
                                                type="file"
                                                ref={templateRef}
                                                className="hidden"
                                                accept=".tex,.docx"
                                                onChange={(e) => handleFileChange(e, setTemplateFileName)}
                                            />
                                            <FileCode className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                                            <span className="text-sm">
                                                {templateFileName || "Click to upload .tex or .docx template"}
                                            </span>
                                        </div>

                                        {/* Optional: Logo upload */}
                                        <div className="mt-4">
                                            <Label>Logo (Optional)</Label>
                                            <p className="text-xs text-muted-foreground">Upload an organization/logo image to be inserted where the template has a logo placeholder.</p>
                                            <div
                                                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors ${logoFileName ? "border-green-500" : "border-muted"
                                                    }`}
                                                onClick={() => logoRef.current?.click()}
                                            >
                                                <input
                                                    type="file"
                                                    ref={logoRef}
                                                    className="hidden"
                                                    accept=".png,.jpg,.jpeg,.gif"
                                                    onChange={(e) => handleFileChange(e, setLogoFileName)}
                                                />
                                                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                                                <span className="text-sm">{logoFileName || "Click to upload a logo (optional)"}</span>
                                            </div>
                                        </div>

                                        {/* Optional: ask user if they'd like to include images and how many up front */}
                                        <div className="mt-4">
                                            <Label>Include images in report?</Label>
                                            <div className="flex items-center gap-4 mt-2">
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="includeImages"
                                                        checked={!includeImages}
                                                        onChange={() => setIncludeImages(false)}
                                                    />
                                                    No
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="includeImages"
                                                        checked={includeImages}
                                                        onChange={() => setIncludeImages(true)}
                                                    />
                                                    Yes
                                                </label>
                                            </div>

                                            {includeImages && (
                                                <div className="mt-3 space-y-2">
                                                    <Label>How many images would you like to include?</Label>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        value={numImages}
                                                        onChange={(e) => {
                                                            const v = parseInt(e.target.value || "0", 10)
                                                            setNumImages(v)
                                                            setImageFiles(Array.from({ length: Math.max(0, v) }, (_, i) => imageFiles[i] || null))
                                                            setImagePurposes(Array.from({ length: Math.max(0, v) }, (_, i) => imagePurposes[i] || 'auto'))
                                                        }}
                                                    />

                                                    {Array.from({ length: numImages }).map((_, i) => (
                                                        <div key={i} className="mt-2">
                                                            <Label>Image #{i + 1}</Label>
                                                            <div className="flex gap-2 items-center">
                                                                <input
                                                                    type="file"
                                                                    accept=".png,.jpg,.jpeg,.gif"
                                                                    className="block"
                                                                    onChange={(e) => {
                                                                        const f = e.target.files?.[0] || null
                                                                        setImageFiles((prev) => {
                                                                            const copy = prev.slice()
                                                                            copy[i] = f
                                                                            return copy
                                                                        })
                                                                    }}
                                                                />

                                                                <select
                                                                    value={imagePurposes[i] || 'auto'}
                                                                    onChange={(e) => {
                                                                        const v = e.target.value
                                                                        setImagePurposes((prev) => {
                                                                            const copy = prev.slice()
                                                                            copy[i] = v
                                                                            return copy
                                                                        })
                                                                    }}
                                                                    className="border rounded px-2 py-1 text-sm"
                                                                >
                                                                    <option value="auto">Auto</option>
                                                                    <option value="poster">Poster</option>
                                                                    <option value="snapshot">Snapshot</option>
                                                                    <option value="logo">Logo</option>
                                                                    <option value="other">Other</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        </CardContent>
                    </Card>

                    {/* Error Message */}
                    {error && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* If server indicates missing template assets, prompt for uploads */}
                    {missingAssets && missingAssets.length > 0 && (
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle>Template requires images</CardTitle>
                                <CardDescription>
                                    The uploaded template requires image files for the following markers. Please upload images for each marker and click "Upload & Retry".
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {missingAssets.map((asset: any, idx: number) => (
                                    <div key={idx} className="mb-4">
                                        <Label className="font-semibold">{asset.marker}</Label>
                                        {asset.directives && Object.keys(asset.directives).length > 0 && (
                                            <p className="text-xs text-muted-foreground">Suggested: {Object.entries(asset.directives).map(([k, v]) => `${k}=${v}`).join('; ')}</p>
                                        )}
                                        <input
                                            type="file"
                                            accept=".png,.jpg,.jpeg,.gif"
                                            className="mt-2"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0] || null
                                                setMissingAssetFiles((prev) => ({ ...prev, [idx]: f }))
                                            }}
                                        />
                                    </div>
                                ))}
                                <div className="flex gap-2">
                                    <Button onClick={uploadMissingAssetsAndRetry}>
                                        Upload & Retry
                                    </Button>
                                    <Button variant="outline" onClick={() => setMissingAssets([])}>
                                        Cancel
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Submit Button */}
                    <div className="text-center">
                        <Button
                            type="submit"
                            size="lg"
                            className="px-12"
                            disabled={!isFormValid()}
                        >
                            <Wand2 className="mr-2 h-5 w-5" />
                            Generate Report
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
