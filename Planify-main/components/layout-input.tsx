"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Play } from "lucide-react"

interface LayoutInputProps {
    onVisualize: (data: any) => void
}

const DEFAULT_JSON = `{
  "venue": {
    "width": 100,
    "length": 80,
    "unit": "ft"
  },
  "objects": [
    {
      "id": "stage-main",
      "type": "stage",
      "x": 35,
      "y": 5,
      "width": 30,
      "height": 12,
      "label": "Keynote Stage",
      "members": [
         { "name": "Sarah Connor", "role": "Speaker" },
         { "name": "John Smith", "role": "Host" }
      ]
    },
    {
      "id": "table-1",
      "type": "round-table",
      "x": 20,
      "y": 30,
      "radius": 6,
      "label": "Team Alpha",
      "members": [
         { "name": "Alice Chen", "role": "Lead" },
         { "name": "Bob Miles", "role": "Developer" },
         { "name": "Charlie Day", "role": "Designer" }
      ]
    },
    {
      "id": "table-2",
      "type": "round-table",
      "x": 45,
      "y": 30,
      "radius": 6,
      "label": "Team Beta",
      "members": [
         { "name": "Dave Grohl", "role": "Manager" },
         { "name": "Eve Polastri", "role": "Analyst" }
      ]
    },
    {
       "id": "booth-1",
       "type": "booth",
       "x": 75,
       "y": 20,
       "width": 10,
       "height": 8,
       "label": "Registration",
        "members": [
         { "name": "Greg House", "role": "Volunteer" }
      ]
    }
  ]
}`

export function LayoutInput({ onVisualize }: LayoutInputProps) {
    const [input, setInput] = useState(DEFAULT_JSON)
    const [error, setError] = useState<string | null>(null)

    const handleVisualize = () => {
        try {
            const parsed = JSON.parse(input)
            // Basic validation
            if (!parsed.venue || !parsed.objects) {
                throw new Error("Missing 'venue' or 'objects' field")
            }
            setError(null)
            onVisualize(parsed)
        } catch (e: any) {
            setError(e.message || "Invalid JSON")
        }
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Configuration</h3>
                <Button onClick={handleVisualize} size="sm" className="gap-2">
                    <Play className="w-3 h-3" /> Visualize
                </Button>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="flex flex-col flex-1 relative min-h-[400px]">
                <div className="absolute top-0 right-0 left-0 bottom-0 bg-slate-900 rounded-lg p-1 shadow-inner">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="w-full h-full resize-none bg-transparent border-0 text-slate-50 font-mono text-sm focus-visible:ring-0 p-4 leading-relaxed"
                        placeholder="Paste your layout JSON here..."
                        spellCheck={false}
                    />
                </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Valid JSON required</span>
            </div>
        </div>
    )
}
