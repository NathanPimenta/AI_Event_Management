Team Formation integration
=========================

This page integrates the Python-based Team Formation optimizer into the Planify Next.js app.

Quick start
-----------

1. Run the Python API (from `team_formation/`):

```bash
# activate your Python env and start the FastAPI server
uvicorn src.api:app --reload --port 8001
```

2. Start the Next.js app (Planify-main):

```bash
pnpm install
pnpm dev
```

3. Open the page: `/ai-tools/team-formation`

Configuration
-------------

- The Next.js proxy route forwards uploads to the optimizer. Set `TEAM_OPTIMIZER_URL` in your environment if your Python API runs on a different host/port (default: `http://127.0.0.1:8001/form-teams/`).

Notes
-----

- The UI now displays the optimizer output as a generated PDF preview and provides a "Download PDF" button. The PDF is created client-side (no server changes needed) so you can view and download results immediately.
- Keeping the optimizer as a separate Python service avoids porting heavy numeric dependencies to Node.
- If you prefer, I can help containerize both services with `docker-compose` and add a healthcheck.
