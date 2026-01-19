"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, FileText, CheckCircle, AlertCircle, Download, RefreshCw } from "lucide-react"

export default function ReportGeneratorPage() {
    const [eventDetails, setEventDetails] = useState({
        event_name: "",
        event_type: "",
        institution_name: "",
    })

    const [uploadStatus, setUploadStatus] = useState<Record<string, "idle" | "uploading" | "success" | "error">>({
        "attendees.csv": "idle",
        "feedback.csv": "idle",
        "crowd_analytics.json": "idle",
        "social_mentions.json": "idle",
        "custom_template.txt": "idle",
    })

    const [generating, setGenerating] = useState(false)
    const [reportResult, setReportResult] = useState<{ content: string; report_filename: string } | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEventDetails({ ...eventDetails, [e.target.id]: e.target.value })
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fileName: string) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadStatus((prev) => ({ ...prev, [fileName]: "uploading" }))
        setError(null)

        const formData = new FormData()
        formData.append("file", file)

        try {
            const response = await fetch(`http://127.0.0.1:8000/upload/${fileName}`, {
                method: "POST",
                body: formData,
            })

            if (response.ok) {
                setUploadStatus((prev) => ({ ...prev, [fileName]: "success" }))
            } else {
                setUploadStatus((prev) => ({ ...prev, [fileName]: "error" }))
                setError(`Failed to upload ${fileName}`)
            }
        } catch (err) {
            setUploadStatus((prev) => ({ ...prev, [fileName]: "error" }))
            setError("Could not connect to the server.")
        }
    }

    const handleGenerate = async () => {
        if (!eventDetails.event_name || !eventDetails.event_type || !eventDetails.institution_name) {
            setError("Please fill in all event details.")
            return
        }

        setGenerating(true)
        setError(null)

        try {
            const response = await fetch("http://127.0.0.1:8000/generate-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(eventDetails),
            })

            const result = await response.json()

            if (response.ok) {
                setReportResult({ content: result.content, report_filename: result.report_filename })
            } else {
                setError(result.detail || "Failed to generate report.")
            }
        } catch (err) {
            setError("An error occurred during report generation.")
        } finally {
            setGenerating(false)
        }
    }

    // Simple Markdown renderer to match existing functionality
    const renderMarkdown = (markdown: string) => {
        const html = markdown
            .replace(/^# (.*)/gm, '<h1 class="text-3xl font-bold mt-6 mb-4 border-b pb-2">$1</h1>')
            .replace(/^## (.*)/gm, '<h2 class="text-2xl font-semibold mt-5 mb-3">$1</h2>')
            .replace(/^### (.*)/gm, '<h3 class="text-xl font-semibold mt-4 mb-2">$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^- (.*)/gm, '<li class="ml-4 list-disc">$1</li>')
            .replace(/\n\n/g, '<br/>')
            .replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
                // Fix image paths to point to backend
                const fullSrc = src.startsWith('http') ? src : `http://127.0.0.1:8000/static/output/${src.split('/').pop()}`;
                return `<img src="${fullSrc}" alt="${alt}" class="my-4 rounded-lg shadow-md max-w-full" />`;
            })

        return { __html: html }
    }

    const triggerDownload = (filename: string, content: string) => {
        const element = document.createElement("a");
        const file = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(file);
        element.href = url;
        element.download = filename;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        URL.revokeObjectURL(url); // Clean up
    }

    if (reportResult) {
        return (
            <div className="container mx-auto py-8 max-w-4xl">
                <div className="flex flex-col space-y-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold">Report Ready</h1>
                        <Button variant="outline" onClick={() => window.location.reload()}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Generate New
                        </Button>
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Generated Report: {reportResult.report_filename}</CardTitle>
                                <div className="flex space-x-2">
                                    <Button variant="outline" onClick={() => triggerDownload(reportResult.report_filename, reportResult.content)}>
                                        <Download className="mr-2 h-4 w-4" /> Download .md
                                    </Button>
                                    <Button onClick={() => window.open(`http://127.0.0.1:8000/download-report/docx?filename=${reportResult.report_filename}`, '_blank')}>
                                        <FileText className="mr-2 h-4 w-4" /> Download .docx
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div
                                className="prose dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={renderMarkdown(reportResult.content)}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-8 max-w-4xl">
            <div className="flex flex-col space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold">AI Event Report Generator</h1>
                    <p className="text-muted-foreground mt-2">Generate comprehensive analytics and insights for your events.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Step 1: Event Details</CardTitle>
                        <CardDescription>Enter the basic information about your event.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="event_name">Event Name</Label>
                                <Input id="event_name" placeholder="e.g. TechFest 2025" value={eventDetails.event_name} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="event_type">Event Type</Label>
                                <Input id="event_type" placeholder="e.g. Workshop Series" value={eventDetails.event_type} onChange={handleInputChange} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="institution_name">Institution / Department</Label>
                            <Input id="institution_name" placeholder="e.g. Computer Science Dept" value={eventDetails.institution_name} onChange={handleInputChange} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Step 2: Upload Data</CardTitle>
                        <CardDescription>Upload the CSV and JSON files containing your event data.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                { id: "attendees.csv", label: "Participant Data (Required)", type: ".csv", required: true },
                                { id: "feedback.csv", label: "Feedback Data (Required)", type: ".csv", required: true },
                                { id: "crowd_analytics.json", label: "Crowd Analytics (Optional)", type: ".json", required: false },
                                { id: "social_mentions.json", label: "Social Media (Optional)", type: ".json", required: false },
                                { id: "custom_template.txt", label: "Custom Report Template (Optional)", type: ".txt", required: false },
                            ].map((file) => (
                                <div key={file.id} className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${uploadStatus[file.id] === 'success' ? 'border-green-500 bg-green-50/10' :
                                    uploadStatus[file.id] === 'error' ? 'border-red-500 bg-red-50/10' : 'border-gray-200 hover:border-gray-400'
                                    }`}>
                                    <div className="flex flex-col items-center gap-2">
                                        {uploadStatus[file.id] === 'uploading' ? (
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        ) : uploadStatus[file.id] === 'success' ? (
                                            <CheckCircle className="h-8 w-8 text-green-500" />
                                        ) : (
                                            <Upload className="h-8 w-8 text-muted-foreground" />
                                        )}
                                        <h3 className="font-medium">{file.label}</h3>
                                        <p className="text-xs text-muted-foreground">{file.id}</p>
                                        <Input
                                            type="file"
                                            accept={file.type}
                                            className="hidden"
                                            id={`file-${file.id}`}
                                            onChange={(e) => handleFileUpload(e, file.id)}
                                        />
                                        <Button
                                            variant={uploadStatus[file.id] === 'success' ? "outline" : "secondary"}
                                            size="sm"
                                            onClick={() => document.getElementById(`file-${file.id}`)?.click()}
                                            className="mt-2"
                                        >
                                            {uploadStatus[file.id] === 'success' ? "Re-upload" : "Select File"}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {error && (
                    <div className="flex items-center p-4 text-red-800 border border-red-300 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:border-red-800" role="alert">
                        <AlertCircle className="flex-shrink-0 w-4 h-4" />
                        <div className="ml-3 text-sm font-medium">
                            {error}
                        </div>
                    </div>
                )}

                <div className="flex justify-center">
                    <Button
                        size="lg"
                        onClick={handleGenerate}
                        disabled={generating || uploadStatus['attendees.csv'] !== 'success' || uploadStatus['feedback.csv'] !== 'success'}
                        className="w-full max-w-sm text-lg py-6"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating Report...
                            </>
                        ) : (
                            <>
                                <FileText className="mr-2 h-5 w-5" /> Generate Complete Report
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
