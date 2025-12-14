from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import pandas as pd
from io import StringIO
import os
from pathlib import Path

# Import your existing, powerful modules
from . import data_loader
from . import team_optimizer_ga as team_optimizer  # Use an alias for clarity
from . import utils

app = FastAPI(title="Team Formation Optimizer API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- HELPER FUNCTION TO RUN THE OPTIMIZATION ---
def run_optimizer_task(requirements: dict, participants_df: pd.DataFrame) -> dict:
    """
    A reusable function that orchestrates the team formation process.
    This contains the logic previously in your CLI main.py.
    """
    # 1. Validate Data Compatibility
    is_compatible = data_loader.validate_data_compatibility(requirements, participants_df)
    if not is_compatible:
        # In an API context, we raise an exception instead of asking for input
        raise ValueError("Data validation failed. The provided CSV does not have the skills required by the JSON.")

    # 2. Run the Genetic Algorithm
    print("🚀 Initializing and running the Genetic Algorithm via API...")
    optimizer = team_optimizer.TeamFormationGA(requirements, participants_df)
    best_assignment = optimizer.run()

    if not best_assignment:
        raise RuntimeError("Optimization failed to produce a valid assignment.")

    # 3. Analyze and return the final results
    final_fitness = utils.calculate_fitness(best_assignment, requirements, participants_df)
    
    # The optimizer already saves the detailed JSON, so we just return it.
    output_path = Path(team_optimizer.OUTPUT_DIR) / team_optimizer.OUTPUT_FILENAME
    if output_path.exists():
        with open(output_path, 'r', encoding='utf-8') as f:
            final_results = json.load(f)
        return final_results
    else:
        raise FileNotFoundError("The final result file was not created by the optimizer.")

# --- THE NEW AND IMPROVED API ENDPOINT ---
@app.post("/form-teams/")
async def form_teams_endpoint(
    requirements_file: UploadFile = File(...),
    participants_file: UploadFile = File(...)
):
    """
    Accepts event requirements and participant data, then uses a
    Genetic Algorithm to find the optimal team assignments.
    """
    try:
        # 1. Read and parse uploaded files
        requirements_content = await requirements_file.read()
        requirements = json.loads(requirements_content)

        participants_content = await participants_file.read()
        participants_text = participants_content.decode('utf-8')
        
        # Use your robust data loader to read and validate the CSV
        temp_csv_path = "temp_participants.csv"
        with open(temp_csv_path, 'w', encoding='utf-8') as f:
            f.write(participants_text)
        
        # Use your existing robust loader for validation and type conversion
        participants_df = data_loader.load_participants(temp_csv_path)
        
        # Clean up temp file
        os.remove(temp_csv_path)

        if participants_df is None:
            raise HTTPException(status_code=400, detail="Invalid participant CSV format. Check logs.")

        # 2. Run the optimization task
        # This now calls your powerful Genetic Algorithm!
        optimal_teams = run_optimizer_task(requirements, participants_df)

        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Team optimization complete!",
                "data": optimal_teams
            }
        )

    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid input file format: {e}")
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=f"Internal error: A required file was not found. {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

# You can keep this for simple testing if you wish, but it's not the main endpoint
@app.get("/sample-teams/")
async def get_sample_teams():
    """Return actual team formation data from CSV and JSON files"""
    try:
        # Read and parse the CSV file
        import pandas as pd
        import json
        from pathlib import Path

        print("Starting team data fetch...")
        data_dir = Path(__file__).parent.parent / "data"
        print(f"Looking for data in: {data_dir}")
        
        # Read participants data
        csv_path = data_dir / "participants.csv"
        print(f"Reading CSV from: {csv_path}")
        df = pd.read_csv(csv_path)
        print(f"Successfully loaded {len(df)} participants")
        
        # Read requirements
        json_path = data_dir / "event_requirements.json"
        print(f"Reading JSON from: {json_path}")
        with open(json_path) as f:
            requirements = json.load(f)
        print("Successfully loaded requirements")

        # Create teams based on roles from requirements
        teams = []
        current_participants = df.to_dict('records')
        
        for role in requirements['roles']:
            team_members = []
            needed = role['quantity_needed']
            
            # Find suitable participants for this role based on required skills
            for participant in current_participants[:needed]:
                # Get participant's skills that match the role requirements
                matching_skills = [
                    skill for skill in role['required_skills'] 
                    if skill in participant and int(participant.get(skill, 0)) >= 2
                ]
                
                if matching_skills:
                    team_members.append({
                        "name": participant['name'],
                        "role": role['role_name'],
                        "skills": matching_skills,
                        "availability": participant['availability'],
                        "experience": f"{participant['past_events']} past events"
                    })
            
            if team_members:
                teams.append({
                    "name": f"Team {role['role_name']}",
                    "role_id": role['role_id'],
                    "members": team_members,
                    "shift_time": role['shift_time'],
                    "priority": role['priority']
                })
        
        return {"teams": teams}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)