"use client"

import { useState } from "react"
import { LayoutVisualizer } from "@/components/layout-visualizer"
import { LayoutInput } from "@/components/layout-input"

export default function LayoutVisualizerPage() {
    const [layoutData, setLayoutData] = useState(null)

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background">
            <div className="container mx-auto py-6 px-4 max-w-[1600px]">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Event Layout Visualizer</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Define your event space using JSON and click objects to view team details.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-12rem)] min-h-[600px]">
                    <div className="lg:w-[450px] flex flex-col h-full shrink-0">
                        <LayoutInput onVisualize={setLayoutData} />
                    </div>

                    <div className="flex-1 h-full shadow-lg overflow-hidden rounded-xl border bg-card text-card-foreground">
                        <LayoutVisualizer data={layoutData} />
                    </div>
                </div>
            </div>
        </div>
    )
}
