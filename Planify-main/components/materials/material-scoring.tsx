"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { StarIcon, FileIcon, DownloadIcon, CheckCircleIcon } from "lucide-react"
import { usePermissions } from "@/hooks/use-permissions"

interface MaterialSubmission {
  id: string
  participant_name: string
  participant_email: string
  submission_type: string
  file_url: string
  description: string
  submitted_at: string
  request_title: string
  scored: boolean
}

interface MaterialScore {
  id: string
  score: number
  max_score: number
  feedback: string
  criteria_scores: Record<string, number>
  judge_name: string
  scored_at: string
}

interface MaterialScoringProps {
  eventId: string
  material: MaterialSubmission
  onScoreSubmitted: () => void
}

export function MaterialScoring({ 
  eventId, 
  material, 
  onScoreSubmitted 
}: MaterialScoringProps) {
  const [score, setScore] = useState<number>(0)
  const [maxScore, setMaxScore] = useState<number>(100)
  const [feedback, setFeedback] = useState("")
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingScores, setExistingScores] = useState<MaterialScore[]>([])
  const [loadingScores, setLoadingScores] = useState(true)
  const { toast } = useToast()
  const { canScore, isJudge } = usePermissions()

  // Common scoring criteria
  const defaultCriteria = [
    { key: "content_quality", label: "Content Quality", maxPoints: 25 },
    { key: "presentation", label: "Presentation/Format", maxPoints: 20 },
    { key: "creativity", label: "Creativity/Innovation", maxPoints: 25 },
    { key: "technical_accuracy", label: "Technical Accuracy", maxPoints: 20 },
    { key: "clarity", label: "Clarity & Organization", maxPoints: 10 }
  ]

  // Fetch existing scores for this submission
  useEffect(() => {
    fetchExistingScores()
  }, [material.id])

  const fetchExistingScores = async () => {
    try {
      setLoadingScores(true)
      const response = await fetch(`/api/events/${eventId}/materials/${material.id}/scores`)
      if (response.ok) {
        const scores = await response.json()
        setExistingScores(scores)
      }
    } catch (error) {
      console.error('Error fetching existing scores:', error)
    } finally {
      setLoadingScores(false)
    }
  }

  // Check if current user has already scored this submission
  const currentUserScore = existingScores.find(score => 
    // For now, we'll allow multiple scores - in a real app you'd check against current user ID
    false
  )

  useEffect(() => {
    // Initialize criteria scores
    const initialCriteria: Record<string, number> = {}
    defaultCriteria.forEach(criteria => {
      initialCriteria[criteria.key] = 0
    })
    setCriteriaScores(initialCriteria)
    
    // If editing existing score, populate form
    if (currentUserScore) {
      setScore(currentUserScore.score)
      setMaxScore(currentUserScore.max_score)
      setFeedback(currentUserScore.feedback || "")
      setCriteriaScores(currentUserScore.criteria_scores || initialCriteria)
    }
  }, [currentUserScore])

  // Calculate total score from criteria
  useEffect(() => {
    const total = Object.values(criteriaScores).reduce((sum, value) => sum + value, 0)
    setScore(total)
  }, [criteriaScores])

  if (!canScore || !isJudge) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Material Scoring</CardTitle>
          <CardDescription>Only judges can score material submissions</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const handleCriteriaChange = (key: string, value: number) => {
    setCriteriaScores(prev => ({
      ...prev,
      [key]: Math.min(Math.max(0, value), defaultCriteria.find(c => c.key === key)?.maxPoints || 100)
    }))
  }

  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (score < 0 || score > maxScore) {
      toast({
        title: "Invalid Score",
        description: `Score must be between 0 and ${maxScore}`,
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(
        `/api/events/${eventId}/materials/${material.id}/scores`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            score,
            maxScore,
            feedback: feedback.trim() || null,
            criteriaScores,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit score")
      }

      toast({
        title: "Success!",
        description: currentUserScore ? "Score updated successfully" : "Score submitted successfully",
        variant: "default",
      })

      onScoreSubmitted()
    } catch (error) {
      console.error("Error submitting score:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit score",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Byte'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Submission Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileIcon className="h-5 w-5" />
            Material Submission Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Participant</Label>
              <p className="text-sm">{material.participant_name}</p>
              <p className="text-xs text-muted-foreground">{material.participant_email}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Submission Type</Label>
              <p className="text-sm">{material.request_title}</p>
              <Badge variant="outline">{material.submission_type}</Badge>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">File</Label>
              <p className="text-sm">{material.description}</p>
              <p className="text-xs text-muted-foreground">
                Uploaded {new Date(material.submitted_at).toLocaleDateString()}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                <DownloadIcon className="h-4 w-4 mr-2" />
                View File
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Scores */}
      {existingScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Existing Scores</CardTitle>
            <CardDescription>
              Scores from other judges ({existingScores.length} total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {existingScores.map((scoreData) => (
                <div key={scoreData.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{scoreData.judge_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Scored {new Date(scoreData.scored_at).toLocaleDateString()}
                    </p>
                    {scoreData.feedback && (
                      <p className="text-sm mt-1 italic">"{scoreData.feedback}"</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {scoreData.score}/{scoreData.max_score}
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <StarIcon
                          key={i}
                          className={`h-3 w-3 ${
                            i < (scoreData.score / scoreData.max_score) * 5
                              ? "text-yellow-500 fill-current"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scoring Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StarIcon className="h-5 w-5" />
            {currentUserScore ? "Update Your Score" : "Submit Score"}
          </CardTitle>
          <CardDescription>
            Evaluate this submission based on the criteria below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitScore} className="space-y-6">
            {/* Criteria-based Scoring */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Scoring Criteria</Label>
              {defaultCriteria.map((criteria) => (
                <div key={criteria.key} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor={criteria.key}>{criteria.label}</Label>
                    <span className="text-sm text-muted-foreground">
                      Max: {criteria.maxPoints} points
                    </span>
                  </div>
                  <Input
                    id={criteria.key}
                    type="number"
                    min="0"
                    max={criteria.maxPoints}
                    value={criteriaScores[criteria.key] || 0}
                    onChange={(e) => handleCriteriaChange(criteria.key, parseInt(e.target.value) || 0)}
                    className="w-full"
                  />
                </div>
              ))}
            </div>

            <Separator />

            {/* Total Score Display */}
            <div className="bg-primary/5 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">Total Score</Label>
                <div className="text-2xl font-bold text-primary">
                  {score}/{maxScore}
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    className={`h-5 w-5 ${
                      i < (score / maxScore) * 5
                        ? "text-yellow-500 fill-current"
                        : "text-gray-300"
                    }`}
                  />
                ))}
                <span className="ml-2 text-sm text-muted-foreground">
                  {((score / maxScore) * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Feedback */}
            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback (Optional)</Label>
              <Textarea
                id="feedback"
                placeholder="Provide constructive feedback for the participant..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            {/* Submit Button */}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                "Submitting..."
              ) : currentUserScore ? (
                <>
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  Update Score
                </>
              ) : (
                <>
                  <StarIcon className="h-4 w-4 mr-2" />
                  Submit Score
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}