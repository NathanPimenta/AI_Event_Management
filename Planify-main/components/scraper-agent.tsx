"use client"

import React, { useState } from "react"
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
  const [date, setDate] = useState("")
  const [location, setLocation] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScraperResult | null>(null)

  async function handleRun() {
    setError(null)
    setResult(null)

    if (!name.trim()) {
      setError("Please provide an event name.")
      return
    }

    setLoading(true)
    try {
      const payload = {
        name: name.trim(),
        type: (type.trim() && type !== "none") ? type.trim() : undefined,
        description: description.trim() || undefined,
        date: date.trim() || undefined,
        location: location.trim() || undefined,
      }

      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data: ScraperResult = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.message || (data as any)?.detail || (data as any)?.error || `Status ${res.status}`)
      }

      setResult(data)
    } catch (e: any) {
      setError(e?.message || "Failed to run scraper agent.")
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
              <Input placeholder="e.g. 2025-10-15" value={date} onChange={(e) => setDate(e.target.value)} />
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
            <label className="block text-sm font-medium mb-1">Description / Context</label>
            <Textarea
              placeholder="Describe the theme, target audience, level (student/industry), domains (AI, fintech...), etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleRun} disabled={loading}>
              {loading ? "Running..." : "Run Scraper Agent"}
            </Button>
          </div>

          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Agent Output</CardTitle>
            <CardDescription>
              Review the classification and candidate lists. Use the generated Markdown document for deep manual review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.event_classification && (
              <div className="border rounded-lg p-4">
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


