"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Download, Mail, Calendar as CalendarIcon, Trash2 } from "lucide-react"
import { format } from "date-fns"

type ScraperResult = {
  success?: boolean
  message?: string
  event_classification?: {
    event_type?: string
    roles_to_find?: string[]
    reasoning?: string
  }
  data?: Record<string, any[]>
  metadata?: Record<string, any>
  json_path?: string
  review_document_path?: string | null
}

type Email = {
  id: string
  timestamp: string
  to: string
  subject: string
  body: string
}

type EmailDraft = {
  id: string
  to: string
  subject: string
  body: string
  timestamp: string
  person_data?: {
    name?: string
    title?: string
    company?: string
    email?: string
  }
}

const EVENT_TYPES = [
  { value: "hackathon", label: "Hackathon" },
  { value: "conference", label: "Conference" },
  { value: "competition", label: "Competition" },
  { value: "workshop", label: "Workshop" },
  { value: "meetup", label: "Meetup" },
  { value: "summit", label: "Summit" },
  { value: "expo", label: "Expo" },
  { value: "festival", label: "Festival" },
  { value: "webinar", label: "Webinar" },
  { value: "seminar", label: "Seminar" },
]

export default function ScraperAgent() {
  const [name, setName] = useState("")
  const [type, setType] = useState("")
  const [useCustomType, setUseCustomType] = useState(false)
  const [description, setDescription] = useState("")
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [location, setLocation] = useState("")
  const [rolesToSearch, setRolesToSearch] = useState<string[]>(["speakers", "mentors"])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScraperResult | null>(null)
  const [emails, setEmails] = useState<Email[]>([])
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [showEmailsSection, setShowEmailsSection] = useState(false)
  const [drafts, setDrafts] = useState<EmailDraft[]>([])
  const [draftsLoading, setDraftsLoading] = useState(false)
  const [showDraftsSection, setShowDraftsSection] = useState(false)
  const [clearingDrafts, setClearingDrafts] = useState(false)
  const [draftsCleared, setDraftsCleared] = useState(false)

  const ROLE_OPTIONS = [
    { id: "speakers", label: "Speakers" },
    { id: "mentors", label: "Mentors (can be judges)" },
    { id: "sponsors", label: "Sponsors" },
  ]

  useEffect(() => {
    // Load emails and drafts on component mount
    fetchEmails()
    fetchDrafts()
  }, [])

  async function fetchEmails() {
    setEmailsLoading(true)
    try {
      const res = await fetch("/api/scraper/emails")
      const data = await res.json()
      if (data.success) {
        setEmails(data.emails || [])
        if (data.emails?.length > 0) {
          setShowEmailsSection(true)
        }
      }
    } catch (e) {
      console.error("Failed to fetch emails:", e)
    } finally {
      setEmailsLoading(false)
    }
  }

  async function fetchDrafts() {
    setDraftsLoading(true)
    try {
      const res = await fetch("/api/scraper/email-drafts")
      const data = await res.json()
      if (data.success) {
        setDrafts(data.drafts || [])
        if (data.drafts?.length > 0) {
          setShowDraftsSection(true)
        }
      }
    } catch (e) {
      console.error("Failed to fetch drafts:", e)
    } finally {
      setDraftsLoading(false)
    }
  }

  async function clearDrafts() {
    setClearingDrafts(true)
    setDraftsCleared(false)
    try {
      await fetch("/api/scraper/email-drafts", { method: "DELETE" })
      setDrafts([])
      setDraftsCleared(true)
      setTimeout(() => setDraftsCleared(false), 3000)
    } catch (e) {
      console.error("Failed to clear drafts:", e)
    } finally {
      setClearingDrafts(false)
    }
  }

  function toggleRole(roleId: string) {
    setRolesToSearch((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    )
  }

  function downloadEmail(email: Email) {
    const content = `To: ${email.to}
Subject: ${email.subject}
Timestamp: ${email.timestamp}

${email.body}`

    const element = document.createElement("a")
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(content))
    element.setAttribute("download", `email_${email.id}_${Date.now()}.txt`)
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  function downloadAllEmails() {
    const allContent = emails
      .map((email) => `To: ${email.to}\nSubject: ${email.subject}\nTimestamp: ${email.timestamp}\n\n${email.body}`)
      .join("\n\n" + "=".repeat(80) + "\n\n")

    const element = document.createElement("a")
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(allContent))
    element.setAttribute("download", `all_emails_${Date.now()}.txt`)
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  function downloadDraft(draft: EmailDraft) {
    const personInfo = draft.person_data
      ? `\nPerson: ${draft.person_data.name || "Unknown"}\nTitle: ${draft.person_data.title || "N/A"}\nCompany: ${draft.person_data.company || "N/A"}`
      : ""
    
    const content = `To: ${draft.to}
Subject: ${draft.subject}
Timestamp: ${draft.timestamp}${personInfo}

${draft.body}`

    const element = document.createElement("a")
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(content))
    element.setAttribute("download", `draft_${draft.id}_${Date.now()}.txt`)
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  function downloadAllDrafts() {
    const allContent = drafts
      .map((draft) => {
        const personInfo = draft.person_data
          ? `Person: ${draft.person_data.name || "Unknown"}\nTitle: ${draft.person_data.title || "N/A"}\nCompany: ${draft.person_data.company || "N/A"}\n`
          : ""
        return `To: ${draft.to}\nSubject: ${draft.subject}\nTimestamp: ${draft.timestamp}\n${personInfo}\n${draft.body}`
      })
      .join("\n\n" + "=".repeat(80) + "\n\n")

    const element = document.createElement("a")
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(allContent))
    element.setAttribute("download", `all_drafts_${Date.now()}.txt`)
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  async function handleRun() {
    setError(null)
    setResult(null)

    if (!name.trim()) {
      setError("Please provide an event name.")
      return
    }

    if (rolesToSearch.length === 0) {
      setError("Please select at least one role to search for.")
      return
    }

    setLoading(true)
    try {
      const payload = {
        name: name.trim(),
        type: (type.trim() && type !== "none") ? type.trim() : undefined,
        description: description.trim() || undefined,
        date: date ? format(date, "yyyy-MM-dd") : undefined,
        location: location.trim() || undefined,
        roles_to_search: rolesToSearch,
      }

      // Use AbortController with 12 minute timeout (720 seconds)
      // Web scraping can take a while
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 720000)

      try {
        const res = await fetch("/api/scraper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const data: ScraperResult = await res.json().catch(() => ({}))

        if (!res.ok) {
          const errorMessage =
            data?.message ||
            (data as any)?.detail ||
            (data as any)?.error ||
            `Request failed with status ${res.status}`
          throw new Error(errorMessage)
        }

        setResult(data)
        // Refresh emails and drafts after running scraper
        await fetchEmails()
        await fetchDrafts()
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === "AbortError") {
          throw new Error(
            "Request timed out. The scraper took too long to complete. This might happen if many results were found. Please try again or adjust your search parameters."
          )
        }
        throw fetchError
      }
    } catch (e: any) {
      console.error("Scraper error:", e)
      setError(e?.message || "Failed to run scraper agent. Please check the backend is running on port 8007.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold">Scraper Agent</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Describe your event, and the agent will scout the web for potential speakers, judges, mentors, and sponsors.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>
            Provide as much context as you can. The agent uses this to classify the event and decide which roles to
            search for.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Event Name *</label>
              <Input
                placeholder="e.g. Planify AI Hackathon 2025"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="event-type" className="text-sm font-medium">
                  Event Type
                </Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="custom-type-toggle" className="text-xs text-muted-foreground cursor-pointer">
                    Custom
                  </Label>
                  <Switch
                    id="custom-type-toggle"
                    checked={useCustomType}
                    onCheckedChange={(checked) => {
                      setUseCustomType(checked)
                      if (!checked) setType("")
                    }}
                  />
                </div>
              </div>
              {useCustomType ? (
                <Input
                  id="event-type"
                  placeholder="e.g. hackathon, conference, competition"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                />
              ) : (
                <Select 
                  value={type || undefined} 
                  onValueChange={(value) => setType(value || "")}
                >
                  <SelectTrigger id="event-type">
                    <SelectValue placeholder="Select event type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (let agent classify)</SelectItem>
                    {EVENT_TYPES.map((eventType) => (
                      <SelectItem key={eventType.value} value={eventType.value}>
                        {eventType.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <Input
                placeholder="e.g. Bangalore, India or Online"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Roles to Search For</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role.id}
                  onClick={() => toggleRole(role.id)}
                  className={`px-3 py-2 rounded-md border transition-colors text-sm font-medium ${
                    rolesToSearch.includes(role.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description / Context</label>
            <Textarea
              placeholder="Describe the theme, target audience, level (student/industry), domains (AI, fintech...), etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={handleRun} disabled={loading}>
              {loading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Scraping in progress...
                </>
              ) : (
                "Run Scraper Agent"
              )}
            </Button>
          </div>

          {loading && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 font-medium">⏳ Scraper is running...</p>
              <p className="text-xs text-blue-700 mt-1">
                This may take several minutes as we search for candidates, extract information, and prepare emails.
              </p>
              <p className="text-xs text-blue-700 mt-2">Please don't close this window.</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-900 font-medium">❌ Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8 border-amber-200 bg-amber-50">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                📝 Email Drafts
              </CardTitle>
              <CardDescription className="mt-1">
                Email drafts generated in the latest scraper run. {drafts.length} draft(s) found.
                {draftsCleared && <span className="ml-2 text-green-600 font-medium">✓ Drafts cleared!</span>}
              </CardDescription>
            </div>
            {drafts.length > 0 && (
              <Button
                id="clear-drafts-btn"
                onClick={clearDrafts}
                disabled={clearingDrafts}
                variant="outline"
                size="sm"
                className="gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 shrink-0 mt-1"
                type="button"
              >
                {clearingDrafts ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Clear Drafts
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {draftsLoading ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              <p className="animate-pulse">Loading drafts...</p>
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              <p>No drafts found yet. Run the scraper agent to generate drafts.</p>
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap gap-2">
                <Button
                  onClick={downloadAllDrafts}
                  variant="default"
                  size="sm"
                  className="gap-2 bg-amber-600 hover:bg-amber-700"
                  type="button"
                >
                  <Download className="h-4 w-4" />
                  Download All {drafts.length} Drafts
                </Button>
              </div>
                <Accordion type="single" collapsible className="w-full">
                  {drafts.map((draft) => (
                    <AccordionItem key={draft.id} value={draft.id}>
                      <AccordionTrigger>
                        <div className="flex flex-col items-start flex-1 text-left">
                          <div className="font-medium">{draft.subject}</div>
                          <div className="text-sm text-muted-foreground">
                            To: {draft.to}
                            {draft.person_data?.name && ` (${draft.person_data.name})`}
                            {draft.person_data?.title && ` - ${draft.person_data.title}`}
                            {draft.person_data?.company && ` @ ${draft.person_data.company}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {draft.timestamp}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">To:</span> {draft.to}
                            </div>
                            <div>
                              <span className="font-medium">Subject:</span> {draft.subject}
                            </div>
                            {draft.person_data?.name && (
                              <div>
                                <span className="font-medium">Person:</span> {draft.person_data.name}
                              </div>
                            )}
                            {draft.person_data?.title && (
                              <div>
                                <span className="font-medium">Title:</span> {draft.person_data.title}
                              </div>
                            )}
                            {draft.person_data?.company && (
                              <div>
                                <span className="font-medium">Company:</span> {draft.person_data.company}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Created:</span> {draft.timestamp}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-4 whitespace-pre-wrap text-sm font-mono max-h-96 overflow-y-auto border">
                            {draft.body}
                          </div>
                        <Button
                          onClick={() => downloadDraft(draft)}
                          variant="outline"
                          size="sm"
                          className="gap-2 hover:bg-amber-100"
                          type="button"
                        >
                          <Download className="h-4 w-4" />
                          Download This Draft
                        </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </>
            )}
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Sent Emails
          </CardTitle>
          <CardDescription>
            View all emails generated and sent by the scraper agent. {emails.length} email(s) found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailsLoading ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              <p className="animate-pulse">Loading emails...</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              <p>No emails found yet. Run the scraper agent to generate emails.</p>
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap gap-2">
                <Button
                  onClick={downloadAllEmails}
                  variant="default"
                  size="sm"
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                  type="button"
                >
                  <Download className="h-4 w-4" />
                  Download All {emails.length} Emails
                </Button>
              </div>
                <Accordion type="single" collapsible className="w-full">
                  {emails.map((email, index) => (
                    <AccordionItem key={email.id} value={email.id}>
                      <AccordionTrigger>
                        <div className="flex flex-col items-start flex-1 text-left">
                          <div className="font-medium">{email.subject}</div>
                          <div className="text-sm text-muted-foreground">
                            To: {email.to} • {email.timestamp}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="text-sm">
                              <span className="font-medium">To:</span> {email.to}
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">Subject:</span> {email.subject}
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">Sent:</span> {email.timestamp}
                            </div>
                          </div>
                          <div className="bg-muted rounded-lg p-4 whitespace-pre-wrap text-sm font-mono max-h-96 overflow-y-auto">
                            {email.body}
                          </div>
                        <Button
                          onClick={() => downloadEmail(email)}
                          variant="outline"
                          size="sm"
                          className="gap-2 hover:bg-blue-100"
                          type="button"
                        >
                          <Download className="h-4 w-4" />
                          Download This Email
                        </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </>
            )}
        </CardContent>
      </Card>

      {result && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>✅ Scraper Completed Successfully</CardTitle>
            <CardDescription>
              {result.message || "The scraper has finished processing. Review the results below."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.event_classification && (
              <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                <h3 className="font-semibold mb-2">Event Classification</h3>
                <p className="text-sm">
                  <span className="font-medium">Type:</span> {result.event_classification.event_type || "N/A"}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Roles to find:</span>{" "}
                  {result.event_classification.roles_to_find?.join(", ") || "N/A"}
                </p>
                {result.event_classification.reasoning && (
                  <p className="text-sm mt-1 text-muted-foreground">
                    <span className="font-medium">Reasoning:</span> {result.event_classification.reasoning}
                  </p>
                )}
              </div>
            )}

            {result.metadata && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Metadata</h3>
                <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto">
{JSON.stringify(result.metadata, null, 2)}
                </pre>
              </div>
            )}

            {result.data && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Candidates by Role</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  This is a compact preview. For deeper review and editing, open the Markdown document on disk.
                </p>
                <div className="space-y-4">
                  {Object.entries(result.data).map(([role, people]) => {
                    if (!Array.isArray(people) || people.length === 0) return null
                    return (
                      <div key={role} className="border rounded-md p-3">
                        <h4 className="font-semibold mb-1">
                          {role} ({people.length} found)
                        </h4>
                        <ul className="space-y-1 max-h-60 overflow-auto text-sm">
                          {(people as any[]).slice(0, 10).map((p, idx) => (
                            <li key={idx} className="border-b last:border-b-0 py-1">
                              <span className="font-medium">{p.name || "Unknown"}</span>{" "}
                              {p.title && <span className="text-muted-foreground">— {p.title}</span>}
                              {p.company && <span className="text-muted-foreground"> @ {p.company}</span>}
                              {p.email && (
                                <span className="ml-2 text-xs text-blue-400 break-all">{p.email}</span>
                              )}
                              {p.linkedin_url && (
                                <span className="ml-2 text-xs text-blue-400 break-all">{p.linkedin_url}</span>
                              )}
                            </li>
                          ))}
                          {people.length > 10 && (
                            <li className="text-xs text-muted-foreground mt-1">
                              + {people.length - 10} more (see Markdown document)
                            </li>
                          )}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {result.review_document_path && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Review Document</h3>
                <p className="text-sm text-muted-foreground">
                  Markdown file generated at:
                  <br />
                  <code className="text-xs break-all">{result.review_document_path}</code>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Open this file on the server to perform detailed cross-verification before approving outreach.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}


