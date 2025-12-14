import numpy as np
import pandas as pd
from typing import Dict, List, Any

def calculate_fitness(assignment: Dict[str, List[str]],
                      requirements: Dict[str, Any],
                      participants_df: pd.DataFrame) -> float:
    """
    Enhanced fitness function that evaluates team assignment quality.
    
    Components:
    1. Role fulfillment (quantity matching)
    2. Skill coverage and matching
    3. Experience distribution
    4. Workload balance
    
    Higher score = better assignment
    """
    
    total_fitness = 0.0
    roles_perfectly_met = 0
    total_roles = len(requirements['roles'])
    
    # Weights for different fitness components
    WEIGHT_ROLE_FULFILLMENT = 1.0
    WEIGHT_SKILL_MATCH = 0.8
    WEIGHT_EXPERIENCE = 0.3
    WEIGHT_BALANCE = 0.2
    
    all_assigned_participants = set()
    role_scores = []
    
    for role in requirements['roles']:
        role_id = role['role_id']
        needed = role['quantity_needed']
        required_skills = role['required_skills']
        assigned_participants = assignment.get(role_id, [])
        num_assigned = len(assigned_participants)
        
        # Track all assignments for duplicate detection
        for pid in assigned_participants:
            all_assigned_participants.add(pid)
        
        role_score = 0.0
        
        # ===== 1. ROLE FULFILLMENT SCORE =====
        if num_assigned == needed:
            role_score += 200  # Perfect match
            roles_perfectly_met += 1
        elif num_assigned < needed:
            # Heavily penalize understaffing
            shortage = needed - num_assigned
            role_score -= 300 * shortage
        else:
            # Moderately penalize overstaffing
            excess = num_assigned - needed
            role_score -= 150 * excess
        
        # ===== 2. SKILL MATCH SCORE =====
        if num_assigned > 0 and required_skills:
            skill_scores = []
            
            for participant_id in assigned_participants:
                if participant_id not in participants_df.index:
                    role_score -= 500  # Invalid participant
                    continue
                
                participant = participants_df.loc[participant_id]
                participant_skill_score = 0
                skills_found = 0
                
                for skill in required_skills:
                    if skill in participants_df.columns:
                        skill_level = participant[skill]
                        
                        if skill_level >= 2:  # Intermediate or Expert
                            participant_skill_score += 30 * skill_level  # Strong bonus
                            skills_found += 1
                        elif skill_level == 1:  # Beginner
                            participant_skill_score += 5  # Small bonus
                            skills_found += 1
                        else:  # Missing skill (0 or NaN)
                            participant_skill_score -= 40  # Penalty for missing critical skill
                    else:
                        # Skill column doesn't exist in data
                        participant_skill_score -= 20
                
                # Bonus for having all required skills
                if skills_found == len(required_skills):
                    participant_skill_score += 50
                
                skill_scores.append(participant_skill_score)
            
            # Average skill match for this role
            avg_skill_score = np.mean(skill_scores) if skill_scores else 0
            role_score += avg_skill_score * WEIGHT_SKILL_MATCH
            
            # ===== 3. EXPERIENCE SCORE =====
            # Prefer mix of experienced and less experienced for knowledge transfer
            if 'past_events' in participants_df.columns:
                experience_levels = []
                for pid in assigned_participants:
                    if pid in participants_df.index:
                        exp = participants_df.loc[pid, 'past_events']
                        experience_levels.append(exp)
                
                if experience_levels:
                    avg_exp = np.mean(experience_levels)
                    exp_variance = np.var(experience_levels) if len(experience_levels) > 1 else 0
                    
                    # Bonus for having experienced people
                    role_score += avg_exp * 10 * WEIGHT_EXPERIENCE
                    
                    # Small bonus for diversity (not all newbies or all veterans)
                    if len(experience_levels) > 1:
                        role_score += min(exp_variance * 2, 20) * WEIGHT_EXPERIENCE
        
        role_scores.append(role_score)
    
    # Aggregate role scores
    total_fitness += sum(role_scores)
    
    # ===== 4. GLOBAL BONUSES =====
    # Bonus for meeting all role requirements
    if roles_perfectly_met == total_roles:
        total_fitness += 500
    
    # ===== 5. WORKLOAD BALANCE =====
    # Penalize if assignment counts are very imbalanced across roles
    if role_scores:
        assignment_counts = [len(assignment.get(role['role_id'], [])) 
                           for role in requirements['roles']]
        if assignment_counts:
            count_variance = np.var(assignment_counts)
            # Penalize high variance (some roles very full, others empty)
            total_fitness -= count_variance * 5 * WEIGHT_BALANCE
    
    # ===== 6. DUPLICATE DETECTION =====
    # Penalize if any participant assigned to multiple roles
    total_assignments = sum(len(pids) for pids in assignment.values())
    unique_assignments = len(all_assigned_participants)
    if total_assignments > unique_assignments:
        duplicates = total_assignments - unique_assignments
        total_fitness -= 1000 * duplicates  # Severe penalty
    
    return total_fitness


