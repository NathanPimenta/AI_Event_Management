'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface MaterialRequest {
  id: string
  title: string
  description: string
  material_type: string
  file_format_allowed: string
  max_file_size_mb: number
  due_date: string
  is_mandatory: boolean
  status: string
  submission_count: number
  creator_name: string
}

interface MaterialRequestsManagerProps {
  eventId: string
  isAdmin: boolean
}

export function MaterialRequestsManager({
  eventId,
  isAdmin,
}: MaterialRequestsManagerProps) {
  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    material_type: 'ppt',
    file_format_allowed: '.ppt,.pptx,.pdf',
    max_file_size_mb: '50',
    due_date: '',
    is_mandatory: true,
  })

  useEffect(() => {
    fetchRequests()
  }, [eventId])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/events/${eventId}/materials?status=active`
      )
      if (!response.ok) throw new Error('Failed to fetch requests')
      const data = await response.json()
      setRequests(data)
    } catch (error) {
      console.error('Error fetching requests:', error)
      toast({
        title: 'Error',
        description: 'Failed to load material requests',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch(`/api/events/${eventId}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          max_file_size_mb: parseInt(formData.max_file_size_mb),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create request')
      }

      toast({
        title: 'Success',
        description: 'Material request created successfully',
      })
      setFormData({
        title: '',
        description: '',
        material_type: 'ppt',
        file_format_allowed: '.ppt,.pptx,.pdf',
        max_file_size_mb: '50',
        due_date: '',
        is_mandatory: true,
      })
      setShowForm(false)
      fetchRequests()
    } catch (error) {
      console.error('Error creating request:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create request',
        variant: 'destructive',
      })
    }
  }

  const handleSelectRequest = (request: MaterialRequest) => {
    setSelectedRequest(request)
  }

  if (!isAdmin) {
    return <div className="text-muted-foreground">Only event organizers can manage material requests</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Material Requests</h3>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
            Create Request
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-800 p-6 rounded-lg space-y-4 border border-slate-700">
          <h4 className="font-semibold">Create Material Request</h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g., Submit Presentation Slides"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what you're requesting"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="material_type">Material Type</Label>
                <select
                  id="material_type"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  value={formData.material_type}
                  onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
                >
                  <option value="ppt">Presentation (PPT)</option>
                  <option value="document">Document</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label htmlFor="file_format_allowed">File Formats Allowed</Label>
                <Input
                  id="file_format_allowed"
                  placeholder=".ppt,.pptx,.pdf"
                  value={formData.file_format_allowed}
                  onChange={(e) => setFormData({ ...formData, file_format_allowed: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="max_file_size_mb">Max File Size (MB)</Label>
                <Input
                  id="max_file_size_mb"
                  type="number"
                  value={formData.max_file_size_mb}
                  onChange={(e) => setFormData({ ...formData, max_file_size_mb: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="datetime-local"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="is_mandatory"
                type="checkbox"
                checked={formData.is_mandatory}
                onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="is_mandatory">Mandatory Submission</Label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                Create Request
              </Button>
              <Button
                type="button"
                onClick={() => setShowForm(false)}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="text-muted-foreground">Loading requests...</p>
        ) : requests.length === 0 ? (
          <p className="text-muted-foreground">No active material requests</p>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="bg-slate-800 p-4 rounded-lg border border-slate-700 cursor-pointer hover:border-slate-600 transition"
              onClick={() => handleSelectRequest(request)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-white">{request.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{request.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span>Type: {request.material_type}</span>
                    <span>Format: {request.file_format_allowed}</span>
                    <span>Max Size: {request.max_file_size_mb}MB</span>
                    {request.due_date && (
                      <span>Due: {new Date(request.due_date).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-400">{request.submission_count}</div>
                  <div className="text-xs text-muted-foreground">submissions</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedRequest && (
        <SubmissionsViewer
          eventId={eventId}
          requestId={selectedRequest.id}
          requestTitle={selectedRequest.title}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </div>
  )
}

function SubmissionsViewer({
  eventId,
  requestId,
  requestTitle,
  onClose,
}: {
  eventId: string
  requestId: string
  requestTitle: string
  onClose: () => void
}) {
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchSubmissions()
  }, [requestId])

  const fetchSubmissions = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/events/${eventId}/materials/${requestId}/submissions`
      )
      if (!response.ok) throw new Error('Failed to fetch submissions')
      const data = await response.json()
      setSubmissions(data)
    } catch (error) {
      console.error('Error fetching submissions:', error)
      toast({
        title: 'Error',
        description: 'Failed to load submissions',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const response = await fetch(filePath)
      if (!response.ok) throw new Error('Failed to download')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download file',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Submissions for: {requestTitle}</h3>
          <Button onClick={onClose} variant="ghost">
            ✕
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading submissions...</p>
        ) : submissions.length === 0 ? (
          <p className="text-muted-foreground">No submissions yet</p>
        ) : (
          <div className="space-y-3">
            {submissions.map((submission) => (
              <div
                key={submission.id}
                className="bg-slate-800 p-3 rounded border border-slate-700 flex items-center justify-between"
              >
                <div className="flex-1">
                  <p className="font-medium">{submission.attendee_name}</p>
                  <p className="text-sm text-muted-foreground">{submission.attendee_email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {submission.original_filename} ({(submission.file_size_bytes / 1024).toFixed(2)} KB)
                  </p>
                  <p className="text-xs text-green-400">
                    Uploaded: {new Date(submission.uploaded_at).toLocaleDateString()} at{' '}
                    {new Date(submission.uploaded_at).toLocaleTimeString()}
                  </p>
                </div>
                <Button
                  onClick={() =>
                    downloadFile(submission.file_path, submission.original_filename)
                  }
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Download
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
