'use client'

import { useRef, useState, useEffect } from 'react'
import QRCode from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Copy, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface EventQRCodeProps {
  eventId: string
  eventTitle: string
  eventDate?: string
  size?: 'small' | 'medium' | 'large'
  showDownload?: boolean
  showCopy?: boolean
  compact?: boolean
}

/**
 * QR Code component for event participants
 * Generates a QR code that links to the event details page
 * Users can download or copy the QR code
 */
export default function EventQRCode({
  eventId,
  eventTitle,
  eventDate,
  size = 'medium',
  showDownload = true,
  showCopy = true,
  compact = false,
}: EventQRCodeProps) {
  const qrRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)

  // Generate the QR code URL - links to event details
  const eventUrl = `${process.env.NEXT_PUBLIC_APP_URL}/events/${eventId}`

  // Responsive QR code sizing - smaller on mobile, adaptive based on compact mode
  const sizeMap = {
    small: compact ? 120 : 128,
    medium: compact ? 180 : 240,
    large: compact ? 240 : 320,
  }

  const qrSize = sizeMap[size]

  // Auto-compress on mobile if needed
  useEffect(() => {
    setIsCompressing(window.innerWidth < 768)
  }, [])

  const handleDownload = () => {
    const qrElement = qrRef.current?.querySelector('canvas') as HTMLCanvasElement
    if (qrElement) {
      const url = qrElement.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = url
      link.download = `${eventTitle.replace(/\s+/g, '-')}-qr-code.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: 'Success',
        description: 'QR code downloaded successfully',
      })
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl)
      setCopied(true)
      
      toast({
        title: 'Copied!',
        description: 'Event link copied to clipboard',
      })

      // Reset copy feedback after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      })
    }
  }

  return (
    <Card className="w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Event QR Code</CardTitle>
        <CardDescription className="text-xs">
          Scan to view event details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* QR Code Display - Centered and Optimized */}
        <div className="flex flex-col items-center justify-center space-y-3">
          <div
            ref={qrRef}
            className="p-3 bg-white rounded-lg border-2 border-slate-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <QRCode
              value={eventUrl}
              size={qrSize}
              level="H"
              includeMargin={true}
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>

          {/* Event Info - Compact */}
          {!compact && (
            <div className="text-center space-y-1">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-2">
                {eventTitle}
              </p>
              {eventDate && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{eventDate}</p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons - Responsive Grid */}
        <div className={`flex gap-2 ${showDownload && showCopy ? 'grid grid-cols-2' : 'w-full'}`}>
          {showDownload && (
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="flex items-center justify-center gap-1.5 text-xs h-8"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          )}
          {showCopy && (
            <Button
              onClick={handleCopyLink}
              variant={copied ? 'default' : 'outline'}
              size="sm"
              className={`flex items-center justify-center gap-1.5 text-xs h-8 transition-all ${
                copied ? 'bg-green-600 hover:bg-green-700' : ''
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copy Link</span>
                </>
              )}
            </Button>
          )}
        </div>

        {/* Quick Instructions - Minimal */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded p-2.5 space-y-1.5">
          <p className="text-xs font-medium text-blue-900 dark:text-blue-200">📱 Quick Access:</p>
          <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-0.5 ml-2">
            <li>• Scan QR code with phone camera</li>
            <li>• View event & register instantly</li>
          </ul>
        </div>

        {/* Display URL - Compact and Selectable */}
        <div className="bg-slate-100 dark:bg-slate-800 rounded p-2 break-all border border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-600 dark:text-slate-400 font-mono select-all cursor-pointer hover:text-slate-900 dark:hover:text-slate-200">
            {eventUrl}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
