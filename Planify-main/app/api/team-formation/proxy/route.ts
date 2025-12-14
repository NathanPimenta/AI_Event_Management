import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const form = await req.formData()

    const requirementsFile = form.get('requirements_file')
    const participantsFile = form.get('participants_file')

    if (!(requirementsFile instanceof File) || !(participantsFile instanceof File)) {
      return NextResponse.json({ error: 'Both files are required' }, { status: 400 })
    }

    const forward = new FormData()
    forward.append('requirements_file', requirementsFile as File, (requirementsFile as any).name || 'requirements.json')
    forward.append('participants_file', participantsFile as File, (participantsFile as any).name || 'participants.csv')

    const optimizerUrl = process.env.TEAM_OPTIMIZER_URL || 'http://127.0.0.1:8001/form-teams/'

    const res = await fetch(optimizerUrl, { method: 'POST', body: forward })

    const text = await res.text()
    const contentType = res.headers.get('content-type') || ''

    if (res.ok) {
      if (contentType.includes('application/json')) {
        return NextResponse.json(JSON.parse(text))
      }
      return new NextResponse(text, { status: res.status })
    }

    return NextResponse.json({ error: text }, { status: res.status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
