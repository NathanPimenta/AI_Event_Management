'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AttendeeSubmissionSummary {
  attendee_id: string
  name: string
  email: string
  registered_at: string
  submissions: Array<{
    request_id: string
    request_title: string
    material_type: string
    due_date: string
    is_mandatory: boolean
    submission_id: string | null
    file_name: string | null
    file_path: string | null
    original_filename: string | null
    uploaded_at: string | null
    file_size_bytes: number | null
    submitted: boolean
  }>
}

interface AttendeeSubmissionReportProps {
  eventId: string
  isAdmin: boolean
}

export function AttendeeSubmissionReport({
  eventId,
  isAdmin,
}: AttendeeSubmissionReportProps) {
  const [attendees, setAttendees] = useState<AttendeeSubmissionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedAttendee, setExpandedAttendee] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (isAdmin) {
      fetchSubmissionSummary()
    }
  }, [eventId, isAdmin])

  const fetchSubmissionSummary = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/events/${eventId}/materials/submissions/summary`
      )
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: 'Unauthorized',
            description: 'Please log in to view submission reports',
            variant: 'destructive',
          })
          return
        }
        if (response.status === 403) {
          toast({
            title: 'Access Denied',
            description: 'Only event organizers can view this report',
            variant: 'destructive',
          })
          return
        }
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Failed to fetch submission summary (${response.status})`)
      }
      const data = await response.json()
      setAttendees(data)
    } catch (error) {
      console.error('Error fetching submission summary:', error)
      toast({
        title: 'Error',
        description: 'Failed to load submission summary',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredAttendees = attendees.filter((a) =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getSubmissionStats = (attendee: AttendeeSubmissionSummary) => {
    const total = attendee.submissions.length
    const submitted = attendee.submissions.filter((s) => s.submitted).length
    const mandatory = attendee.submissions.filter((s) => s.is_mandatory).length
    const mandatorySubmitted = attendee.submissions.filter(
      (s) => s.is_mandatory && s.submitted
    ).length

    return { total, submitted, mandatory, mandatorySubmitted }
  }

  if (!isAdmin) {
    return (
      <div className="text-muted-foreground">
        Only event organizers can view submission reports
      </div>
    )
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading submission report...</div>
  }

  if (attendees.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No attendees or material requests found
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Attendee Submission Report</h3>
        <Button
          onClick={fetchSubmissionSummary}
          variant="outline"
          size="sm"
        >
          Refresh
        </Button>
      </div>

      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
        <Input
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-slate-700 border-slate-600"
        />
      </div>

      <div className="overflow-x-auto">
        <div className="space-y-2">
          {filteredAttendees.map((attendee) => {
            const stats = getSubmissionStats(attendee)
            const completionPercentage = Math.round(
              (stats.submitted / stats.total) * 100
            )
            const mandatoryPercentage = Math.round(
              (stats.mandatorySubmitted / stats.mandatory) * 100
            )

            return (
              <div
                key={attendee.attendee_id}
                className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedAttendee(
                      expandedAttendee === attendee.attendee_id
                        ? null
                        : attendee.attendee_id
                    )
                  }
                  className="w-full p-4 flex items-start justify-between hover:bg-slate-700/50 transition text-left"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-white">{attendee.name}</h4>
                    <p className="text-sm text-muted-foreground">{attendee.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Registered:{' '}
                      {new Date(attendee.registered_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {stats.submitted}/{stats.total} materials
                      </p>
                      <div className="w-32 h-2 bg-slate-700 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition"
                          style={{ width: `${completionPercentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {completionPercentage}%
                      </p>
                    </div>
                    {stats.mandatory > 0 && (
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {stats.mandatorySubmitted}/{stats.mandatory} mandatory
                        </p>
                        <div className="w-32 h-2 bg-slate-700 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition ${mandatoryPercentage === 100
                                ? 'bg-green-500'
                                : 'bg-red-500'
                              }`}
                            style={{ width: `${mandatoryPercentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {mandatoryPercentage}%
                        </p>
                      </div>
                    )}
                    <svg
                      className={`w-5 h-5 transition transform ${expandedAttendee === attendee.attendee_id
                          ? 'rotate-180'
                          : ''
                        }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </div>
                </button>

                {expandedAttendee === attendee.attendee_id && (
                  <div className="border-t border-slate-700 p-4">
                    <div className="space-y-2">
                      {attendee.submissions.map((submission, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded border flex items-start justify-between ${submission.submitted
                              ? 'bg-green-900/20 border-green-700/50'
                              : 'bg-slate-700/30 border-slate-600/50'
                            }`}
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {submission.request_title}
                              {submission.is_mandatory && (
                                <span className="ml-2 text-xs px-2 py-1 rounded bg-red-900 text-red-200">
                                  Mandatory
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Type: {submission.material_type}
                            </p>
                            {submission.due_date && (
                              <p className="text-xs text-muted-foreground">
                                Due:{' '}
                                {new Date(submission.due_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            {submission.submitted ? (
                              <div className="space-y-1">
                                <p className="text-xs text-green-400 font-medium">
                                  ✓ Submitted
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {submission.original_filename}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {(
                                    submission.file_size_bytes! / 1024
                                  ).toFixed(2)}{' '}
                                  KB
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(
                                    submission.uploaded_at!
                                  ).toLocaleDateString()}
                                </p>
                                {submission.file_path && (
                                  <Button
                                    size="sm"
                                    className="mt-2 bg-blue-700 hover:bg-blue-600"
                                    onClick={() => {
                                      const a = document.createElement('a')
                                      a.href = submission.file_path!
                                      a.download = submission.original_filename!
                                      document.body.appendChild(a)
                                      a.click()
                                      document.body.removeChild(a)
                                    }}
                                  >
                                    Download
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-red-400">✗ Not submitted</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
