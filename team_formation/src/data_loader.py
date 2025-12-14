"""
Data Loader Module for Team Formation

Handles loading and validation of event requirements and participant data.
"""

import pandas as pd
import json
import os
from typing import Dict, List, Optional, Any

# Path configuration
DATA_DIR = os.path.join("team_formation", "data")

def load_event_requirements(filepath: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Loads event roles and skill requirements from JSON.
    
    Args:
        filepath: Optional custom path to requirements file
        
    Returns:
        Dictionary containing event requirements or None if loading fails
    """
    if filepath is None:
        filepath = os.path.join(DATA_DIR, 'event_requirements.json')
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            requirements = json.load(f)
        
        print(f"✅ Loaded event requirements from '{filepath}'.")
        
        # Validate basic structure
        if 'roles' not in requirements or not isinstance(requirements['roles'], list):
            raise ValueError("JSON must contain a 'roles' list.")
        
        if not requirements['roles']:
            raise ValueError("Roles list cannot be empty.")
        
        # Validate each role has required fields
        required_role_fields = ['role_id', 'role_name', 'required_skills', 'quantity_needed']
        for i, role in enumerate(requirements['roles']):
            for field in required_role_fields:
                if field not in role:
                    raise ValueError(f"Role {i} is missing required field: '{field}'")
            
            # Validate data types
            if not isinstance(role['required_skills'], list):
                raise ValueError(f"Role '{role['role_id']}': required_skills must be a list")
            
            if not isinstance(role['quantity_needed'], int) or role['quantity_needed'] < 1:
                raise ValueError(f"Role '{role['role_id']}': quantity_needed must be a positive integer")
        
        # Print summary
        total_positions = sum(role['quantity_needed'] for role in requirements['roles'])
        print(f"   - Event: {requirements.get('event_name', 'N/A')}")
        print(f"   - Total Roles: {len(requirements['roles'])}")
        print(f"   - Total Positions Needed: {total_positions}")
        
        return requirements
        
    except FileNotFoundError:
        print(f"❌ ERROR: File not found: '{filepath}'.")
        print("   Please ensure 'event_requirements.json' exists in the data folder.")
        return None
    except json.JSONDecodeError as e:
        print(f"❌ ERROR: Could not decode JSON from '{filepath}'.")
        print(f"   JSON Error: {e}")
        return None
    except ValueError as ve:
        print(f"❌ ERROR: Invalid JSON structure in '{filepath}': {ve}")
        return None
    except Exception as e:
        print(f"❌ ERROR loading '{filepath}': {e}")
        return None


def load_participants(filepath: Optional[str] = None) -> Optional[pd.DataFrame]:
    """
    Loads participant data and skills from CSV.
    
    Args:
        filepath: Optional custom path to participants file
        
    Returns:
        DataFrame with participant_id as index or None if loading fails
    """
    if filepath is None:
        filepath = os.path.join(DATA_DIR, 'participants.csv')
    
    try:
        df = pd.read_csv(filepath)
        
        # Validate required columns
        if 'participant_id' not in df.columns:
            raise ValueError("CSV must contain a 'participant_id' column.")
        
        required_info_cols = ['name', 'year', 'past_events']
        missing_cols = [col for col in required_info_cols if col not in df.columns]
        if missing_cols:
            raise ValueError(f"CSV is missing required columns: {missing_cols}")
        
        # Set participant_id as index
        df.set_index('participant_id', inplace=True)
        
        # Check for duplicates
        if df.index.duplicated().any():
            duplicate_ids = df.index[df.index.duplicated()].tolist()
            raise ValueError(f"Duplicate participant IDs found: {duplicate_ids}")
        
        # Identify skill columns (exclude metadata columns)
        metadata_cols = ['name', 'year', 'past_events', 'email', 'phone', 'availability']
        skill_cols = [col for col in df.columns if col not in metadata_cols]
        
        # Validate skill values are numeric and in valid range
        for col in skill_cols:
            if not pd.api.types.is_numeric_dtype(df[col]):
                print(f"⚠️  Warning: Skill column '{col}' contains non-numeric values. Converting to numeric.")
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
            
            # Check if values are in valid range (0-3)
            invalid_values = df[col][(df[col] < 0) | (df[col] > 3)]
            if not invalid_values.empty:
                print(f"⚠️  Warning: Skill column '{col}' has values outside 0-3 range. Clipping to valid range.")
                df[col] = df[col].clip(0, 3)
        
        # Handle missing values in skills (fill with 0)
        df[skill_cols] = df[skill_cols].fillna(0)
        
        print(f"✅ Loaded {len(df)} participants from '{filepath}'.")
        print(f"   - Skill Columns Detected: {len(skill_cols)}")
        print(f"   - Skills: {', '.join(skill_cols[:5])}{'...' if len(skill_cols) > 5 else ''}")
        
        # Print experience distribution
        if 'past_events' in df.columns:
            avg_exp = df['past_events'].mean()
            print(f"   - Average Past Events: {avg_exp:.1f}")
        
        return df
        
    except FileNotFoundError:
        print(f"❌ ERROR: File not found: '{filepath}'.")
        print("   Please ensure 'participants.csv' exists in the data folder.")
        return None
    except ValueError as ve:
        print(f"❌ ERROR: Invalid CSV structure in '{filepath}': {ve}")
        return None
    except Exception as e:
        print(f"❌ ERROR loading '{filepath}': {e}")
        return None


def validate_data_compatibility(requirements: Dict[str, Any], 
                                participants_df: pd.DataFrame) -> bool:
    """
    Validates that requirements and participant data are compatible.
    
    Args:
        requirements: Event requirements dictionary
        participants_df: Participants DataFrame
        
    Returns:
        True if data is compatible, False otherwise
    """
    print("\n🔍 Validating data compatibility...")
    
    issues = []
    warnings = []
    
    # Extract all required skills from all roles
    all_required_skills = set()
    for role in requirements['roles']:
        all_required_skills.update(role['required_skills'])
    
    # Check if required skills exist in participant data
    metadata_cols = ['name', 'year', 'past_events', 'email', 'phone', 'availability']
    available_skills = set(participants_df.columns) - set(metadata_cols)
    
    missing_skills = all_required_skills - available_skills
    if missing_skills:
        issues.append(f"Missing skill columns in CSV: {missing_skills}")
    
    # Check if there are enough participants
    total_positions_needed = sum(role['quantity_needed'] for role in requirements['roles'])
    total_participants = len(participants_df)
    
    if total_participants < total_positions_needed:
        warnings.append(
            f"Only {total_participants} participants for {total_positions_needed} positions. "
            "Some roles may be understaffed."
        )
    
    # Check skill coverage for each role
    for role in requirements['roles']:
        role_id = role['role_id']
        needed = role['quantity_needed']
        required_skills = role['required_skills']
        
        # Count participants with at least beginner level in all required skills
        qualified_count = 0
        for idx, participant in participants_df.iterrows():
            has_all_skills = all(
                skill in participant.index and participant[skill] >= 1 
                for skill in required_skills
            )
            if has_all_skills:
                qualified_count += 1
        
        if qualified_count < needed:
            warnings.append(
                f"Role '{role['role_name']}' needs {needed} people but only "
                f"{qualified_count} participants have all required skills at beginner+ level"
            )
    
    # Print results
    if issues:
        print("❌ COMPATIBILITY ISSUES FOUND:")
        for issue in issues:
            print(f"   - {issue}")
        return False
    
    if warnings:
        print("⚠️  WARNINGS (optimization may struggle):")
        for warning in warnings:
            print(f"   - {warning}")
    
    if not issues and not warnings:
        print("✅ Data is fully compatible!")
    elif not issues:
        print("✅ Data is compatible (with warnings)")
    
    return True


def get_data_summary(requirements: Dict[str, Any], 
                     participants_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Generate a summary of the loaded data.
    
    Args:
        requirements: Event requirements dictionary
        participants_df: Participants DataFrame
        
    Returns:
        Dictionary containing data summary
    """
    metadata_cols = ['name', 'year', 'past_events', 'email', 'phone', 'availability']
    skill_cols = [col for col in participants_df.columns if col not in metadata_cols]
    
    summary = {
        "event": {
            "name": requirements.get('event_name', 'N/A'),
            "total_roles": len(requirements['roles']),
            "total_positions": sum(role['quantity_needed'] for role in requirements['roles']),
            "unique_skills_required": len(set(
                skill for role in requirements['roles'] 
                for skill in role['required_skills']
            ))
        },
        "participants": {
            "total_count": len(participants_df),
            "avg_experience": float(participants_df['past_events'].mean()) if 'past_events' in participants_df.columns else 0,
            "skill_columns": len(skill_cols),
            "year_distribution": participants_df['year'].value_counts().to_dict() if 'year' in participants_df.columns else {}
        },
        "skill_analysis": {}
    }
    
    # Analyze skill levels
    for skill in skill_cols:
        if skill in participants_df.columns:
            summary["skill_analysis"][skill] = {
                "avg_level": float(participants_df[skill].mean()),
                "expert_count": int((participants_df[skill] == 3).sum()),
                "intermediate_count": int((participants_df[skill] == 2).sum()),
                "beginner_count": int((participants_df[skill] == 1).sum()),
                "no_skill_count": int((participants_df[skill] == 0).sum())
            }
    
    return summary


# Example usage and testing
if __name__ == "__main__":
    print("="*70)
    print("DATA LOADER TEST")
    print("="*70)
    
    # Load data
    reqs = load_event_requirements()
    participants_df = load_participants()
    
    if reqs and participants_df is not None:
        print("\n" + "="*70)
        
        # Validate compatibility
        is_compatible = validate_data_compatibility(reqs, participants_df)
        
        # Print summary
        if is_compatible or True:  # Show summary even with warnings
            print("\n" + "="*70)
            print("DATA SUMMARY")
            print("="*70)
            summary = get_data_summary(reqs, participants_df)
            
            print(f"\n📋 Event: {summary['event']['name']}")
            print(f"   Roles: {summary['event']['total_roles']}")
            print(f"   Positions: {summary['event']['total_positions']}")
            print(f"   Skills Required: {summary['event']['unique_skills_required']}")
            
            print(f"\n👥 Participants: {summary['participants']['total_count']}")
            print(f"   Avg Experience: {summary['participants']['avg_experience']:.1f} events")
            print(f"   Skill Columns: {summary['participants']['skill_columns']}")
            
            print("\n🎯 Top Skills by Expertise:")
            skill_scores = {
                skill: data['expert_count'] * 3 + data['intermediate_count'] * 2 + data['beginner_count']
                for skill, data in summary['skill_analysis'].items()
            }
            top_skills = sorted(skill_scores.items(), key=lambda x: x[1], reverse=True)[:5]
            for skill, score in top_skills:
                data = summary['skill_analysis'][skill]
                print(f"   - {skill}: {data['expert_count']} expert, "
                      f"{data['intermediate_count']} intermediate, {data['beginner_count']} beginner")
        
        print("\n" + "="*70)
        print("✅ Data loader test complete!")
        print("="*70)
    else:
        print("\n❌ Data loading failed. Please check your data files.")