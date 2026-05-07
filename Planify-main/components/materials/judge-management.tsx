"use client"

import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, UserPlus, Mail } from "lucide-react"
import { usePermissions } from "@/hooks/use-permissions"

interface Judge {
  id: string
  judge_id: string
  judge_name: string
  judge_email: string
  assigned_by_name: string
  assigned_at: string
  status: string
}

interface JudgeManagementProps {
  eventId: string
  eventTitle: string
  judges: Judge[]
  onJudgeAdded: (judge: Judge) => void
  onJudgeRemoved: (judgeId: string) => void
}

export function JudgeManagement({ 
  eventId, 
  eventTitle, 
  judges, 
  onJudgeAdded, 
  onJudgeRemoved 
}: JudgeManagementProps) {
  const [judgeEmail, setJudgeEmail] = useState("")
  const [isAssigning, setIsAssigning] = useState(false)
  const [removingJudgeId, setRemovingJudgeId] = useState<string | null>(null)
  const { toast } = useToast()
  const { canAssignJudge } = usePermissions()

  if (!canAssignJudge) {
    return null
  }

  const handleAssignJudge = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!judgeEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      })
      return
    }

    setIsAssigning(true)

    try {
      const response = await fetch(`/api/events/${eventId}/judges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          judgeEmail: judgeEmail.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to assign judge")
      }

      toast({
        title: "Success!",
        description: `${data.judge_name} has been assigned as a judge for this event`,
        variant: "default",
      })

      onJudgeAdded(data)
      setJudgeEmail("")
    } catch (error) {
      console.error("Error assigning judge:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign judge",
        variant: "destructive",
      })
    } finally {
      setIsAssigning(false)
    }
  }

  const handleRemoveJudge = async (judgeId: string, judgeName: string) => {
    setRemovingJudgeId(judgeId)

    try {
      const response = await fetch(`/api/events/${eventId}/judges/${judgeId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove judge")
      }

      toast({
        title: "Success!",
        description: `${judgeName} has been removed as a judge from this event`,
        variant: "default",
      })

      onJudgeRemoved(judgeId)
    } catch (error) {
      console.error("Error removing judge:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove judge",
        variant: "destructive",
      })
    } finally {
      setRemovingJudgeId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Judge Management
        </CardTitle>
        <CardDescription>
          Assign judges to evaluate material submissions for "{eventTitle}"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Assign Judge Form */}
        <form onSubmit={handleAssignJudge} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="judgeEmail">Judge Email</Label>
            <div className="flex gap-2">
              <Input
                id="judgeEmail"
                type="email"
                placeholder="Enter judge's email address"
                value={judgeEmail}
                onChange={(e) => setJudgeEmail(e.target.value)}
                disabled={isAssigning}
              />
              <Button type="submit" disabled={isAssigning}>
                {isAssigning ? "Assigning..." : "Assign Judge"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              The user will be given judge role and assigned to this event
            </p>
          </div>
        </form>

        {/* Current Judges List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Current Judges</h3>
            <Badge variant="secondary">
              {judges.length} {judges.length === 1 ? "Judge" : "Judges"}
            </Badge>
          </div>
          
          {judges.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No judges assigned yet</p>
              <p className="text-sm">Assign judges to start material evaluation</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {judges.map((judge) => (
                <div
                  key={judge.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserPlus className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{judge.judge_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {judge.judge_email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Assigned by {judge.assigned_by_name} on{" "}
                          {new Date(judge.assigned_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={judge.status === "active" ? "default" : "secondary"}>
                      {judge.status}
                    </Badge>
                    {judge.status === "active" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveJudge(judge.judge_id, judge.judge_name)}
                        disabled={removingJudgeId === judge.judge_id}
                      >
                        {removingJudgeId === judge.judge_id ? (
                          "Removing..."
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}