from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from . import creative_agent, visual_agent, layout_agent
from .constants import BACKGROUND_IMAGE, FINAL_POSTER, OUTPUT_DIR

app = FastAPI(title="AI Poster Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=OUTPUT_DIR), name="static")
app.mount("/ui", StaticFiles(directory="poster_generator/static"), name="ui")


@app.get("/")
async def root():
    return RedirectResponse("/ui/test_poster.html")


class PosterRequest(BaseModel):
    event_details: dict
    creative_brief: str


@app.post("/posters/generate")
async def generate_poster(req: PosterRequest):
    plan = creative_agent.create_poster_plan(
        req.event_details, req.creative_brief
    )

    if not visual_agent.generate_background_image(
        plan["visual_prompt"], BACKGROUND_IMAGE
    ):
        raise HTTPException(500, "Image generation failed")

    if not layout_agent.compose_poster(
        {
            "background_path": BACKGROUND_IMAGE,
            "text_elements": plan["text_elements"],
        },
        FINAL_POSTER,
    ):
        raise HTTPException(500, "Poster composition failed")

    return {
        "message": "Poster generated successfully",
        "url": f"/static/{FINAL_POSTER.name}",
    }
