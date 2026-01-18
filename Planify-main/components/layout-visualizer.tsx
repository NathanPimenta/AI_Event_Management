"use client"

import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ZoomIn, ZoomOut, Maximize, X, Users, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface Member {
    name: string
    role?: string
    image?: string
}

interface LayoutObject {
    id: string
    type: string
    x: number
    y: number
    width?: number
    height?: number
    radius?: number
    rotation?: number
    label?: string
    color?: string
    members?: Member[]
}

interface Venue {
    width: number
    length: number
    unit: string
}

interface LayoutData {
    venue: Venue
    objects: LayoutObject[]
}

interface LayoutVisualizerProps {
    data: LayoutData | null
}

export function LayoutVisualizer({ data }: LayoutVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const [scale, setScale] = useState(1)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const [selectedObject, setSelectedObject] = useState<LayoutObject | null>(null)

    // Improved Color Palette
    const getTypeColor = (type: string) => {
        switch (type.toLowerCase()) {
            case 'stage': return { fill: '#ddd6fe', stroke: '#7c3aed', icon: '#6d28d9' } // Violet
            case 'round-table': return { fill: '#d1fae5', stroke: '#059669', icon: '#047857' } // Emerald
            case 'table': return { fill: '#d1fae5', stroke: '#059669', icon: '#047857' } // Emerald
            case 'booth': return { fill: '#fef3c7', stroke: '#d97706', icon: '#b45309' } // Amber
            case 'stall': return { fill: '#fef3c7', stroke: '#d97706', icon: '#b45309' } // Amber
            case 'entrance': return { fill: '#fee2e2', stroke: '#dc2626', icon: '#b91c1c' } // Red
            case 'exit': return { fill: '#fee2e2', stroke: '#dc2626', icon: '#b91c1c' } // Red
            default: return { fill: '#dbeafe', stroke: '#2563eb', icon: '#1d4ed8' } // Blue
        }
    }

    // Custom Icon Drawers
    const drawIcon = (ctx: CanvasRenderingContext2D, type: string, w: number, h: number, color: string) => {
        ctx.fillStyle = color
        ctx.save()
        // Center drawing in w, h box
        ctx.translate(w / 2, h / 2)
        // Scale down to fit icon
        const iconScale = Math.min(w, h) / 24
        ctx.scale(iconScale, iconScale)

        // Icons paths (simplified versions of standard icons)
        switch (type.toLowerCase()) {
            case 'stage':
                // Podium / Mic
                ctx.beginPath()
                ctx.rect(-6, -8, 12, 16); // stand
                ctx.fill()
                ctx.beginPath()
                ctx.moveTo(-10, 8); ctx.lineTo(10, 8); ctx.stroke(); // base
                break;
            case 'booth':
            case 'stall':
                // Storefront
                ctx.beginPath();
                ctx.moveTo(-8, 4); ctx.lineTo(-8, -8); ctx.lineTo(8, -8); ctx.lineTo(8, 4);
                ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-10, 4); ctx.lineTo(10, 4); ctx.stroke();
                break;
            case 'entrance':
            case 'exit':
                // Arrow
                ctx.beginPath();
                ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
                ctx.moveTo(2, -4); ctx.lineTo(6, 0); ctx.lineTo(2, 4);
                ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
                break;
            case 'round-table':
            case 'table':
                // Keep empty, shape itself is expressive
                break;
            default:
                // Circle dot
                ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore()
    }

    const draw = () => {
        if (!data || !canvasRef.current) return
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()

        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
            canvas.width = rect.width * dpr
            canvas.height = rect.height * dpr
        }

        ctx.resetTransform()
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, rect.width, rect.height)

        // Grid
        drawGrid(ctx, rect.width, rect.height)

        const padding = 60
        const availableWidth = rect.width - padding * 2
        const availableHeight = rect.height - padding * 2
        const scaleX = availableWidth / data.venue.width
        const scaleY = availableHeight / data.venue.length
        const baseScale = Math.min(scaleX, scaleY)
        const finalScale = baseScale * scale

        const centerX = rect.width / 2 + offset.x
        const centerY = rect.height / 2 + offset.y
        const venuePixelWidth = data.venue.width * finalScale
        const venuePixelHeight = data.venue.length * finalScale
        const originX = centerX - venuePixelWidth / 2
        const originY = centerY - venuePixelHeight / 2

        // Venue Floor
        ctx.save()
        ctx.translate(originX, originY)
        ctx.shadowColor = "rgba(0, 0, 0, 0.05)"
        ctx.shadowBlur = 20
        ctx.shadowOffsetY = 8
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, venuePixelWidth, venuePixelHeight)
        ctx.shadowColor = "transparent"
        ctx.strokeStyle = "#94a3b8"
        ctx.lineWidth = 2
        ctx.strokeRect(0, 0, venuePixelWidth, venuePixelHeight)

        // Inner Grid
        ctx.strokeStyle = "#f1f5f9"
        ctx.lineWidth = 1
        const gridSize = 10
        for (let x = 0; x <= data.venue.width; x += gridSize) {
            ctx.beginPath(); ctx.moveTo(x * finalScale, 0); ctx.lineTo(x * finalScale, venuePixelHeight); ctx.stroke();
        }
        for (let y = 0; y <= data.venue.length; y += gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y * finalScale); ctx.lineTo(venuePixelWidth, y * finalScale); ctx.stroke();
        }
        ctx.restore()

        // Draw Objects
        data.objects.forEach((obj) => {
            ctx.save()
            ctx.translate(originX + obj.x * finalScale, originY + obj.y * finalScale)
            if (obj.rotation) ctx.rotate((obj.rotation * Math.PI) / 180)

            const colors = getTypeColor(obj.type)
            const isSelected = selectedObject?.id === obj.id

            // Shadow for depth
            ctx.shadowColor = "rgba(0,0,0,0.08)"
            ctx.shadowBlur = 4
            ctx.shadowOffsetY = 2

            // Draw Main Shape
            ctx.fillStyle = colors.fill
            ctx.strokeStyle = colors.stroke
            ctx.lineWidth = 1.5

            let w = 0, h = 0

            if ((obj.type === "round-table" || obj.type === "table") && obj.radius) {
                w = h = obj.radius * finalScale * 2 // Diameter
                ctx.beginPath()
                ctx.arc(0, 0, obj.radius * finalScale, 0, Math.PI * 2)
                ctx.fill()
                ctx.stroke()

                // Chairs
                ctx.shadowColor = "transparent"
                ctx.fillStyle = colors.stroke
                const chairs = 6
                for (let i = 0; i < chairs; i++) {
                    const angle = (i * (360 / chairs)) * (Math.PI / 180)
                    const dist = obj.radius * finalScale + 5
                    const cx = Math.cos(angle) * dist
                    const cy = Math.sin(angle) * dist
                    ctx.beginPath()
                    ctx.arc(cx, cy, 3, 0, Math.PI * 2)
                    ctx.fill()
                }
            } else {
                w = (obj.width || 10) * finalScale
                h = (obj.height || 10) * finalScale

                ctx.beginPath()
                // Rounded rect
                ctx.roundRect(0, 0, w, h, 4)
                ctx.fill()
                ctx.stroke()

                // Draw Internal Icon
                ctx.shadowColor = "transparent"
                drawIcon(ctx, obj.type, w, h, colors.icon)
            }

            // Selection Indicator (Overlay, not modifying object prop directly to avoid artifacts)
            if (isSelected) {
                ctx.shadowColor = "transparent"
                ctx.strokeStyle = "#3b82f6" // Selection Blue
                ctx.lineWidth = 2
                // Draw ring outside
                const pad = 6
                if (obj.radius) {
                    ctx.beginPath()
                    ctx.arc(0, 0, obj.radius * finalScale + pad, 0, Math.PI * 2)
                    ctx.stroke()
                } else {
                    ctx.beginPath()
                    ctx.roundRect(-pad, -pad, w + pad * 2, h + pad * 2, 6)
                    ctx.stroke()
                }
            }

            ctx.restore()

            // Labels (Halo)
            if (obj.label) {
                ctx.save()
                ctx.translate(originX + obj.x * finalScale, originY + obj.y * finalScale)

                let cx = 0, cy = 0
                if (!obj.radius) {
                    const w = (obj.width || 10) * finalScale
                    const h = (obj.height || 10) * finalScale
                    cx = w / 2; cy = h / 2
                }

                ctx.font = isSelected ? "600 11px Inter, sans-serif" : "500 11px Inter, sans-serif"
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"

                const text = obj.label
                // Halo
                ctx.strokeStyle = "rgba(255, 255, 255, 0.85)"
                ctx.lineWidth = 3
                ctx.lineJoin = "round"
                ctx.strokeText(text, cx, cy)

                ctx.fillStyle = isSelected ? "#0f172a" : "#334155"
                ctx.fillText(text, cx, cy)
                ctx.restore()
            }
        })
    }

    const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        ctx.save()
        ctx.strokeStyle = "#f1f5f9"
        ctx.lineWidth = 1
        const size = 50
        ctx.beginPath()
        for (let x = 0; x < w; x += size) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (let y = 0; y < h; y += size) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
        ctx.stroke()
        ctx.restore()
    }

    useEffect(() => {
        draw()
    }, [data, scale, offset, selectedObject])

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!data || !canvasRef.current) return
        const rect = canvasRef.current.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top

        const padding = 60
        const availableWidth = rect.width - padding * 2
        const availableHeight = rect.height - padding * 2
        const scaleX = availableWidth / data.venue.width
        const scaleY = availableHeight / data.venue.length
        const baseScale = Math.min(scaleX, scaleY)
        const finalScale = baseScale * scale

        const centerX = rect.width / 2 + offset.x
        const centerY = rect.height / 2 + offset.y
        const venuePixelWidth = data.venue.width * finalScale
        const venuePixelHeight = data.venue.length * finalScale
        const originX = centerX - venuePixelWidth / 2
        const originY = centerY - venuePixelHeight / 2

        let clicked: LayoutObject | null = null
        for (let i = data.objects.length - 1; i >= 0; i--) {
            const obj = data.objects[i]
            const objScreenX = originX + obj.x * finalScale
            const objScreenY = originY + obj.y * finalScale

            if (obj.radius) {
                const dx = clickX - objScreenX
                const dy = clickY - objScreenY
                if (dx * dx + dy * dy <= (obj.radius * finalScale + 5) ** 2) {
                    clicked = obj; break
                }
            } else {
                const w = (obj.width || 10) * finalScale
                const h = (obj.height || 10) * finalScale
                if (clickX >= objScreenX && clickX <= objScreenX + w && clickY >= objScreenY && clickY <= objScreenY + h) {
                    clicked = obj; break
                }
            }
        }
        setSelectedObject(clicked)
    }

    if (!data) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-slate-400">Enter layout data to preview</p>
            </div>
        )
    }

    return (
        <div className="w-full h-full flex flex-col relative bg-slate-50 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            <div className="absolute top-4 right-4 flex gap-1 z-10 bg-white/90 backdrop-blur p-1 rounded-md shadow-sm border border-slate-200">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>
                    <ZoomOut className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }) }}>
                    <Maximize className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={() => setScale(s => Math.min(3, s + 0.1))}>
                    <ZoomIn className="w-4 h-4" />
                </Button>
            </div>

            <div ref={containerRef} className="flex-1 relative cursor-default">
                <canvas
                    ref={canvasRef}
                    className="block w-full h-full"
                    onClick={handleCanvasClick}
                    onMouseDown={(e) => {
                        const startX = e.clientX; const startY = e.clientY
                        const startOff = { ...offset }
                        let moved = false
                        const move = (ev: MouseEvent) => {
                            if (Math.abs(ev.clientX - startX) > 2 || Math.abs(ev.clientY - startY) > 2) moved = true
                            if (moved) setOffset({ x: startOff.x + (ev.clientX - startX), y: startOff.y + (ev.clientY - startY) })
                        }
                        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
                        window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
                    }}
                />
            </div>

            <Dialog open={!!selectedObject} onOpenChange={(open) => !open && setSelectedObject(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedObject ? getTypeColor(selectedObject.type).icon : 'gray' }} />
                            {selectedObject?.label || 'Details'}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedObject?.type.toUpperCase()} • ID: {selectedObject?.id}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-slate-900">
                            <Users className="w-4 h-4 text-slate-500" /> Team Members
                        </h4>
                        {selectedObject?.members && selectedObject.members.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                {selectedObject.members.map((member, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={member.image} />
                                            <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">{member.name}</p>
                                            {member.role && <p className="text-xs text-slate-500">{member.role}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 italic py-2">No members assigned.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 shadow-sm border border-slate-200 flex items-center gap-2">
                <MapPin className="w-3 h-3 text-slate-400" />
                {data.venue.width} × {data.venue.length} {data.venue.unit}
            </div>
        </div>
    )
}
