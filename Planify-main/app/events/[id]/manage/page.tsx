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
import { useToast } from "@/hooks/use-toast"
import { Users, Calendar, MessageSquare, Wand2, Download, FileText, UserCheck, QrCode } from "lucide-react"
import { MaterialRequestsManager } from "@/components/materials/material-requests-manager"
import { MaterialSubmissionPanel } from "@/components/materials/material-submission-panel"
import { AttendeeSubmissionReport } from "@/components/materials/attendee-submission-report"
import { JudgeManagement } from "@/components/materials/judge-management"
import { ScoreLeaderboard } from "@/components/materials/score-leaderboard"
import EventQRCode from "@/components/events/event-qrcode"

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
  const [attendees, setAttendees] = useState<any[]>([])
  const [judges, setJudges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [savingEvent, setSavingEvent] = useState(false)
  const [downloadingAttendees, setDownloadingAttendees] = useState(false)
  const [runningTF, setRunningTF] = useState(false)
  const [tfResults, setTfResults] = useState<any | null>(null)
  const [tfLogs, setTfLogs] = useState<string>("")
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    const fetchEventAndAttendees = async () => {
      try {
        setLoading(true)
        // Fetch event details
        const eventRes = await fetch(`/api/events/${id}`)
        if (!eventRes.ok) throw new Error("Failed to fetch event")
        const eventData = await eventRes.json()
        setEvent(eventData)

        // Fetch attendees
        const attendeesRes = await fetch(`/api/events/${id}/attendees`)
        if (attendeesRes.ok) {
          const attendeesData = await attendeesRes.json()
          setAttendees(attendeesData)
        }

        // Fetch judges
        const judgesRes = await fetch(`/api/events/${id}/judges`)
        if (judgesRes.ok) {
          const judgesData = await judgesRes.json()
          setJudges(judgesData)
        }
      } catch (error) {
        console.error("Failed to fetch event/attendees:", error)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchEventAndAttendees()
  }, [id])

  const handleDownloadAttendees = async () => {
    try {
      setDownloadingAttendees(true)
      const response = await fetch(`/api/events/${id}/attendees/export?title=${encodeURIComponent(event.title)}`)
      if (!response.ok) throw new Error("Failed to download attendees")
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_attendees_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)
      
      toast({
        title: "Success!",
        description: "Attendees list downloaded successfully.",
        variant: "default",
      })
    } catch (error) {
      console.error("Failed to download attendees:", error)
      toast({
        title: "Error",
        description: "Failed to download attendees. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDownloadingAttendees(false)
    }
  }

  // Helper function to format ISO UTC string to datetime-local input format
  const formatDateForInput = (isoString: string) => {
    if (!isoString) return ""
    const date = new Date(isoString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // Helper function to convert datetime-local value to ISO UTC string
  const convertLocalToISO = (dateTimeString: string) => {
    if (!dateTimeString) return null
    // dateTimeString is "YYYY-MM-DDTHH:mm" in local time
    const [datePart, timePart] = dateTimeString.split('T')
    const [year, month, day] = datePart.split('-')
    const [hours, minutes] = timePart ? timePart.split(':') : ['00', '00']
    
    // Create date in local timezone
    const localDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      0
    )
    
    // Convert to ISO UTC string
    return localDate.toISOString()
  }

  const handleSaveEvent = async () => {
    try {
      setSavingEvent(true)
      
      // Validate that endDate is provided and after date
      if (!event.date || !event.endDate) {
        toast({
          title: "Error",
          description: "Both start date and end date are required.",
          variant: "destructive",
        })
        setSavingEvent(false)
        return
      }
      
      const startDate = new Date(event.date)
      const endDate = new Date(event.endDate)
      
      if (endDate <= startDate) {
        toast({
          title: "Error",
          description: "End date must be after start date.",
          variant: "destructive",
        })
        setSavingEvent(false)
        return
      }

      const response = await fetch(`/api/events/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: event.title,
          description: event.description,
          date: convertLocalToISO(event.date),
          endDate: convertLocalToISO(event.endDate),
          location: event.location,
          maxAttendees: event.maxAttendees,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save event")
      }

      const updatedEvent = await response.json()
      setEvent(updatedEvent)
      
      toast({
        title: "Success!",
        description: "Event details updated successfully.",
        variant: "default",
      })
    } catch (error) {
      console.error("Failed to save event:", error)
      toast({
        title: "Error",
        description: "Failed to save event details. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSavingEvent(false)
    }
  }

  const handleCancelEdit = () => {
    // Reload event data to discard changes
    if (id) {
      fetch(`/api/events/${id}`)
        .then(res => res.json())
        .then(data => setEvent(data))
        .catch(error => console.error("Failed to reload event:", error))
    }
  }

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

  const handleJudgeAdded = (judge: any) => {
    setJudges(prev => [...prev, judge])
  }

  const handleJudgeRemoved = (judgeId: string) => {
    setJudges(prev => prev.filter(j => j.judge_id !== judgeId))
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
            {event.date ? new Date(event.date).toLocaleDateString() : ""} • {attendees.length} / {event.maxAttendees}{" "}
            registered
          </p>
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList className={`grid gap-2 ${user?.role === 'community_admin' ? 'grid-cols-4 md:grid-cols-7' : 'grid-cols-2 md:grid-cols-4'}`}>
          <TabsTrigger value="details" className="gap-2">
            <Calendar className="h-4 w-4" />
            Details
          </TabsTrigger>
          {user?.role === 'community_admin' && (
            <TabsTrigger value="attendees" className="gap-2">
              <Users className="h-4 w-4" />
              Attendees
            </TabsTrigger>
          )}
          <TabsTrigger value="materials" className="gap-2">
            <FileText className="h-4 w-4" />
            Materials
          </TabsTrigger>
          {user?.role === 'community_admin' && (
            <TabsTrigger value="judges" className="gap-2">
              <UserCheck className="h-4 w-4" />
              Judges
            </TabsTrigger>
          )}
          <TabsTrigger value="queries" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Queries
          </TabsTrigger>
          <TabsTrigger value="qr-code" className="gap-2">
            <QrCode className="h-4 w-4" />
            QR Code
          </TabsTrigger>
          {user?.role === 'community_admin' && (
            <TabsTrigger value="ai-tools" className="gap-2">
              <Wand2 className="h-4 w-4" />
              AI Tools
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
              <CardDescription>
                {user?.role === 'community_admin' ? 'Update your event information' : 'View event information'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user?.role === 'community_admin' ? (
                <>
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
                        value={formatDateForInput(event.date)}
                        onChange={(e) => setEvent({ ...event, date: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="endDate">End Date</Label>
                      <Input
                        id="endDate"
                        type="datetime-local"
                        value={formatDateForInput(event.endDate)}
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
                </>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Event Title</Label>
                    <p className="text-lg font-semibold">{event.title}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <p className="text-sm whitespace-pre-wrap">{event.description}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Start Date</Label>
                      <p className="text-sm font-medium">
                        {event.date ? new Date(event.date).toLocaleString() : 'Not set'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">End Date</Label>
                      <p className="text-sm font-medium">
                        {event.endDate ? new Date(event.endDate).toLocaleString() : 'Not set'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Location</Label>
                    <p className="text-sm font-medium">{event.location || 'Not specified'}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Maximum Attendees</Label>
                    <p className="text-sm font-medium">{event.maxAttendees || 'Unlimited'}</p>
                  </div>
                </div>
              )}
            </CardContent>
            {user?.role === 'community_admin' && (
              <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCancelEdit} disabled={savingEvent}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEvent} disabled={savingEvent}>
                  {savingEvent ? "Saving..." : "Save Changes"}
                </Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="attendees">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Attendees</CardTitle>
                <CardDescription>Total: {attendees.length} attendees</CardDescription>
              </div>
              <Button 
                onClick={handleDownloadAttendees} 
                disabled={downloadingAttendees || attendees.length === 0 || user?.role !== 'community_admin'}
                className="gap-2"
                title={user?.role !== 'community_admin' ? 'Only admins can download attendees' : ''}
              >
                <Download className="h-4 w-4" />
                {downloadingAttendees ? "Downloading..." : "Download Excel"}
              </Button>
            </CardHeader>
            <CardContent>
              {user?.role !== 'community_admin' && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    ℹ️ Only event admins can download the attendees list.
                  </p>
                </div>
              )}
              {attendees.length === 0 ? (
                <p className="text-muted-foreground">No attendees yet</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted border-b">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Name</th>
                        <th className="px-4 py-2 text-left font-medium">Email</th>
                        <th className="px-4 py-2 text-left font-medium">Registered At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendees.map((attendee, index) => (
                        <tr key={attendee.id} className={index % 2 === 0 ? "bg-white" : "bg-muted/30"}>
                          <td className="px-4 py-2">{attendee.name}</td>
                          <td className="px-4 py-2">{attendee.email}</td>
                          <td className="px-4 py-2">
                            {attendee.registeredAt 
                              ? new Date(attendee.registeredAt).toLocaleDateString() 
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials">
          <Card>
            <CardHeader>
              <CardTitle>Material Requests & Submissions</CardTitle>
              <CardDescription>Manage material requests from attendees and track submissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {user?.role === 'community_admin' && (
                <div className="space-y-4">
                  <div className="border-b pb-6">
                    <h3 className="text-lg font-semibold mb-4">Create & Manage Requests</h3>
                    <MaterialRequestsManager eventId={id as string} isAdmin={true} />
                  </div>
                </div>
              )}

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Material Submissions</h3>
                <MaterialSubmissionPanel eventId={id as string} />
              </div>

              {user?.role === 'community_admin' && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Attendee Submission Report</h3>
                  <AttendeeSubmissionReport eventId={id as string} isAdmin={true} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="judges">
          <div className="space-y-6">
            {/* Judge Management */}
            <JudgeManagement
              eventId={id as string}
              eventTitle={event.title}
              judges={judges}
              onJudgeAdded={handleJudgeAdded}
              onJudgeRemoved={handleJudgeRemoved}
            />

            {/* Score Leaderboard */}
            <ScoreLeaderboard 
              eventId={id as string}
              eventTitle={event.title}
            />
          </div>
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

        <TabsContent value="qr-code">
          <Card>
            <CardHeader>
              <CardTitle>Event QR Code</CardTitle>
              <CardDescription>Share this QR code with participants to promote and register for your event</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-md">
                <EventQRCode
                  eventId={id as string}
                  eventTitle={event.title}
                  eventDate={event.date ? new Date(event.date || event.startDate).toLocaleDateString() : "TBA"}
                  size="large"
                  showDownload={true}
                  showCopy={true}
                />
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

