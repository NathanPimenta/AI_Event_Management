"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { Award, Upload, Loader2, CheckCircle, Star, ChevronDown, Wand2, FileCode, Calendar as CalendarIcon, Download } from "lucide-react"
import { format } from "date-fns"

export default function CertificateGeneratorPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ message: string; files: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Event Details
  const [eventName, setEventName] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [eventDateValue, setEventDateValue] = useState<Date | undefined>(undefined)
  const [institutionName, setInstitutionName] = useState("")
  const [signatureName, setSignatureName] = useState("")

  // Step 2: Design & Branding
  const [style, setStyle] = useState("modern")
  const [aiThemePrompt, setAiThemePrompt] = useState("")

  // File states
  const [logoFileName, setLogoFileName] = useState("")
  const [signatureFileName, setSignatureFileName] = useState("")
  const [csvFileName, setCsvFileName] = useState("")
  const [templateFileName, setTemplateFileName] = useState("")

  // Custom template toggle
  const [useCustomTemplate, setUseCustomTemplate] = useState(false)

  const csvRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const signatureRef = useRef<HTMLInputElement>(null)
  const templateRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFileName: (name: string) => void
  ) => {
    const file = e.target.files?.[0]
    setFileName(file ? file.name : "")
  }

  const downloadTemplate = () => {
    const csvContent = "name,email,achievement_type\nJohn Doe,john@example.com,Participation\nJane Smith,jane@example.com,First Place Winner"
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "participants_template.csv"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }


  const downloadCertificateTemplate = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8002/templates/download/certificate.html")
      if (!response.ok) throw new Error("Failed to fetch template")
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "certificate.html"
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Download failed:", error)
      alert("Failed to download template. Please check if the backend is running on port 8002.")
    }
  }
  const isFormValid = () => {
    return (
      eventName.trim() !== "" &&
      eventDate.trim() !== "" &&
      institutionName.trim() !== "" &&
      signatureName.trim() !== "" &&
      logoFileName !== "" &&
      signatureFileName !== "" &&
      csvFileName !== ""
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    const csvFile = csvRef.current?.files?.[0]
    const logoFile = logoRef.current?.files?.[0]
    const signatureFile = signatureRef.current?.files?.[0]
    const templateFile = templateRef.current?.files?.[0]

    if (!csvFile || !logoFile || !signatureFile) {
      setError("Please upload all required files (CSV, Logo, Signature)")
      setLoading(false)
      return
    }

    const config = {
      event_name: eventName,
      event_date: eventDate,
      institution_name: institutionName,
      signature_name: signatureName,
      style: style,
      ai_theme_prompt: aiThemePrompt,
    }

    const formData = new FormData()
    formData.append("config_json", JSON.stringify(config))
    formData.append("participants_csv", csvFile)
    formData.append("logo", logoFile)
    formData.append("signature", signatureFile)

    // Add custom template if provided
    if (useCustomTemplate && templateFile) {
      formData.append("custom_template", templateFile)
    }

    try {
      const response = await fetch("http://127.0.0.1:8002/certificates/generate", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Failed to generate certificates")
      }

      const data = await response.json()
      setResult({ message: data.message, files: data.generated_files })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 md:p-12">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="py-16 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-semibold">Generating Certificates...</h2>
            <p className="text-muted-foreground mt-2">
              This may take a moment, especially for a large number of participants.
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
            <h2 className="text-3xl font-bold">Generation Complete!</h2>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Generated Files</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-4 max-h-60 overflow-y-auto">
                <ul className="space-y-1">
                  {result.files.map((file, i) => (
                    <li key={i} className="text-sm">• {file}</li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Files are saved in your project's `certificate_generator/output/certificates` directory.
              </p>
            </CardContent>
          </Card>
          <div className="text-center mt-8">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Generate Another Batch
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
          <h1 className="text-4xl font-bold">AI Certificate Generator</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Create and deliver unique, professional certificates for your event participants.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Event Details */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm">1</span>
                Event Details
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
                    placeholder="e.g., AI & Code Summit"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventDate">Event Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !eventDateValue && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {eventDateValue ? format(eventDateValue, "MMMM d, yyyy") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={eventDateValue}
                        onSelect={(date) => {
                          setEventDateValue(date)
                          setEventDate(date ? format(date, "MMMM d, yyyy") : "")
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="institutionName">Institution / Host *</Label>
                  <Input
                    id="institutionName"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    placeholder="e.g., CommunityHub University"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signatureName">Signature Name & Title *</Label>
                  <Input
                    id="signatureName"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    placeholder="e.g., Dr. Alex Ray, Event Chair"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Design & Branding */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm">2</span>
                Design & Branding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Style Selection */}
              <div className="space-y-3">
                <Label>Certificate Style</Label>
                <RadioGroup value={style} onValueChange={setStyle} className="grid grid-cols-2 gap-4">
                  <Label
                    htmlFor="modern"
                    className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-colors ${style === "modern" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"
                      }`}
                  >
                    <RadioGroupItem value="modern" id="modern" className="sr-only" />
                    <Star className="h-8 w-8 mb-2" />
                    <span className="font-semibold">Modern</span>
                  </Label>
                  <Label
                    htmlFor="formal"
                    className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-colors ${style === "formal" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"
                      }`}
                  >
                    <RadioGroupItem value="formal" id="formal" className="sr-only" />
                    <Award className="h-8 w-8 mb-2" />
                    <span className="font-semibold">Formal</span>
                  </Label>
                </RadioGroup>
              </div>

              {/* AI Theme Prompt */}
              <div className="space-y-2">
                <Label htmlFor="aiTheme" className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-yellow-500" />
                  AI-Powered Theme (Optional)
                </Label>
                <Input
                  id="aiTheme"
                  value={aiThemePrompt}
                  onChange={(e) => setAiThemePrompt(e.target.value)}
                  placeholder="e.g., Winter hackathon with icy blues and silver"
                />
                <p className="text-sm text-muted-foreground">
                  Describe the theme, and the AI will generate a unique color palette.
                </p>
              </div>

              {/* File Uploads */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Event Logo *</Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors ${logoFileName ? "border-green-500" : "border-muted"
                      }`}
                    onClick={() => logoRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={logoRef}
                      className="hidden"
                      accept="image/png,image/jpeg"
                      onChange={(e) => handleFileChange(e, setLogoFileName)}
                    />
                    <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <span className="text-sm">
                      {logoFileName || "Click to upload logo"}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Signature Image *</Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors ${signatureFileName ? "border-green-500" : "border-muted"
                      }`}
                    onClick={() => signatureRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={signatureRef}
                      className="hidden"
                      accept="image/png"
                      onChange={(e) => handleFileChange(e, setSignatureFileName)}
                    />
                    <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <span className="text-sm">
                      {signatureFileName || "Click to upload signature"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Custom Template (Optional) */}
              <Collapsible open={useCustomTemplate} onOpenChange={setUseCustomTemplate}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" type="button" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <FileCode className="h-4 w-4" />
                      Custom Jinja2 HTML Template (Optional)
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${useCustomTemplate ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Upload a custom Jinja2 HTML template to override the default certificate design.
                      Available variables: <code className="bg-muted px-1 rounded">{"{{ name }}"}</code>,
                      <code className="bg-muted px-1 rounded">{"{{ event_name }}"}</code>,
                      <code className="bg-muted px-1 rounded">{"{{ event_date }}"}</code>,
                      <code className="bg-muted px-1 rounded">{"{{ achievement_type }}"}</code>
                    </p>

                    <div className="flex gap-2 mb-4">
                      <Button variant="outline" size="sm" type="button" onClick={downloadCertificateTemplate}>
                        <Download className="mr-2 h-4 w-4" /> Download Reference Template
                      </Button>
                    </div>
                    <div
                      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors ${templateFileName ? "border-green-500" : "border-muted"
                        }`}
                      onClick={() => templateRef.current?.click()}
                    >
                      <input
                        type="file"
                        ref={templateRef}
                        className="hidden"
                        accept=".html,.jinja,.jinja2,.j2"
                        onChange={(e) => handleFileChange(e, setTemplateFileName)}
                      />
                      <FileCode className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <span className="text-sm">
                        {templateFileName || "Click to upload Jinja2 HTML template"}
                      </span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Step 3: Participant Data */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm">3</span>
                Participant Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors ${csvFileName ? "border-green-500" : "border-muted"
                  }`}
                onClick={() => csvRef.current?.click()}
              >
                <input
                  type="file"
                  ref={csvRef}
                  className="hidden"
                  accept=".csv"
                  onChange={(e) => handleFileChange(e, setCsvFileName)}
                />
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <span className="text-base font-medium">
                  {csvFileName || "Click to upload participants.csv"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Requires a CSV with columns: <code className="bg-muted px-1 rounded">name</code>,
                <code className="bg-muted px-1 rounded">email</code>,
                <code className="bg-muted px-1 rounded">achievement_type</code>.{" "}
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="text-primary hover:underline"
                >
                  Download template
                </button>
              </p>
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
              Generate Certificates
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
