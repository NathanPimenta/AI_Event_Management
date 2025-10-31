import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'

export async function POST(request: Request) {
  try {
    // Optional payload can include custom paths for requirements/participants in future
    // For prototype, we ignore body and run with defaults inside team_formation
    let output = ''

    const pythonProcess = spawn('python', [
      '-m',
      'team_formation.src.main'
    ], {
      cwd: process.cwd(),
      env: { ...process.env }
    })

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      output += data.toString()
    })

    const exitCode: number = await new Promise((resolve) => {
      pythonProcess.on('close', (code) => resolve(code ?? 1))
    })

    const outputDir = path.join(process.cwd(), 'team_formation', 'output')
    const resultsPath = path.join(outputDir, 'optimal_teams.json')

    if (exitCode !== 0) {
      return NextResponse.json({ 
        success: false,
        error: `Process exited with code ${exitCode}`,
        output
      }, { status: 500 })
    }

    // Try to read results JSON; if missing, still return logs
    try {
      const fileContent = await fs.readFile(resultsPath, 'utf-8')
      const results = JSON.parse(fileContent)
      return NextResponse.json({ success: true, results, logs: output })
    } catch (e) {
      return NextResponse.json({ 
        success: true,
        results: null,
        logs: output,
        warning: 'Results file not found; returning logs only.'
      })
    }
  } catch (error) {
    console.error('Error running team formation:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}