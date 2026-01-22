"use client"

import { useState } from "react"
import { Upload, Calendar, Building2, User, FileText, Wand2, Paintbrush, Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/components/ui/use-toast"
import { Separator } from "@/components/ui/separator"

export default function CertificateGeneratorPage() {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [generatedFiles, setGeneratedFiles] = useState<string[]>([])

    const [formData, setFormData] = useState({
        eventName: "",
        eventDate: "",
        institutionName: "",
        signatureName: "",
        style: "modern",
        aiThemePrompt: "",
    })

    const [files, setFiles] = useState({
        logo: null as File | null,
        signature: null as File | null,
        participants: null as File | null,
        customTemplate: null as File | null,
    })

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target
        setFormData((prev) => ({ ...prev, [id]: value }))
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: keyof typeof files) => {
        if (e.target.files && e.target.files[0]) {
            setFiles((prev) => ({ ...prev, [type]: e.target.files![0] }))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Basic validation
        if (!formData.eventName || !formData.eventDate || !formData.institutionName || !formData.signatureName || !files.logo || !files.signature || !files.participants) {
            toast({
                title: "Missing Information",
                description: "Please fill in all required fields and upload all necessary files.",
                variant: "destructive",
            })
            return
        }

        if (formData.style === 'custom' && !files.customTemplate) {
            toast({
                title: "Missing Custom Template",
                description: "Please upload your custom HTML template.",
                variant: "destructive",
            })
            return
        }

        setLoading(true)
        setGeneratedFiles([])

        try {
            const form = new FormData()

            const config = {
                event_name: formData.eventName,
                event_date: formData.eventDate,
                institution_name: formData.institutionName,
                signature_name: formData.signatureName,
                style: formData.style,
                ai_theme_prompt: formData.aiThemePrompt
            }

            form.append("config_json", JSON.stringify(config))
            form.append("logo", files.logo)
            form.append("signature", files.signature)
            form.append("participants_csv", files.participants)

            if (formData.style === 'custom' && files.customTemplate) {
                form.append("custom_template", files.customTemplate)
            }

            const response = await fetch("http://127.0.0.1:8002/certificates/generate", {
                method: "POST",
                body: form,
            })

            const data = await response.json()

            if (response.ok) {
                setGeneratedFiles(data.generated_files)
                toast({
                    title: "Success!",
                    description: `Generated ${data.generated_files.length} certificates.`,
                })
            } else {
                throw new Error(data.detail || "Failed to generate certificates")
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container mx-auto py-10 px-4 md:px-8 max-w-5xl">
            <div className="mb-8 text-center">
                <h1 className="text-4xl font-bold tracking-tight mb-3">AI Certificate Generator</h1>
                <p className="text-muted-foreground text-lg">
                    Create professional, customized certificates for your events in seconds.
                </p>
            </div>

            {!generatedFiles.length ? (
                <div className="grid gap-6">
                    <form onSubmit={handleSubmit}>
                        {/* Step 1: Event Details */}
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-primary" />
                                    Event Details
                                </CardTitle>
                                <CardDescription>Enter the core information for the certificate.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="eventName">Event Name</Label>
                                    <Input
                                        id="eventName"
                                        placeholder="e.g., AI Summit 2025"
                                        value={formData.eventName}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="eventDate">Event Date</Label>
                                    <Input
                                        id="eventDate"
                                        placeholder="e.g., December 10, 2025"
                                        value={formData.eventDate}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="institutionName">Institution / Host</Label>
                                    <div className="relative">
                                        <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="institutionName"
                                            className="pl-9"
                                            placeholder="e.g., Tech University"
                                            value={formData.institutionName}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="signatureName">Signature Name & Title</Label>
                                    <div className="relative">
                                        <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="signatureName"
                                            className="pl-9"
                                            placeholder="e.g., Jane Doe, Director"
                                            value={formData.signatureName}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Step 2: Design & Assets */}
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Paintbrush className="h-5 w-5 text-primary" />
                                    Design & Branding
                                </CardTitle>
                                <CardDescription>Customize the look and feel of your certificates.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label className="mb-3 block">Certificate Style</Label>
                                    <RadioGroup
                                        defaultValue="modern"
                                        onValueChange={(val) => setFormData(prev => ({ ...prev, style: val }))}
                                        className="grid grid-cols-1 md:grid-cols-3 gap-4"
                                    >
                                        <div>
                                            <RadioGroupItem value="modern" id="modern" className="peer sr-only" />
                                            <Label
                                                htmlFor="modern"
                                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                                            >
                                                <span className="text-xl mb-2">✨</span>
                                                <span className="font-semibold">Modern</span>
                                            </Label>
                                        </div>
                                        <div>
                                            <RadioGroupItem value="formal" id="formal" className="peer sr-only" />
                                            <Label
                                                htmlFor="formal"
                                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                                            >
                                                <span className="text-xl mb-2">📜</span>
                                                <span className="font-semibold">Formal</span>
                                            </Label>
                                        </div>
                                        <div>
                                            <RadioGroupItem value="custom" id="custom" className="peer sr-only" />
                                            <Label
                                                htmlFor="custom"
                                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                                            >
                                                <span className="text-xl mb-2">🛠️</span>
                                                <span className="font-semibold">Custom Template</span>
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                {formData.style === 'custom' && (
                                    <div className="space-y-2 border-2 border-dashed border-primary/50 p-4 rounded-lg bg-primary/5">
                                        <Label htmlFor="customTemplate" className="flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            Upload Custom HTML Template
                                        </Label>
                                        <Input
                                            id="customTemplate"
                                            type="file"
                                            accept=".html"
                                            onChange={(e) => handleFileChange(e, 'customTemplate')}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Upload a Jinja2 compatible HTML file. Use variable names: <code>{"{{name}}"}</code>, <code>{"{{event_name}}"}</code>, etc.
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="aiThemePrompt">
                                        <span className="flex items-center gap-2">
                                            <Wand2 className="h-4 w-4 text-purple-500" />
                                            AI Theme Prompt (Optional)
                                        </span>
                                    </Label>
                                    <Input
                                        id="aiThemePrompt"
                                        placeholder="e.g., Cyberpunk neon style with glowing blue and pink"
                                        value={formData.aiThemePrompt}
                                        onChange={handleInputChange}
                                    />
                                    <p className="text-xs text-muted-foreground">The AI will generate a color palette based on your description.</p>
                                </div>

                                <Separator />

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="logo">Event Logo</Label>
                                        <Input id="logo" type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'logo')} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="signature">Signature Image</Label>
                                        <Input id="signature" type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'signature')} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Step 3: Participants */}
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5 text-primary" />
                                    Participant Data
                                </CardTitle>
                                <CardDescription>Upload the CSV file containing participant details.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <Label htmlFor="participants">Participants CSV</Label>
                                    <div className="flex gap-2">
                                        <Input id="participants" type="file" accept=".csv" onChange={(e) => handleFileChange(e, 'participants')} className="flex-1" />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Columns required: <code>name</code>, <code>achievement_type</code> (optional).
                                    </p>
                                </div>
                            </CardContent>
                            <CardFooter className="justify-end">
                                <Button size="lg" disabled={loading} type="submit" className="w-full md:w-auto">
                                    {loading ? (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="mr-2 h-4 w-4" />
                                            Generate Certificates
                                        </>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    </form>
                </div>
            ) : (
                <Card className="border-green-500/50 bg-green-500/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-500">
                            <Download className="h-6 w-6" />
                            Generation Complete!
                        </CardTitle>
                        <CardDescription>
                            Your certificates have been successfully generated.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-background rounded-md border p-4 max-h-60 overflow-y-auto">
                            <ul className="space-y-2">
                                {generatedFiles.map((file, idx) => (
                                    <li key={idx} className="flex items-center gap-2 text-sm">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        {file}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="mt-4 text-sm text-muted-foreground">
                            Files are saved in <code>certificate_generator/output/certificates</code>
                        </div>
                    </CardContent>
                    <CardFooter className="justify-center">
                        <Button variant="outline" onClick={() => {
                            setGeneratedFiles([])
                            setFiles({ logo: null, signature: null, participants: null, customTemplate: null })
                            // Optionally reset form data if needed, but keeping it is often better for BX
                        }}>
                            Create Another Batch
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    )
}
