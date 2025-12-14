"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"

export default function JoinCommunityPage() {
  const [inviteCode, setInviteCode] = useState("")
  const [loading, setLoading] = useState(false)
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Wait for auth to load
    if (authLoading) return
    
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to join a community",
        variant: "destructive",
      })
      router.push("/login")
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/communities/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: inviteCode.trim(),
          userId: user.id,
          userName: user.name,
          userEmail: user.email
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to join community')
      }

      const data = await response.json()

      toast({
        title: "Community joined",
        description: `You have successfully joined ${data.communityName || 'the community'}.`,
      })

      router.push(`/communities/${data.communityId}`)
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to join community. Please check your invite code and try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-6">Join a Community</h1>

        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Enter Invite Code</CardTitle>
              <CardDescription>Enter the invite code you received to join a community</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inviteCode">Invite Code</Label>
                <Input
                  id="inviteCode"
                  placeholder="Enter invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !inviteCode.trim()}>
                {loading ? "Joining..." : "Join Community"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}