def get_assignment_summary(assignment: Dict[str, List[str]],
                          requirements: Dict[str, Any],
                          participants_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Generate a human-readable summary of the assignment quality.
    Useful for debugging and reporting.
    """
    summary = {
        "total_fitness": calculate_fitness(assignment, requirements, participants_df),
        "roles": {},
        "overall": {
            "total_participants_assigned": sum(len(pids) for pids in assignment.values()),
            "roles_met": 0,
            "roles_understaffed": 0,
            "roles_overstaffed": 0
        }
    }
    
    for role in requirements['roles']:
        role_id = role['role_id']
        needed = role['quantity_needed']
        assigned = assignment.get(role_id, [])
        num_assigned = len(assigned)
        
        status = "met"
        if num_assigned < needed:
            status = "understaffed"
            summary["overall"]["roles_understaffed"] += 1
        elif num_assigned > needed:
            status = "overstaffed"
            summary["overall"]["roles_overstaffed"] += 1
        else:
            summary["overall"]["roles_met"] += 1
        
        # Calculate average skill level for required skills
        avg_skills = {}
        for skill in role['required_skills']:
            if skill in participants_df.columns:
                skill_levels = []
                for pid in assigned:
                    if pid in participants_df.index:
                        skill_levels.append(participants_df.loc[pid, skill])
                if skill_levels:
                    avg_skills[skill] = round(np.mean(skill_levels), 2)
        
        summary["roles"][role_id] = {
            "name": role['role_name'],
            "needed": needed,
            "assigned": num_assigned,
            "status": status,
            "avg_skill_levels": avg_skills
        }
    
    return summary


# Example usage and testing
if __name__ == "__main__":
    # Test data
    reqs_test = {
        'roles': [
            {
                'role_id': 'R1',
                'role_name': 'Registration',
                'quantity_needed': 2,
                'required_skills': ['Communication', 'Organization']
            },
            {
                'role_id': 'R2',
                'role_name': 'Tech Support',
                'quantity_needed': 1,
                'required_skills': ['AV Setup', 'Troubleshooting']
            }
        ]
    }
    
    participants_test_df = pd.DataFrame({
        'name': ['Alice', 'Bob', 'Charlie', 'Diana'],
        'year': [3, 2, 4, 1],
        'past_events': [2, 1, 5, 0],
        'Communication': [3, 2, 3, 1],
        'Organization': [2, 3, 3, 1],
        'AV Setup': [1, 1, 2, 1],
        'Troubleshooting': [1, 2, 2, 1]
    }, index=['P1', 'P2', 'P3', 'P4'])
    
    # Test assignments
    print("="*60)
    print("TESTING FITNESS FUNCTION")
    print("="*60)
    
    # Good assignment
    assignment1 = {'R1': ['P1', 'P2'], 'R2': ['P3']}
    fitness1 = calculate_fitness(assignment1, reqs_test, participants_test_df)
    summary1 = get_assignment_summary(assignment1, reqs_test, participants_test_df)
    print(f"\nAssignment 1 (Good): {assignment1}")
    print(f"Fitness: {fitness1:.2f}")
    print(f"Summary: {summary1['overall']}")
    
    # Understaffed assignment
    assignment2 = {'R1': ['P1'], 'R2': ['P3']}
    fitness2 = calculate_fitness(assignment2, reqs_test, participants_test_df)
    print(f"\nAssignment 2 (Understaffed): {assignment2}")
    print(f"Fitness: {fitness2:.2f}")
    
    # Poor skill match
    assignment3 = {'R1': ['P4', 'P4'], 'R2': ['P1']}  # Duplicate + poor skills
    fitness3 = calculate_fitness(assignment3, reqs_test, participants_test_df)
    print(f"\nAssignment 3 (Poor skills + duplicate): {assignment3}")
    print(f"Fitness: {fitness3:.2f}")
    
    print("\n" + "="*60)