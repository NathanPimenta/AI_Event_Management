"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { 
  TrophyIcon, 
  MedalIcon, 
  StarIcon, 
  UsersIcon, 
  TrendingUpIcon,
  EyeIcon
} from "lucide-react"
import { usePermissions } from "@/hooks/use-permissions"
import Link from "next/link"

interface ParticipantScore {
  id: string
  participant_id: string
  participant_name: string
  participant_email: string
  total_score: number
  material_score: number
  bonus_score: number
  penalty_score: number
  judge_count: number
  rank: number
  scored_submissions: number
  avg_material_score: number
}

interface ScoreStatistics {
  total_participants: number
  avg_score: number
  max_score: number
  min_score: number
  scored_participants: number
}

interface ScoreLeaderboardProps {
  eventId: string
  eventTitle: string
}

export function ScoreLeaderboard({ eventId, eventTitle }: ScoreLeaderboardProps) {
  const [participants, setParticipants] = useState<ParticipantScore[]>([])
  const [statistics, setStatistics] = useState<ScoreStatistics | null>(null)
  const [judgeCount, setJudgeCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { canViewScores } = usePermissions()

  useEffect(() => {
    if (!canViewScores) {
      setError("You don't have permission to view scores")
      setLoading(false)
      return
    }

    fetchScores()
  }, [eventId, canViewScores])

  const fetchScores = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/scores`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch scores")
      }

      setParticipants(data.participants || [])
      setStatistics(data.statistics)
      setJudgeCount(data.judgeCount || 0)
    } catch (error) {
      console.error("Error fetching scores:", error)
      setError(error instanceof Error ? error.message : "Failed to load scores")
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <TrophyIcon className="h-6 w-6 text-yellow-500" />
      case 2:
        return <MedalIcon className="h-6 w-6 text-gray-400" />
      case 3:
        return <MedalIcon className="h-6 w-6 text-amber-600" />
      default:
        return <div className="h-6 w-6 flex items-center justify-center text-sm font-bold text-muted-foreground">#{rank}</div>
    }
  }

  const getRankBadgeVariant = (rank: number) => {
    switch (rank) {
      case 1:
        return "default" as const
      case 2:
        return "secondary" as const
      case 3:
        return "outline" as const
      default:
        return "outline" as const
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <Card>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scores & Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!canViewScores) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex items-center p-6">
              <UsersIcon className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Participants</p>
                <p className="text-2xl font-bold">{statistics.total_participants}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <TrendingUpIcon className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Average Score</p>
                <p className="text-2xl font-bold">{statistics.avg_score?.toFixed(1) || '0.0'}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <TrophyIcon className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Highest Score</p>
                <p className="text-2xl font-bold">{statistics.max_score?.toFixed(1) || '0.0'}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <StarIcon className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Judges</p>
                <p className="text-2xl font-bold">{judgeCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrophyIcon className="h-5 w-5" />
            Leaderboard - {eventTitle}
          </CardTitle>
          <CardDescription>
            Rankings based on material submissions and judge scores
          </CardDescription>
        </CardHeader>
        <CardContent>
          {participants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrophyIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No scores available yet</p>
              <p className="text-sm">Scores will appear as judges evaluate submissions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {participants.map((participant, index) => (
                <div key={participant.id}>
                  {index > 0 && <Separator />}
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4 flex-1">
                      {/* Rank */}
                      <div className="flex items-center gap-2">
                        {getRankIcon(participant.rank)}
                        <Badge variant={getRankBadgeVariant(participant.rank)}>
                          Rank #{participant.rank}
                        </Badge>
                      </div>

                      {/* Participant Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {participant.participant_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{participant.participant_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {participant.participant_email}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {participant.scored_submissions} submissions
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {participant.judge_count} judges
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Score Details */}
                      <div className="text-right space-y-2 min-w-[200px]">
                        <div className="text-2xl font-bold text-primary">
                          {participant.total_score.toFixed(1)}
                        </div>
                        
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>Material: {participant.material_score.toFixed(1)}</div>
                          {participant.bonus_score > 0 && (
                            <div className="text-green-600">
                              Bonus: +{participant.bonus_score.toFixed(1)}
                            </div>
                          )}
                          {participant.penalty_score > 0 && (
                            <div className="text-red-600">
                              Penalty: -{participant.penalty_score.toFixed(1)}
                            </div>
                          )}
                        </div>
                        
                        {statistics && statistics.max_score > 0 && (
                          <Progress 
                            value={(participant.total_score / statistics.max_score) * 100} 
                            className="w-full"
                          />
                        )}
                      </div>

                      {/* View Details Button */}
                      <div>
                        <Link href={`/events/${eventId}/scores/${participant.participant_id}`}>
                          <Button variant="outline" size="sm">
                            <EyeIcon className="h-4 w-4 mr-2" />
                            Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}