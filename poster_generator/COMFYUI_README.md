# Poster Generator ComfyUI Integration

## Setup

1. Install ComfyUI and ensure it's running on `http://127.0.0.1:8188`
2. The workflow uses:
   - **Model**: v1-5-pruned-emaonly.safetensors
   - **LoRA**: High Resolution.safetensors (0.7 strength)
   - **Resolution**: Custom width/height (replaced at runtime)
   - **Prompt**: Dynamic positive prompt for poster design
   - **Negative**: Fixed negative prompt to avoid text/watermarks
3. Ensure your ComfyUI has the required models installed

## Workflow Structure

- **Node 4**: CLIPTextEncode (positive prompt) - `__PROMPT__` placeholder
- **Node 6**: EmptyLatentImage - `__WIDTH__` and `__HEIGHT__` placeholders  
- **Node 9**: SaveImage - outputs the generated image

## Environment Variables

Set these in `.env`:
- `COMFYUI_URL=http://127.0.0.1:8188` (default ComfyUI address)

## Running

1. Start ComfyUI: `python main.py` in your ComfyUI directory
2. Start the poster generator: `python main.py` in this directory
3. Use the web interface to generate posters

The system will automatically queue prompts to ComfyUI and wait for completion.

The system will automatically queue prompts to ComfyUI and wait for completion.