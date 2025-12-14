"use client"

import React, { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { PDFDocument, StandardFonts } from "pdf-lib"

type TeamResult = any

export default function TeamFormation() {
  const [requirementsFile, setRequirementsFile] = useState<File | null>(null)
  const [participantsFile, setParticipantsFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TeamResult | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const requirementsRef = useRef<HTMLInputElement | null>(null)
  const participantsRef = useRef<HTMLInputElement | null>(null)

  function downloadJsonTemplate() {
    const jsonContent = {
      event_name: "Tech Conference 2025",
      roles: [
        { role_id: "REG", role_name: "Registration Desk", required_skills: ["Communication", "Organization"], quantity_needed: 4, priority: "High", shift_time: "Morning" }
      ]
    }
    const blob = new Blob([JSON.stringify(jsonContent, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "event_requirements_template.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadCsvTemplate() {
    const csvContent = "participant_id,name,year,past_events,availability,Communication,Organization,AV Setup,Troubleshooting\nP1,Alice Johnson,3,2,Morning,3,2,1,0"
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "participants_template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleOptimize() {
    setError(null)
    setLoading(true)
    setResult(null)

    try {
      if (!requirementsFile || !participantsFile) {
        setError("Please upload both files.")
        setLoading(false)
        return
      }

      const fd = new FormData()
      fd.append("requirements_file", requirementsFile)
      fd.append("participants_file", participantsFile)

      const res = await fetch("/api/team-formation/proxy", {
        method: "POST",
        body: fd
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || body.error || `Status ${res.status}`)
      }

      const data = await res.json()
      const final = data.data || data
      setResult(final)
      // Generate PDF preview
      try {
        const bytes = await createPdfFromResult(final)
        const blob = new Blob([bytes], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        // revoke previous URL if any
        if (pdfUrl) URL.revokeObjectURL(pdfUrl)
        setPdfUrl(url)
      } catch (e) {
        console.error('PDF generation failed', e)
      }
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  async function createPdfFromResult(data: any) {
    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage()
    const { height } = page.getSize()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontSize = 12
    let y = height - 48

    const lines = formatResultLines(data)

    for (const line of lines) {
      const wrapped = wrapText(line, 90)
      for (const txt of wrapped) {
        if (y < 48) {
          page = pdfDoc.addPage()
          y = page.getSize().height - 48
        }
        page.drawText(txt, { x: 48, y, size: fontSize, font })
        y -= fontSize + 6
      }
    }

    const pdfBytes = await pdfDoc.save()
    return pdfBytes
  }

  function formatResultLines(data: any) {
    const lines: string[] = []
    if (data.event_name) lines.push(`Event: ${data.event_name}`)
    if (data.fitness_score !== undefined) lines.push(`Fitness Score: ${data.fitness_score}`)
    if (data.teams && Array.isArray(data.teams)) {
      lines.push('')
      lines.push('Teams:')
      for (const team of data.teams) {
        lines.push(`- ${team.name} (${team.role_id || ''})`)
        if (team.members && Array.isArray(team.members)) {
          for (const m of team.members) {
            lines.push(`    • ${m.name} — ${m.role} — ${m.experience || ''}`)
          }
        }
      }
    } else if (data.roles) {
      lines.push('')
      lines.push('Roles:')
      for (const roleId in data.roles) {
        const r = data.roles[roleId]
        lines.push(`- ${r.role_name} (${r.quantity_assigned || 0}/${r.quantity_needed})`)
        if (r.assigned_participants) {
          for (const p of r.assigned_participants) {
            lines.push(`    • ${p.name} — ${p.past_events || ''} past events`)
          }
        }
      }
    } else {
      lines.push(JSON.stringify(data, null, 2))
    }
    return lines
  }

  function wrapText(text: string, maxLen: number) {
    const parts: string[] = []
    let s = text
    while (s.length > maxLen) {
      let cut = s.lastIndexOf(' ', maxLen)
      if (cut === -1) cut = maxLen
      parts.push(s.slice(0, cut))
      s = s.slice(cut + (s[cut] === ' ' ? 1 : 0))
    }
    if (s.length) parts.push(s)
    return parts
  }

  function downloadResults() {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "optimal_teams.json"
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold">Team Formation Optimizer</h1>
        <p className="mt-4 text-lg text-muted-foreground">Upload your data to automatically form the best possible teams using a Genetic Algorithm.</p>
      </div>

      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 rounded-lg border-2 border-dashed">
            <h3 className="font-semibold">1. Event Requirements</h3>
            <p className="text-sm text-muted-foreground">event_requirements.json (Required)</p>
            <input ref={requirementsRef} type="file" accept=".json" hidden onChange={e => setRequirementsFile(e.target.files?.[0] ?? null)} />
            <button onClick={() => requirementsRef.current?.click()} className="mt-3 w-full p-3 bg-slate-800 rounded">{requirementsFile ? requirementsFile.name : 'Upload JSON'}</button>
            <button onClick={downloadJsonTemplate} className="mt-2 text-sm text-blue-400">Download template</button>
          </div>

          <div className="p-4 rounded-lg border-2 border-dashed">
            <h3 className="font-semibold">2. Participant Data</h3>
            <p className="text-sm text-muted-foreground">participants.csv (Required)</p>
            <input ref={participantsRef} type="file" accept=".csv" hidden onChange={e => setParticipantsFile(e.target.files?.[0] ?? null)} />
            <button onClick={() => participantsRef.current?.click()} className="mt-3 w-full p-3 bg-slate-800 rounded">{participantsFile ? participantsFile.name : 'Upload CSV'}</button>
            <button onClick={downloadCsvTemplate} className="mt-2 text-sm text-blue-400">Download template</button>
          </div>
        </div>

        <div className="text-center mt-6">
          <Button disabled={!requirementsFile || !participantsFile || loading} onClick={handleOptimize} size="lg">
            {loading ? 'Running...' : 'Run Optimization'}
          </Button>
          {error && <p className="text-red-400 mt-3">{error}</p>}
        </div>
      </div>

      {result && (
        <div className="card p-6 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Optimal Team Assignments</h3>
            <div className="flex items-center gap-2">
              {pdfUrl && (
                <a href={pdfUrl} download="optimal_teams.pdf">
                  <Button variant="secondary" size="sm">Download PDF</Button>
                </a>
              )}
              <Button onClick={() => { if (pdfUrl) { URL.revokeObjectURL(pdfUrl) }; setResult(null); setPdfUrl(null) }} variant="ghost" size="sm">Start New</Button>
            </div>
          </div>

          {pdfUrl ? (
            <iframe src={pdfUrl} style={{ width: '100%', height: 600 }} title="Optimization PDF" />
          ) : (
            <pre className="text-sm overflow-auto max-h-96">{JSON.stringify(result, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  )
}
