"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { Users, Calendar, MessageSquare, Wand2 } from "lucide-react"

// Fallback event shape for initial state
const mockEvent = {
  _id: "",
  title: "",
  description: "",
  date: "",
  endDate: "",
  location: "",
  club: "",
  community: "",
  attendees: 0,
  maxAttendees: 0,
}

export default function ManageEventPage() {
  const { id } = useParams()
  const [event, setEvent] = useState<any>(mockEvent)
  const [loading, setLoading] = useState(true)
  const [runningTF, setRunningTF] = useState(false)
  const [tfResults, setTfResults] = useState<any | null>(null)
  const [tfLogs, setTfLogs] = useState<string>("")
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/events/${id}`)
        if (!res.ok) throw new Error("Failed to fetch event")
        const data = await res.json()
        setEvent(data)
      } catch (error) {
        console.error("Failed to fetch event:", error)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchEvent()
  }, [id])

  const runTeamFormation = async () => {
    try {
      setRunningTF(true)
      setTfResults(null)
      setTfLogs("")
      const res = await fetch('/api/team-formation', {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setTfLogs((data && (data.output || data.logs)) || 'Process failed')
        throw new Error(data?.error || 'Team formation failed')
      }
      setTfResults(data.results)
      setTfLogs(data.logs || '')
    } catch (e) {
      console.error(e)
    } finally {
      setRunningTF(false)
    }
  }

  if (loading) {
    return (
      <div className="container flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading event details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Event: {event.title}</h1>
          <p className="text-muted-foreground">
            {event.date ? new Date(event.date).toLocaleDateString() : ""} • {event.attendees} / {event.maxAttendees}{" "}
            registered
          </p>
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <TabsTrigger value="details" className="gap-2">
            <Calendar className="h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="attendees" className="gap-2">
            <Users className="h-4 w-4" />
            Attendees
          </TabsTrigger>
          <TabsTrigger value="queries" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Queries
          </TabsTrigger>
          <TabsTrigger value="ai-tools" className="gap-2">
            <Wand2 className="h-4 w-4" />
            AI Tools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
              <CardDescription>Update your event information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title</Label>
                <Input id="title" value={event.title} onChange={(e) => setEvent({ ...event, title: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={event.description}
                  onChange={(e) => setEvent({ ...event, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="datetime-local"
                    value={event.date ? new Date(event.date).toISOString().slice(0, 16) : ""}
                    onChange={(e) => setEvent({ ...event, date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : ""}
                    onChange={(e) => setEvent({ ...event, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={event.location}
                  onChange={(e) => setEvent({ ...event, location: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxAttendees">Maximum Attendees</Label>
                  <Input
                    id="maxAttendees"
                    type="number"
                    value={event.maxAttendees}
                    onChange={(e) => setEvent({ ...event, maxAttendees: Number.parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="outline">Cancel</Button>
              <Button>Save Changes</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="attendees">
          <Card>
            <CardHeader>
              <CardTitle>Attendees</CardTitle>
              <CardDescription>Manage event attendees</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Attendee management functionality would go here</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queries">
          <Card>
            <CardHeader>
              <CardTitle>Queries</CardTitle>
              <CardDescription>Respond to attendee questions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <p className="font-medium">Alice Smith</p>
                        <p className="text-xs text-muted-foreground">Oct 25, 2023</p>
                      </div>
                      <p className="mt-1">Will this workshop cover TypeScript?</p>
                    </div>
                  </div>

                  <div className="ml-0 p-3 bg-muted rounded-md">
                    <p className="text-sm font-medium mb-1">Your response:</p>
                    <p className="text-sm">Yes, we'll cover TypeScript basics and how to integrate it with React.</p>
                  </div>
                </div>

                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <p className="font-medium">Bob Johnson</p>
                        <p className="text-xs text-muted-foreground">Oct 26, 2023</p>
                      </div>
                      <p className="mt-1">Is this suitable for beginners?</p>
                    </div>
                  </div>

                  <div className="ml-0 p-3 bg-muted rounded-md">
                    <p className="text-sm font-medium mb-1">Your response:</p>
                    <p className="text-sm">
                      We'll start with the fundamentals and gradually move to more advanced topics.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-tools">
          <Card>
            <CardHeader>
              <CardTitle>AI Tools</CardTitle>
              <CardDescription>Use AI to enhance your event</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="content" className="space-y-4">
                <TabsList className="grid grid-cols-4 gap-2">
                  <TabsTrigger value="content">Content Generator</TabsTrigger>
                  <TabsTrigger value="certificates">Certificate Generator</TabsTrigger>
                  <TabsTrigger value="feedback">Feedback Analysis</TabsTrigger>
                  <TabsTrigger value="team-formation">Team Formation</TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="contentPrompt">Content Prompt</Label>
                    <Textarea
                      id="contentPrompt"
                      placeholder="Describe the content you want to generate (e.g., 'A social media post for our upcoming web development workshop')"
                      rows={3}
                    />
                  </div>

                  <Button className="gap-2">
                    <Wand2 className="h-4 w-4" />
                    Generate Content
                  </Button>
                </TabsContent>

                <TabsContent value="certificates" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="certificateStyle">Certificate Style</Label>
                    <Textarea
                      id="certificateStyle"
                      placeholder="Describe the certificate style (e.g., 'Professional certificate with blue theme and the club logo')"
                      rows={3}
                    />
                  </div>

                  <Button className="gap-2">
                    <Wand2 className="h-4 w-4" />
                    Generate Certificate Template
                  </Button>
                </TabsContent>

                <TabsContent value="feedback" className="space-y-4">
                  <div className="p-4 border rounded-md bg-muted">
                    <p className="text-sm">
                      After your event is complete and feedback forms are submitted, use this tool to analyze
                      participant sentiment and generate insights.
                    </p>
                  </div>

                  <Button className="gap-2" disabled>
                    <Wand2 className="h-4 w-4" />
                    Analyze Feedback (Available after event)
                  </Button>
                </TabsContent>

                <TabsContent value="team-formation" className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Run the AI team formation optimizer using current sample data.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button className="gap-2" onClick={runTeamFormation} disabled={runningTF}>
                      <Wand2 className="h-4 w-4" />
                      {runningTF ? 'Running…' : 'Run Team Formation'}
                    </Button>
                  </div>
                  {tfResults && (
                    <div className="mt-4 p-4 border rounded-md bg-muted/30">
                      <p className="font-medium mb-2">Results</p>
                      <pre className="text-xs overflow-auto max-h-80">{JSON.stringify(tfResults, null, 2)}</pre>
                    </div>
                  )}
                  {tfLogs && (
                    <div className="mt-4 p-4 border rounded-md bg-muted/30">
                      <p className="font-medium mb-2">Logs</p>
                      <pre className="text-xs overflow-auto max-h-80 whitespace-pre-wrap">{tfLogs}</pre>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

