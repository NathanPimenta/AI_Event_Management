"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"
import { Wand2, Users, Loader2 } from "lucide-react"

export default function TeamFormationPage() {
  const { id: clubId } = useParams()
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [requirements, setRequirements] = useState("")
  const [suggestedTeams, setSuggestedTeams] = useState<any[]>([])

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    fetchMembers()
  }, [clubId, user, router])

  const fetchMembers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/clubs/${clubId}/members`)
      if (!response.ok) throw new Error("Failed to fetch members")
      const data = await response.json()
      setMembers(data)
    } catch (error) {
      console.error("Failed to fetch members:", error)
      toast({
        title: "Error",
        description: "Failed to load club members",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFormTeams = async (e: React.FormEvent) => {
    e.preventDefault()
    setAnalyzing(true)

    try {
      // Call team formation API
      const response = await fetch(`/api/clubs/${clubId}/teams/form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirements,
          members: members.map(m => ({
            userId: m.user._id,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
          })),
        }),
      })

      if (!response.ok) throw new Error("Failed to form teams")
      const data = await response.json()
      setSuggestedTeams(data.teams)

      toast({
        title: "Success",
        description: "AI has generated team suggestions based on your requirements",
      })
    } catch (error) {
      console.error("Failed to form teams:", error)
      toast({
        title: "Error",
        description: "Failed to generate team suggestions",
        variant: "destructive",
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleAssignTeams = async () => {
    try {
      const response = await fetch(`/api/clubs/${clubId}/teams/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teams: suggestedTeams,
        }),
      })

      if (!response.ok) throw new Error("Failed to assign teams")

      toast({
        title: "Success",
        description: "Teams have been assigned successfully",
      })

      // Redirect to teams overview
      router.push(`/clubs/${clubId}/teams`)
    } catch (error) {
      console.error("Failed to assign teams:", error)
      toast({
        title: "Error",
        description: "Failed to assign teams",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="container flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">AI Team Formation</h1>
        <p className="text-muted-foreground">
          Let AI help you form optimal teams based on member skills and requirements
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Team Requirements</CardTitle>
            <CardDescription>
              Describe your team requirements, including roles needed, skills required, and any other
              relevant criteria.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFormTeams}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="requirements">Requirements</Label>
                  <Textarea
                    id="requirements"
                    placeholder="Example: Need 3 teams with a mix of technical and creative skills. Each team should have at least one experienced member..."
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    className="h-32"
                  />
                </div>
                <Button type="submit" disabled={analyzing || !requirements}>
                  {analyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate Team Suggestions
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {suggestedTeams.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Suggested Teams</CardTitle>
              <CardDescription>
                Review and assign the AI-generated team suggestions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {suggestedTeams.map((team, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-lg">Team {index + 1}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {team.members.map((member: any) => (
                          <div
                            key={member.userId}
                            className="flex items-center justify-between p-2 rounded-lg bg-secondary"
                          >
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Suggested Role: {member.suggestedRole}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button onClick={handleAssignTeams} className="w-full">
                  <Users className="mr-2 h-4 w-4" />
                  Assign Teams
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}