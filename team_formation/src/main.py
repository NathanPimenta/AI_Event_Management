"""
Team Formation Module - Main Entry Point

Orchestrates the entire team formation process:
1. Data loading and validation
2. Genetic algorithm optimization
3. Results output and reporting
"""

import os
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from . import data_loader
from . import team_optimizer_ga
from . import utils


def print_banner():
    """Print welcome banner."""
    banner = """
    ╔══════════════════════════════════════════════════════════════╗
    ║                                                              ║
    ║           🎯 TEAM FORMATION OPTIMIZATION SYSTEM 🎯           ║
    ║                                                              ║
    ║              AI-Powered Volunteer Assignment                 ║
    ║                  Using Genetic Algorithms                    ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)


def print_section(title: str):
    """Print a section header."""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print('='*70)


def save_detailed_report(requirements: Dict[str, Any], 
                         participants_df, 
                         best_assignment: Dict[str, list],
                         fitness_score: float,
                         execution_time: float):
    """
    Save a detailed report of the optimization process.
    
    Args:
        requirements: Event requirements
        participants_df: Participants DataFrame
        best_assignment: Best team assignment found
        fitness_score: Final fitness score
        execution_time: Time taken for optimization
    """
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output")
    report_path = os.path.join(output_dir, "optimization_report.txt")
    
    try:
        os.makedirs(output_dir, exist_ok=True)
        
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write("="*70 + "\n")
            f.write("TEAM FORMATION OPTIMIZATION REPORT\n")
            f.write("="*70 + "\n\n")
            
            # Event info
            f.write(f"Event: {requirements.get('event_name', 'N/A')}\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Execution Time: {execution_time:.2f} seconds\n")
            f.write(f"Final Fitness Score: {fitness_score:.2f}\n\n")
            
            # Overall statistics
            total_positions = sum(role['quantity_needed'] for role in requirements['roles'])
            total_assigned = sum(len(pids) for pids in best_assignment.values())
            
            f.write("-"*70 + "\n")
            f.write("OVERALL STATISTICS\n")
            f.write("-"*70 + "\n")
            f.write(f"Total Roles: {len(requirements['roles'])}\n")
            f.write(f"Total Positions Needed: {total_positions}\n")
            f.write(f"Total Participants Assigned: {total_assigned}\n")
            f.write(f"Assignment Coverage: {(total_assigned/total_positions)*100:.1f}%\n\n")
            
            # Role-by-role breakdown
            f.write("-"*70 + "\n")
            f.write("ROLE ASSIGNMENTS\n")
            f.write("-"*70 + "\n\n")
            
            for role in requirements['roles']:
                role_id = role['role_id']
                role_name = role['role_name']
                needed = role['quantity_needed']
                assigned_pids = best_assignment.get(role_id, [])
                
                f.write(f"Role: {role_name} ({role_id})\n")
                f.write(f"  Status: {len(assigned_pids)}/{needed} assigned ")
                
                if len(assigned_pids) == needed:
                    f.write("✓ PERFECT\n")
                elif len(assigned_pids) < needed:
                    f.write(f"⚠ SHORT by {needed - len(assigned_pids)}\n")
                else:
                    f.write(f"⚠ OVER by {len(assigned_pids) - needed}\n")
                
                f.write(f"  Required Skills: {', '.join(role['required_skills'])}\n")
                f.write(f"  Assigned Participants:\n")
                
                if assigned_pids:
                    for pid in assigned_pids:
                        if pid in participants_df.index:
                            participant = participants_df.loc[pid]
                            f.write(f"    - {participant['name']} (ID: {pid})\n")
                            f.write(f"      Year: {participant['year']}, "
                                  f"Past Events: {participant['past_events']}\n")
                            
                            # Show skill levels for required skills
                            f.write(f"      Skills: ")
                            skill_str = []
                            for skill in role['required_skills']:
                                if skill in participant.index:
                                    level = participant[skill]
                                    skill_str.append(f"{skill}={int(level)}")
                            f.write(", ".join(skill_str) + "\n")
                else:
                    f.write("    (No participants assigned)\n")
                
                f.write("\n")
            
            # Skill utilization analysis
            f.write("-"*70 + "\n")
            f.write("SKILL UTILIZATION ANALYSIS\n")
            f.write("-"*70 + "\n\n")
            
            all_assigned_pids = {pid for pids in best_assignment.values() for pid in pids}
            metadata_cols = {'name', 'year', 'past_events', 'email', 'phone', 'availability'}
            skill_cols = [col for col in participants_df.columns if col not in metadata_cols]
            
            for skill in skill_cols:
                if skill in participants_df.columns:
                    assigned_skill_levels = [
                        participants_df.loc[pid, skill] 
                        for pid in all_assigned_pids 
                        if pid in participants_df.index
                    ]
                    if assigned_skill_levels:
                        avg_level = sum(assigned_skill_levels) / len(assigned_skill_levels)
                        f.write(f"  {skill}: Avg Level = {avg_level:.2f} "
                              f"({len(assigned_skill_levels)} participants)\n")
            
            f.write("\n")
            f.write("="*70 + "\n")
            f.write("END OF REPORT\n")
            f.write("="*70 + "\n")
        
        print(f"✅ Detailed report saved to '{report_path}'")
    
    except Exception as e:
        print(f"⚠️  Warning: Could not save detailed report: {e}")


def run_team_formation(event_id: str) -> bool:
    """
    Main function to load data and run the team formation optimizer.
    
    Args:
        custom_requirements_path: Optional custom path to requirements JSON
        custom_participants_path: Optional custom path to participants CSV
        
    Returns:
        True if successful, False otherwise
    """
    start_time = datetime.now()
    
    print_banner()
    
    # Step 1: Load Data
    print_section("STEP 1: LOADING DATA")
    
    print("\n📂 Loading event requirements...")
    requirements = data_loader.load_event_requirements(custom_requirements_path)
    
    print("\n📂 Loading participant data...")
    participants_df = data_loader.load_participants(custom_participants_path)
    
    if requirements is None or participants_df is None:
        print("\n" + "="*70)
        print("❌ FAILED: Could not load required data files")
        print("="*70)
        print("\nPlease ensure the following files exist:")
        print("  - team_formation/data/event_requirements.json")
        print("  - team_formation/data/participants.csv")
        return False
    
    # Step 2: Validate Data Compatibility
    print_section("STEP 2: VALIDATING DATA")
    
    is_compatible = data_loader.validate_data_compatibility(requirements, participants_df)
    
    if not is_compatible:
        print("\n⚠️  Data validation failed. Continue anyway? (y/n): ", end='')
        try:
            response = input().strip().lower()
            if response != 'y':
                print("\n❌ Optimization cancelled by user.")
                return False
        except:
            # If running in non-interactive mode, continue anyway
            print("(non-interactive mode - continuing)")
    
    # Step 3: Display Data Summary
    print_section("STEP 3: DATA SUMMARY")
    
    summary = data_loader.get_data_summary(requirements, participants_df)
    
    print(f"\n📊 EVENT INFORMATION")
    print(f"   Name: {summary['event']['name']}")
    print(f"   Total Roles: {summary['event']['total_roles']}")
    print(f"   Total Positions Needed: {summary['event']['total_positions']}")
    print(f"   Unique Skills Required: {summary['event']['unique_skills_required']}")
    
    print(f"\n👥 PARTICIPANT POOL")
    print(f"   Total Participants: {summary['participants']['total_count']}")
    print(f"   Average Experience: {summary['participants']['avg_experience']:.1f} past events")
    print(f"   Available Skills: {summary['participants']['skill_columns']}")
    
    if summary['participants']['year_distribution']:
        print(f"\n📈 YEAR DISTRIBUTION")
        for year, count in sorted(summary['participants']['year_distribution'].items()):
            print(f"   Year {year}: {count} participants")
    
    # Step 4: Run Genetic Algorithm Optimization
    print_section("STEP 4: RUNNING OPTIMIZATION")
    
    print("\n🧬 Initializing Genetic Algorithm...")
    print(f"   Population Size: {team_optimizer_ga.POPULATION_SIZE}")
    print(f"   Generations: {team_optimizer_ga.GENERATIONS}")
    print(f"   Mutation Rate: {team_optimizer_ga.MUTATION_RATE}")
    print(f"   Crossover Rate: {team_optimizer_ga.CROSSOVER_RATE}")
    print(f"   Tournament Size: {team_optimizer_ga.TOURNAMENT_SIZE}")
    print(f"   Elitism: Top {team_optimizer_ga.ELITISM_COUNT} preserved")
    
    print("\n🚀 Starting optimization (this may take a minute)...\n")
    
    try:
        optimizer = team_optimizer_ga.TeamFormationGA(requirements, participants_df)
        best_assignment = optimizer.run()
        
        if not best_assignment:
            print("\n❌ Optimization failed to produce a valid assignment")
            return False
        
    except Exception as e:
        print(f"\n❌ ERROR during optimization: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Step 5: Analyze Results
    print_section("STEP 5: RESULTS ANALYSIS")
    
    final_fitness = utils.calculate_fitness(best_assignment, requirements, participants_df)
    assignment_summary = utils.get_assignment_summary(best_assignment, requirements, participants_df)
    
    print(f"\n🎯 OPTIMIZATION RESULTS")
    print(f"   Final Fitness Score: {final_fitness:.2f}")
    print(f"   Total Participants Assigned: {assignment_summary['overall']['total_participants_assigned']}")
    print(f"   Roles Perfectly Met: {assignment_summary['overall']['roles_met']}/{len(requirements['roles'])}")
    
    if assignment_summary['overall']['roles_understaffed'] > 0:
        print(f"   ⚠️  Understaffed Roles: {assignment_summary['overall']['roles_understaffed']}")
    
    if assignment_summary['overall']['roles_overstaffed'] > 0:
        print(f"   ⚠️  Overstaffed Roles: {assignment_summary['overall']['roles_overstaffed']}")
    
    print(f"\n📋 ROLE-BY-ROLE SUMMARY")
    for role_id, role_info in assignment_summary['roles'].items():
        status_symbol = "✓" if role_info['status'] == 'met' else "⚠"
        print(f"   {status_symbol} {role_info['name']}: {role_info['assigned']}/{role_info['needed']} "
              f"({role_info['status']})")
        
        if role_info['avg_skill_levels']:
            skills_str = ", ".join([f"{k}={v:.1f}" for k, v in role_info['avg_skill_levels'].items()])
            print(f"      Avg Skills: {skills_str}")
    
    # Step 6: Save Results
    print_section("STEP 6: SAVING RESULTS")
    
    end_time = datetime.now()
    execution_time = (end_time - start_time).total_seconds()
    
    print(f"\n💾 Saving optimization results...")
    
    # Main results are already saved by optimizer.run()
    # Save additional detailed report
    save_detailed_report(requirements, participants_df, best_assignment, 
                        final_fitness, execution_time)
    
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output")
    print(f"\n📁 Output files located in: {output_dir}/")
    print(f"   - optimal_teams.json (structured assignment)")
    print(f"   - optimization_report.txt (detailed analysis)")
    
    # Final Summary
    print_section("COMPLETION SUMMARY")
    
    print(f"\n✅ Team formation optimization completed successfully!")
    print(f"   Execution Time: {execution_time:.2f} seconds")
    print(f"   Best Fitness: {final_fitness:.2f}")
    print(f"   Assignment Coverage: {(assignment_summary['overall']['total_participants_assigned'] / summary['event']['total_positions']) * 100:.1f}%")
    
    if assignment_summary['overall']['roles_met'] == len(requirements['roles']):
        print(f"\n🎉 PERFECT! All roles have been filled with the exact number of participants needed!")
    elif assignment_summary['overall']['roles_met'] >= len(requirements['roles']) * 0.8:
        print(f"\n👍 GOOD! Most roles are well-staffed. Minor adjustments may be needed.")
    else:
        print(f"\n⚠️  ATTENTION! Several roles need adjustment. Review the detailed report.")
    
    print(f"\n📖 Next Steps:")
    print(f"   1. Review 'optimal_teams.json' for the full assignment")
    print(f"   2. Check 'optimization_report.txt' for detailed analysis")
    print(f"   3. Make manual adjustments if needed")
    print(f"   4. Communicate assignments to participants")
    
    print("\n" + "="*70)
    print("Thank you for using the Team Formation System! 🎯")
    print("="*70 + "\n")
    
    return True


def main():
    """Command-line entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Team Formation Optimization using Genetic Algorithms',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m team_formation.src.main
  python -m team_formation.src.main --requirements custom_event.json
  python -m team_formation.src.main --participants custom_people.csv
        """
    )
    
    parser.add_argument(
        '--requirements', '-r',
        type=str,
        help='Path to event requirements JSON file'
    )
    
    parser.add_argument(
        '--participants', '-p',
        type=str,
        help='Path to participants CSV file'
    )
    
    parser.add_argument(
        '--version', '-v',
        action='version',
        version='Team Formation System v1.0.0'
    )
    
    args = parser.parse_args()
    
    # Run the optimization
    success = run_team_formation(
        custom_requirements_path=args.requirements,
        custom_participants_path=args.participants
    )
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()