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
    const [result, setResult] = useState<{ content: string; filename: string; pdf_url?: string } | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Step 1: Event Details
    const [eventName, setEventName] = useState("")
    const [eventType, setEventType] = useState("")
    const [institutionName, setInstitutionName] = useState("")

    const [eventDate, setEventDate] = useState("")
    const [eventTime, setEventTime] = useState("")
    const [eventVenue, setEventVenue] = useState("")
    const [targetAudience, setTargetAudience] = useState("")
    const [dbitStudentsCount, setDbitStudentsCount] = useState("")
    const [nonDbitStudentsCount, setNonDbitStudentsCount] = useState("")
    const [resourcePersonName, setResourcePersonName] = useState("")
    const [resourcePersonOrg, setResourcePersonOrg] = useState("")
    const [organizingBody, setOrganizingBody] = useState("")
    const [facultyCoordinator, setFacultyCoordinator] = useState("")
    const [facebookLink, setFacebookLink] = useState("")
    const [instagramLink, setInstagramLink] = useState("")
    const [linkedinLink, setLinkedinLink] = useState("")
    const [approver1Name, setApprover1Name] = useState("")
    const [approver1Post, setApprover1Post] = useState("")
    const [approver2Name, setApprover2Name] = useState("")
    const [approver2Post, setApprover2Post] = useState("")
    const [preparer1Name, setPreparer1Name] = useState("")
    const [preparer1Post, setPreparer1Post] = useState("")
    const [preparer2Name, setPreparer2Name] = useState("")
    const [preparer2Post, setPreparer2Post] = useState("")
    const [objective1, setObjective1] = useState("")
    const [objective2, setObjective2] = useState("")
    const [objective3, setObjective3] = useState("")
    const [outcome1, setOutcome1] = useState("")
    const [outcome2, setOutcome2] = useState("")
    const [outcome3, setOutcome3] = useState("")
    const [detailedDescription, setDetailedDescription] = useState("")

    // File states
    const [attendeesFileName, setAttendeesFileName] = useState("")
    const [feedbackFileName, setFeedbackFileName] = useState("")
    const [crowdFileName, setCrowdFileName] = useState("")
    const [socialFileName, setSocialFileName] = useState("")
    const [posterFileName, setPosterFileName] = useState("")
    const [snapshotFileName, setSnapshotFileName] = useState("")
    const [logoFileName, setLogoFileName] = useState("")


    // Image configuration (front-end): user can specify number of images to include beforehand
    const [includeImages, setIncludeImages] = useState(false)
    const [numImages, setNumImages] = useState<number>(0)
    const [imageFiles, setImageFiles] = useState<Array<File | null>>([])
    const [imagePurposes, setImagePurposes] = useState<Array<string>>([]) // 'auto' | 'poster' | 'snapshot' | 'logo' | 'other'

    // File refs
    const attendeesRef = useRef<HTMLInputElement>(null)
    const feedbackRef = useRef<HTMLInputElement>(null)
    const crowdRef = useRef<HTMLInputElement>(null)
    const socialRef = useRef<HTMLInputElement>(null)
    const posterRef = useRef<HTMLInputElement>(null)
    const snapshotRef = useRef<HTMLInputElement>(null)
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

        if (!attendeesFile || !feedbackFile) {
            setError("Please upload required files (Attendees CSV and Feedback CSV)")
            setLoading(false)
            return
        }

        try {
            // Upload attendees file
            const attendeesFormData = new FormData()
            attendeesFormData.append("file", attendeesFile)
            await fetch("http://127.0.0.1:8004/upload/attendees.csv", {
                method: "POST",
                body: attendeesFormData,
            })

            // Upload feedback file
            const feedbackFormData = new FormData()
            feedbackFormData.append("file", feedbackFile)
            await fetch("http://127.0.0.1:8004/upload/feedback.csv", {
                method: "POST",
                body: feedbackFormData,
            })

            // Upload optional crowd analytics file
            if (crowdFile) {
                const crowdFormData = new FormData()
                crowdFormData.append("file", crowdFile)
                await fetch("http://127.0.0.1:8004/upload/crowd_analytics.json", {
                    method: "POST",
                    body: crowdFormData,
                })
            }

            // Upload optional social mentions file
            if (socialFile) {
                const socialFormData = new FormData()
                socialFormData.append("file", socialFile)
                await fetch("http://127.0.0.1:8004/upload/social_mentions.json", {
                    method: "POST",
                    body: socialFormData,
                })
            }

            // Upload optional poster
            const posterFile = posterRef.current?.files?.[0]
            if (posterFile) {
                const posterFormData = new FormData()
                posterFormData.append("file", posterFile)
                await fetch(`http://127.0.0.1:8004/upload/poster.png`, {
                    method: "POST",
                    body: posterFormData,
                })
            }

            // Upload optional snapshot
            const snapshotFile = snapshotRef.current?.files?.[0]
            if (snapshotFile) {
                const snapshotFormData = new FormData()
                snapshotFormData.append("file", snapshotFile)
                await fetch(`http://127.0.0.1:8004/upload/snapshot.png`, {
                    method: "POST",
                    body: snapshotFormData,
                })
            }



            // Upload optional logo
            const logoFile = logoRef.current?.files?.[0]
            if (logoFile) {
                const logoFd = new FormData()
                logoFd.append('file', logoFile)
                await fetch(`http://127.0.0.1:8004/upload/logo.png`, {
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


            // Format date to human-readable string (e.g. "24th Oct 2024")
            const formatDate = (dateStr: string) => {
                if (!dateStr) return ""
                const d = new Date(dateStr + "T00:00:00")
                const day = d.getDate()
                const suffix = ["th", "st", "nd", "rd"][(day % 100 > 10 && day % 100 < 14) ? 0 : (day % 10 < 4 ? day % 10 : 0)]
                const month = d.toLocaleString("en-US", { month: "short" })
                const year = d.getFullYear()
                return `${day}${suffix} ${month} ${year}`
            }

            // Format time to 12-hour format (e.g. "10:00 AM")
            const formatTime = (timeStr: string) => {
                if (!timeStr) return ""
                const [h, m] = timeStr.split(":")
                const hour = parseInt(h)
                const ampm = hour >= 12 ? "PM" : "AM"
                const h12 = hour % 12 || 12
                return `${h12}:${m} ${ampm}`
            }

            // Generate report
            // Hierarchical payload required by the generator
            const getList = (...items: string[]) => items.map(l => l.trim()).filter(l => l);

            const payload = {
                event_meta: {
                    department_name: institutionName,
                    event_type: eventType,
                    title: eventName,
                    date: formatDate(eventDate),
                    time: formatTime(eventTime),
                    venue: eventVenue
                },
                participants: {
                    target_audience: targetAudience,
                    total_participants: parseInt(dbitStudentsCount || "0") + parseInt(nonDbitStudentsCount || "0"),
                    girl_participants: 0,
                    boy_participants: 0
                },
                organizers: {
                    resource_person: resourcePersonName,
                    resource_org: resourcePersonOrg,
                    organizing_body: organizingBody,
                    faculty_coordinator: facultyCoordinator
                },
                content: {
                    objectives: getList(objective1, objective2, objective3),
                    outcomes: getList(outcome1, outcome2, outcome3),
                    detailed_report: detailedDescription,
                    snapshot_description: ""
                },
                feedback: {
                    feedback_text: ""
                },
                social_media: {
                    facebook: facebookLink,
                    instagram: instagramLink,
                    linkedin: linkedinLink
                },
                registration: {
                    dbit_students: parseInt(dbitStudentsCount || "0"),
                    non_dbit_students: parseInt(nonDbitStudentsCount || "0")
                },
                signatories: {
                    prepared_name: preparer1Name || preparer2Name,
                    prepared_post: preparer1Post || preparer2Post,
                    approved_name: approver1Name || approver2Name,
                    approved_post: approver1Post || approver2Post
                }
            };
            const response = await fetch("http://127.0.0.1:8004/generate-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail) || "Failed to generate report")
            }

            const data = await response.json()
            setResult({
                content: data.content || "PDF Generated successfully",
                filename: data.report_filename || "event_report.pdf",
                pdf_url: data.pdf_url
            })
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
            setLoading(false)
        }
    }

    const downloadText = () => {
        if (!result) return
        const blob = new Blob([result.content], { type: "text/plain" })
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
        if ((result as any).pdf_url) {
            window.open(`http://127.0.0.1:8004${(result as any).pdf_url}`, "_blank")
        } else {
            window.open(
                `http://127.0.0.1:8004/download-report/pdf?filename=${encodeURIComponent(result.filename)}`,
                "_blank"
            )
        }
    }

    // Render the strict plain-text report as clean HTML
    const renderReport = (content: string) => {
        // Escape HTML entities
        let escaped = content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")

        // Style section dividers
        escaped = escaped.replace(/^-{4,}$/gm, '<hr style="border: none; border-top: 2px solid #6366f1; margin: 1.5em 0;" />')

        // Style [USER_UPLOAD_REQUIRED: ...] as badges
        escaped = escaped.replace(
            /\[USER_UPLOAD_REQUIRED:\s*([^\]]+)\]/g,
            '<span style="display:inline-block;background:#f0f0f0;border:2px dashed #aaa;border-radius:8px;padding:12px 20px;color:#888;font-style:italic;margin:8px 0;">📷 Image placeholder: $1</span>'
        )

        // Style the header (DON BOSCO line)
        escaped = escaped.replace(
            /^(\s*DON BOSCO INSTITUTE OF TECHNOLOGY.*)$/gm,
            '<div style="text-align:center;font-weight:bold;font-size:1.2em;color:#1e293b;">$1</div>'
        )
        escaped = escaped.replace(
            /^(\s*Premier Automobiles.*)$/gm,
            '<div style="text-align:center;font-size:0.9em;color:#64748b;">$1</div>'
        )

        // Style section headings (lines ending with ':')
        escaped = escaped.replace(
            /^(Objectives:|Outcomes:|Detailed Report:|Snapshot of the Event:|Feedback Analysis:|Event Poster:|Social Media Links:|Registration Details:|List of Students Who Attended the Event:|Report Approved By:|Report Prepared By:)$/gm,
            '<strong style="font-size:1.1em;color:#1e293b;">$1</strong>'
        )

        // Style table rows
        escaped = escaped.replace(
            /^\|(.+)\|$/gm,
            (match) => {
                const cells = match.split('|').filter(c => c.trim() !== '')
                const row = cells.map(c => `<td style="border:1px solid #e2e8f0;padding:6px 12px;">${c.trim()}</td>`).join('')
                return `<tr>${row}</tr>`
            }
        )
        // Wrap consecutive <tr> rows in a table
        escaped = escaped.replace(
            /(<tr>[\s\S]*?<\/tr>\n?)+/g,
            (match) => `<table style="border-collapse:collapse;width:100%;margin:8px 0;">${match}</table>`
        )

        // Convert remaining newlines to <br>
        escaped = escaped.replace(/\n/g, '<br>')

        return escaped
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
                                    <Button variant="outline" size="sm" onClick={downloadText}>
                                        <FileCode className="mr-2 h-4 w-4" />
                                        Download .txt
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
                                className="max-w-none max-h-[600px] overflow-y-auto p-6 bg-white dark:bg-zinc-900 rounded-lg border font-mono text-sm leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: renderReport(result.content) }}
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

                            <div className="grid gap-4 md:grid-cols-3 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="eventDate">Event Date</Label>
                                    <Input id="eventDate" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="eventTime">Event Time</Label>
                                    <Input id="eventTime" type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="eventVenue">Event Venue</Label>
                                    <Input id="eventVenue" value={eventVenue} onChange={(e) => setEventVenue(e.target.value)} placeholder="e.g. Main Auditorium" />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="targetAudience">Target Audience</Label>
                                    <Input id="targetAudience" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="e.g. TE IT & Comps" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="organizingBody">Organizing Body</Label>
                                    <Input id="organizingBody" value={organizingBody} onChange={(e) => setOrganizingBody(e.target.value)} placeholder="e.g. ACM Student Chapter" />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="dbitStudentsCount">DBIT Students Count</Label>
                                    <Input id="dbitStudentsCount" value={dbitStudentsCount} onChange={(e) => setDbitStudentsCount(e.target.value)} placeholder="e.g. 50" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="nonDbitStudentsCount">Non-DBIT Students Count</Label>
                                    <Input id="nonDbitStudentsCount" value={nonDbitStudentsCount} onChange={(e) => setNonDbitStudentsCount(e.target.value)} placeholder="e.g. 10" />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="resourcePersonName">Resource Person Name</Label>
                                    <Input id="resourcePersonName" value={resourcePersonName} onChange={(e) => setResourcePersonName(e.target.value)} placeholder="e.g. Mr. John Doe" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="resourcePersonOrg">Resource Person Org</Label>
                                    <Input id="resourcePersonOrg" value={resourcePersonOrg} onChange={(e) => setResourcePersonOrg(e.target.value)} placeholder="e.g. Google" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="facultyCoordinator">Faculty Coordinator</Label>
                                    <Input id="facultyCoordinator" value={facultyCoordinator} onChange={(e) => setFacultyCoordinator(e.target.value)} placeholder="e.g. Prof. Smith" />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="objective1">Objective 1</Label>
                                    <Input id="objective1" value={objective1} onChange={(e) => setObjective1(e.target.value)} placeholder="" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="objective2">Objective 2</Label>
                                    <Input id="objective2" value={objective2} onChange={(e) => setObjective2(e.target.value)} placeholder="" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="objective3">Objective 3</Label>
                                    <Input id="objective3" value={objective3} onChange={(e) => setObjective3(e.target.value)} placeholder="" />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="outcome1">Outcome 1</Label>
                                    <Input id="outcome1" value={outcome1} onChange={(e) => setOutcome1(e.target.value)} placeholder="" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="outcome2">Outcome 2</Label>
                                    <Input id="outcome2" value={outcome2} onChange={(e) => setOutcome2(e.target.value)} placeholder="" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="outcome3">Outcome 3</Label>
                                    <Input id="outcome3" value={outcome3} onChange={(e) => setOutcome3(e.target.value)} placeholder="" />
                                </div>
                            </div>

                            <div className="space-y-2 mt-4">
                                <Label htmlFor="detailedDescription">Detailed Description Pointers</Label>
                                <Input id="detailedDescription" value={detailedDescription} onChange={(e) => setDetailedDescription(e.target.value)} placeholder="Provide pointers. The AI will write the paragraph." />
                            </div>

                            <div className="grid gap-4 md:grid-cols-3 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="facebookLink">Facebook Link</Label>
                                    <Input id="facebookLink" value={facebookLink} onChange={(e) => setFacebookLink(e.target.value)} placeholder="Link or N/A" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="instagramLink">Instagram Link</Label>
                                    <Input id="instagramLink" value={instagramLink} onChange={(e) => setInstagramLink(e.target.value)} placeholder="Link or N/A" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="linkedinLink">LinkedIn Link</Label>
                                    <Input id="linkedinLink" value={linkedinLink} onChange={(e) => setLinkedinLink(e.target.value)} placeholder="Link or N/A" />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 mt-4">
                                <div className="space-y-2">
                                    <Label>Approver 1 Detail</Label>
                                    <Input className="mb-2" value={approver1Name} onChange={(e) => setApprover1Name(e.target.value)} placeholder="Name (e.g. Dr. Phadke)" />
                                    <Input value={approver1Post} onChange={(e) => setApprover1Post(e.target.value)} placeholder="Post (e.g. Principal)" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Approver 2 Detail</Label>
                                    <Input className="mb-2" value={approver2Name} onChange={(e) => setApprover2Name(e.target.value)} placeholder="Name" />
                                    <Input value={approver2Post} onChange={(e) => setApprover2Post(e.target.value)} placeholder="Post" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Preparer 1 Detail</Label>
                                    <Input className="mb-2" value={preparer1Name} onChange={(e) => setPreparer1Name(e.target.value)} placeholder="Name" />
                                    <Input value={preparer1Post} onChange={(e) => setPreparer1Post(e.target.value)} placeholder="Post" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Preparer 2 Detail</Label>
                                    <Input className="mb-2" value={preparer2Name} onChange={(e) => setPreparer2Name(e.target.value)} placeholder="Name" />
                                    <Input value={preparer2Post} onChange={(e) => setPreparer2Post(e.target.value)} placeholder="Post" />
                                </div>
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

                            {/* Additional Images Options */}



                            <div>
                                <div className="space-y-2">


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
                            </div>
                        </CardContent>
                    </Card>

                    {/* Error Message */}
                    {error && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
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
