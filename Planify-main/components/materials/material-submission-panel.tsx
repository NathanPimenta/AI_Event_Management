'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface UserSubmission {
  request_id: string
  title: string
  description: string
  material_type: string
  file_format_allowed: string
  max_file_size_mb: number
  due_date: string
  is_mandatory: boolean
  created_by_name: string
  submission_id: string | null
  file_name: string | null
  file_path: string | null
  original_filename: string | null
  uploaded_at: string | null
  file_size_bytes: number | null
  has_submitted: boolean
  is_pending: boolean
  status: 'submitted' | 'overdue' | 'pending'
}

interface MaterialSubmissionPanelProps {
  eventId: string
}

export function MaterialSubmissionPanel({ eventId }: MaterialSubmissionPanelProps) {
  const [submissions, setSubmissions] = useState<UserSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchSubmissions()
  }, [eventId])

  const fetchSubmissions = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/events/${eventId}/materials/my-submissions`)
      if (!response.ok) {
        if (response.status === 401) {
          return // Not logged in — silently skip
        }
        if (response.status === 403) {
          return // User not registered for event — silently skip
        }
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Failed to fetch submissions (${response.status})`)
      }
      const data = await response.json()
      setSubmissions(data)
    } catch (error) {
      console.error('Error fetching submissions:', error)
      toast({
        title: 'Error',
        description: 'Failed to load material requests',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (
    requestId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    const request = submissions.find((s) => s.request_id === requestId)
    if (!request) return

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > request.max_file_size_mb) {
      toast({
        title: 'Error',
        description: `File size exceeds limit of ${request.max_file_size_mb}MB`,
        variant: 'destructive',
      })
      return
    }

    // Validate file format
    if (request.file_format_allowed) {
      const allowedFormats = request.file_format_allowed
        .split(',')
        .map((f) => f.trim().toLowerCase())
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!allowedFormats.includes(fileExt)) {
        toast({
          title: 'Error',
          description: `File format not allowed. Allowed formats: ${request.file_format_allowed}`,
          variant: 'destructive',
        })
        return
      }
    }

    try {
      setUploadingId(requestId)
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(
        `/api/events/${eventId}/materials/${requestId}/submissions`,
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload file')
      }

      toast({
        title: 'Success',
        description: 'Material uploaded successfully',
      })

      fetchSubmissions()
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload file',
        variant: 'destructive',
      })
    } finally {
      setUploadingId(null)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-green-900 text-green-200'
      case 'pending':
        return 'bg-blue-900 text-blue-200'
      case 'overdue':
        return 'bg-red-900 text-red-200'
      default:
        return 'bg-gray-900 text-gray-200'
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading material requests...</div>
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No material requests for this event
      </div>
    )
  }

  const submittedCount = submissions.filter((s) => s.has_submitted).length
  const mandatoryCount = submissions.filter((s) => s.is_mandatory).length

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Materials Submitted</p>
            <p className="text-2xl font-bold">
              {submittedCount} / {submissions.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Mandatory</p>
            <p className="text-2xl font-bold text-blue-400">{mandatoryCount}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {submissions.map((submission) => (
          <div
            key={submission.request_id}
            className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden"
          >
            <button
              onClick={() =>
                setExpandedId(
                  expandedId === submission.request_id ? null : submission.request_id
                )
              }
              className="w-full p-4 flex items-start justify-between hover:bg-slate-700/50 transition text-left"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h4 className="font-semibold text-white">{submission.title}</h4>
                  <span
                    className={`text-xs px-2 py-1 rounded ${getStatusBadgeColor(
                      submission.status
                    )}`}
                  >
                    {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                  </span>
                  {submission.is_mandatory && (
                    <span className="text-xs px-2 py-1 rounded bg-red-900 text-red-200">
                      Mandatory
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {submission.description}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>Type: {submission.material_type}</span>
                  <span>•</span>
                  <span>Max Size: {submission.max_file_size_mb}MB</span>
                  {submission.due_date && (
                    <>
                      <span>•</span>
                      <span>
                        Due: {new Date(submission.due_date).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="ml-4">
                <svg
                  className={`w-5 h-5 transition transform ${expandedId === submission.request_id ? 'rotate-180' : ''
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

            {expandedId === submission.request_id && (
              <div className="border-t border-slate-700 p-4 space-y-4">
                {submission.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Description
                    </p>
                    <p className="text-sm text-white">{submission.description}</p>
                  </div>
                )}

                {submission.file_format_allowed && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Allowed Formats
                    </p>
                    <p className="text-sm text-white">{submission.file_format_allowed}</p>
                  </div>
                )}

                {submission.has_submitted && submission.file_name ? (
                  <div className="bg-green-900/20 p-3 rounded border border-green-700/50">
                    <p className="text-sm font-medium text-green-200 mb-2">
                      ✓ Submitted
                    </p>
                    <div className="text-sm text-green-100">
                      <p>File: {submission.original_filename}</p>
                      <p className="text-xs text-green-200/70">
                        Size: {(submission.file_size_bytes! / 1024).toFixed(2)} KB
                      </p>
                      <p className="text-xs text-green-200/70">
                        Uploaded:{' '}
                        {new Date(submission.uploaded_at!).toLocaleDateString()} at{' '}
                        {new Date(submission.uploaded_at!).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="bg-green-700 hover:bg-green-600"
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
                      <Label
                        htmlFor={`file-${submission.request_id}`}
                        className="text-sm px-3 py-2 rounded bg-blue-700 hover:bg-blue-600 cursor-pointer inline-flex items-center"
                      >
                        Replace File
                      </Label>
                      <Input
                        id={`file-${submission.request_id}`}
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileUpload(submission.request_id, e)}
                        disabled={uploadingId === submission.request_id}
                      />
                    </div>
                  </div>
                ) : submission.status === 'overdue' ? (
                  <div className="bg-red-900/20 p-3 rounded border border-red-700/50">
                    <p className="text-sm font-medium text-red-200">
                      ✗ Overdue - Submission Closed
                    </p>
                    <p className="text-xs text-red-100 mt-1">
                      Due date: {new Date(submission.due_date).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label
                      htmlFor={`file-${submission.request_id}`}
                      className="block w-full p-3 text-center rounded bg-blue-700 hover:bg-blue-600 cursor-pointer font-medium transition"
                    >
                      {uploadingId === submission.request_id
                        ? 'Uploading...'
                        : 'Choose File to Upload'}
                    </Label>
                    <Input
                      id={`file-${submission.request_id}`}
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileUpload(submission.request_id, e)}
                      disabled={uploadingId === submission.request_id}
                    />
                    <p className="text-xs text-muted-foreground">
                      Formats: {submission.file_format_allowed || 'Any'} | Max:{' '}
                      {submission.max_file_size_mb}MB
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
