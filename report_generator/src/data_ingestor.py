import pandas as pd
import json
from pathlib import Path
from typing import Dict, Any, Optional

DATA_DIR = Path(__file__).parent.parent / "data"
#DATA_DIR = "/home/nathanpimenta/AI_Event_Management/report_generator/data"


class DataLoadError(Exception):
    """Custom exception for data loading errors in event management system."""
    pass

def load_csv(filepath: Path, name: str) -> pd.DataFrame:
    """
    Load a CSV file with error handling for event data.
    
    Args:
        filepath: Path to CSV file
        name: Descriptive name for logging
        
    Returns:
        Loaded DataFrame
    """
    try:
        df = pd.read_csv(filepath)
        print(f"✅ Loaded {name} ({len(df)} records).")
        return df
    except FileNotFoundError:
        raise DataLoadError(f"Required event data file missing: {filepath}")
    except pd.errors.EmptyDataError:
        raise DataLoadError(f"Event data file is empty: {filepath}")
    except Exception as e:
        raise DataLoadError(f"Error loading {filepath}: {str(e)}")

def load_json(filepath: Path, name: str, required: bool = False) -> Any:
    """
    Load a JSON file with error handling.
    
    Args:
        filepath: Path to JSON file
        name: Descriptive name for logging
        required: Whether this data is required
        
    Returns:
        Loaded JSON data or empty list if optional and missing
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ Loaded {name} ({len(data)} entries).")
        return data
    except FileNotFoundError:
        if required:
            raise DataLoadError(f"Required event data file missing: {filepath}")
        print(f"ℹ️  No {filepath.name} found, skipping optional data.")
        return []
    except json.JSONDecodeError as e:
        error_msg = f"Invalid JSON in {filepath}: {str(e)}"
        if required:
            raise DataLoadError(error_msg)
        print(f"⚠️  {error_msg}")
        return []
    except Exception as e:
        error_msg = f"Error loading {filepath}: {str(e)}"
        if required:
            raise DataLoadError(error_msg)
        print(f"⚠️  {error_msg}")
        return []

def load_data() -> Optional[Dict[str, Any]]:
    """
    Load all available event data sources from the data directory.
    
    This function loads:
    - Participant registration data (required)
    - Event feedback/evaluation data (required)
    - Social media mentions (optional)
    - Session attendance analytics (optional)
    
    Returns:
        Dictionary containing all loaded datasets, or None if required data is missing
        
    Raises:
        DataLoadError: If required files cannot be loaded
    """
    print("path = ",Path.cwd())
    # DATA_DIR = "/home/nathanpimenta/AI_Event_Management/report_generator/data/"
    if not DATA_DIR.exists():
        print(f" ERROR: Event data directory not found: {DATA_DIR}")
        print(f"💡 TIP: Create the directory and add your event data files.")
        return None
    
    data = {}
    
    print("\n" + "="*60)
    print("📊 AI EVENT MANAGEMENT SYSTEM - Data Loading Module")
    print("="*60 + "\n")
    
    # --- Load Required Event Data ---
    print("📥 Loading required event data...")
    try:
        data['participants'] = load_csv(
            DATA_DIR / 'attendees.csv', 
            'participant registrations'
        )
        data['feedback'] = load_csv(
            DATA_DIR / 'feedback.csv', 
            'event feedback'
        )
        print("✓ Core event data loaded successfully\n")
    except DataLoadError as e:
        print(f" ERROR: {e}")
        print("⚠️  Cannot proceed without required event data. Aborting.\n")
        return None
    
    # --- Load Optional Event Data ---
    print("📥 Loading optional event data...")
    data['social'] = load_json(
        DATA_DIR / 'social_mentions.json', 
        'social media mentions'
    )
    data['attendance'] = load_json(
        DATA_DIR / 'crowd_analytics.json', 
        'session attendance analytics'
    )
    
    print(f"\n{'='*60}")
    print(f"✅ Data loading complete!")
    print(f"📊 Loaded datasets: {', '.join(data.keys())}")
    print(f"👥 Total participants: {len(data['participants'])}")
    print(f"📝 Total feedback responses: {len(data['feedback'])}")
    print(f"{'='*60}\n")
    
    return data

if __name__ == "__main__":
    # Test the data loader
    print("🧪 Testing Data Ingestor Module...\n")
    loaded_data = load_data()
    
    if loaded_data:
        print("\n✅ Data Ingestor Test: PASSED")
        print(f"Available datasets: {list(loaded_data.keys())}")
    else:
        print("\n Data Ingestor Test: FAILED")