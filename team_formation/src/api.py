from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import os
import pandas as pd
from io import StringIO
from typing import List, Dict
import csv

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only - configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload-files/")
async def upload_files(
    requirements_file: UploadFile = File(...),
    participants_file: UploadFile = File(...)
):
    try:
        print("Processing uploaded files...")
        
        # Read requirements JSON
        requirements_content = await requirements_file.read()
        requirements = json.loads(requirements_content)
        print("Requirements file loaded successfully")

        # Read participants CSV
        participants_content = await participants_file.read()
        participants_text = participants_content.decode()
        df = pd.read_csv(StringIO(participants_text))
        print(f"Participants file loaded successfully: {len(df)} records")

        # Process the data and form teams
        teams = []
        for role in requirements['roles']:
            team_members = []
            needed = role['quantity_needed']
            
            # Find suitable participants for this role based on required skills
            for _, participant in df.iterrows():
                # Check if we already have enough team members
                if len(team_members) >= needed:
                    break
                    
                # Get participant's skills that match the role requirements
                matching_skills = [
                    skill for skill in role['required_skills'] 
                    if skill in participant and participant.get(skill, 0) >= 2
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

        return JSONResponse({
            "success": True,
            "teams": teams,
            "summary": {
                "total_teams": len(teams),
                "total_members": sum(len(team["members"]) for team in teams)
            }
        })

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail="Invalid JSON format in requirements file")
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="Empty CSV file")
    except Exception as e:
        print(f"Error processing files: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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