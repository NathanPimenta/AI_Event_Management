import random
import json
import os
import pandas as pd
from typing import Dict, List, Tuple
from . import data_loader
from . import utils

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output")
OUTPUT_FILENAME = "optimal_teams.json"

# --- GA Configuration ---
POPULATION_SIZE = 100
GENERATIONS = 50
MUTATION_RATE = 0.15
CROSSOVER_RATE = 0.8
TOURNAMENT_SIZE = 5
ELITISM_COUNT = 5  # Keep top N individuals unchanged

class TeamFormationGA:
    def __init__(self, requirements, participants_df):
        self.requirements = requirements
        self.participants_df = participants_df
        self.participant_ids = list(participants_df.index)
        self.roles = requirements['roles']
        self.role_ids = [role['role_id'] for role in self.roles]
        self.population = []
        
        # Create role requirements lookup for quick access
        self.role_requirements = {
            role['role_id']: {
                'quantity': role['quantity_needed'],
                'skills': role['required_skills']
            }
            for role in self.roles
        }

    def _create_individual(self) -> Dict[str, List[str]]:
        """Creates one random assignment (chromosome) with basic constraints."""
        assignment = {role_id: [] for role_id in self.role_ids}
        available_participants = self.participant_ids[:]
        random.shuffle(available_participants)
        
        # First pass: Try to assign each role's required quantity
        for role in self.roles:
            role_id = role['role_id']
            needed = role['quantity_needed']
            required_skills = role['required_skills']
            
            # Score participants for this role based on their skills
            participant_scores = []
            for pid in available_participants:
                if pid not in [p for assigned in assignment.values() for p in assigned]:
                    score = 0
                    for skill in required_skills:
                        if skill in self.participants_df.columns:
                            score += self.participants_df.loc[pid, skill]
                    participant_scores.append((pid, score))
            
            # Sort by score and assign top candidates
            participant_scores.sort(key=lambda x: x[1], reverse=True)
            for i in range(min(needed, len(participant_scores))):
                assignment[role_id].append(participant_scores[i][0])
        
        # Second pass: Assign any remaining participants randomly
        assigned_pids = {p for assigned in assignment.values() for p in assigned}
        remaining = [p for p in self.participant_ids if p not in assigned_pids]
        
        for pid in remaining:
            # Randomly assign to a role that still needs people or has few assigned
            eligible_roles = [
                role_id for role_id in self.role_ids
                if len(assignment[role_id]) < self.role_requirements[role_id]['quantity'] + 1
            ]
            if eligible_roles:
                chosen_role = random.choice(eligible_roles)
                assignment[chosen_role].append(pid)
                
        return assignment

    def _initialize_population(self):
        """Creates the initial population of random assignments."""
        print("-> Initializing population...")
        self.population = [self._create_individual() for _ in range(POPULATION_SIZE)]
        print(f"   - Created {len(self.population)} initial assignments.")

    def _evaluate_population(self):
        """Calculates fitness for each individual in the population."""
        print("-> Evaluating population fitness...")
        fitness_scores = []
        for individual in self.population:
            fitness = utils.calculate_fitness(individual, self.requirements, self.participants_df)
            fitness_scores.append((individual, fitness))
        
        # Sort population by fitness (descending)
        self.population = sorted(fitness_scores, key=lambda x: x[1], reverse=True)
        print(f"   - Best fitness: {self.population[0][1]:.2f}, Worst: {self.population[-1][1]:.2f}")

    def _tournament_selection(self) -> Dict[str, List[str]]:
        """Selects one parent using tournament selection."""
        tournament = random.sample(self.population, min(TOURNAMENT_SIZE, len(self.population)))
        # Tournament is already sorted by fitness from _evaluate_population
        winner = max(tournament, key=lambda x: x[1])
        return winner[0]

    def _selection(self) -> List[Dict[str, List[str]]]:
        """Selects parents for the next generation using tournament selection."""
        parents = []
        num_parents = POPULATION_SIZE - ELITISM_COUNT
        
        for _ in range(num_parents):
            parent = self._tournament_selection()
            parents.append(parent)
        
        return parents

    def _crossover(self, parent1: Dict[str, List[str]], 
                   parent2: Dict[str, List[str]]) -> Tuple[Dict[str, List[str]], Dict[str, List[str]]]:
        """Performs role-based crossover between two parents."""
        if random.random() > CROSSOVER_RATE:
            return parent1.copy(), parent2.copy()
        
        offspring1 = {role_id: [] for role_id in self.role_ids}
        offspring2 = {role_id: [] for role_id in self.role_ids}
        
        # Role-based crossover: for each role, randomly choose which parent contributes
        for role_id in self.role_ids:
            if random.random() < 0.5:
                offspring1[role_id] = parent1[role_id][:]
                offspring2[role_id] = parent2[role_id][:]
            else:
                offspring1[role_id] = parent2[role_id][:]
                offspring2[role_id] = parent1[role_id][:]
        
        # Fix duplicates: if a participant appears multiple times, keep only first occurrence
        for offspring in [offspring1, offspring2]:
            seen = set()
            for role_id in self.role_ids:
                unique_participants = []
                for pid in offspring[role_id]:
                    if pid not in seen:
                        unique_participants.append(pid)
                        seen.add(pid)
                offspring[role_id] = unique_participants
        
        return offspring1, offspring2

    def _mutate(self, individual: Dict[str, List[str]]) -> Dict[str, List[str]]:
        """Applies mutation: reassign random participant to different role or swap two participants."""
        mutated = {role_id: participants[:] for role_id, participants in individual.items()}
        
        mutation_type = random.choice(['reassign', 'swap', 'remove_add'])
        
        if mutation_type == 'reassign':
            # Pick a random role with participants
            non_empty_roles = [r for r in self.role_ids if mutated[r]]
            if non_empty_roles:
                from_role = random.choice(non_empty_roles)
                to_role = random.choice(self.role_ids)
                
                if from_role != to_role and mutated[from_role]:
                    participant = random.choice(mutated[from_role])
                    mutated[from_role].remove(participant)
                    mutated[to_role].append(participant)
        
        elif mutation_type == 'swap':
            # Swap two participants between different roles
            roles_with_participants = [r for r in self.role_ids if len(mutated[r]) > 0]
            if len(roles_with_participants) >= 2:
                role1, role2 = random.sample(roles_with_participants, 2)
                if mutated[role1] and mutated[role2]:
                    p1 = random.choice(mutated[role1])
                    p2 = random.choice(mutated[role2])
                    
                    mutated[role1].remove(p1)
                    mutated[role2].remove(p2)
                    mutated[role1].append(p2)
                    mutated[role2].append(p1)
        
        elif mutation_type == 'remove_add':
            # Remove a participant from overstaffed role and add to understaffed role
            for role_id in self.role_ids:
                needed = self.role_requirements[role_id]['quantity']
                current = len(mutated[role_id])
                
                if current > needed:
                    # Remove from overstaffed
                    participant = random.choice(mutated[role_id])
                    mutated[role_id].remove(participant)
                    
                    # Add to understaffed role
                    understaffed = [r for r in self.role_ids 
                                   if len(mutated[r]) < self.role_requirements[r]['quantity']]
                    if understaffed:
                        target_role = random.choice(understaffed)
                        mutated[target_role].append(participant)
                    break
        
        return mutated

    def run(self):
        """Runs the genetic algorithm."""
        self._initialize_population()
        self._evaluate_population()

        best_fitness_history = []
        avg_fitness_history = []

        for gen in range(GENERATIONS):
            print(f"\n--- Generation {gen + 1}/{GENERATIONS} ---")
            
            # 1. Selection (excluding elites)
            parents = self._selection()
            
            # 2. Keep elite individuals
            elites = [ind[0] for ind in self.population[:ELITISM_COUNT]]
            
            # 3. Crossover & Mutation to create offspring
            offspring = []
            while len(offspring) < POPULATION_SIZE - ELITISM_COUNT:
                p1 = self._tournament_selection()
                p2 = self._tournament_selection()
                
                child1, child2 = self._crossover(p1, p2)
                
                if random.random() < MUTATION_RATE:
                    child1 = self._mutate(child1)
                if random.random() < MUTATION_RATE:
                    child2 = self._mutate(child2)
                
                offspring.extend([child1, child2])
            
            # Trim excess offspring
            offspring = offspring[:POPULATION_SIZE - ELITISM_COUNT]
            
            # 4. Combine elites and offspring for next generation
            next_generation = elites + offspring
            
            # 5. Evaluate new population
            print("-> Evaluating new population...")
            fitness_scores = []
            for individual in next_generation:
                fitness = utils.calculate_fitness(individual, self.requirements, self.participants_df)
                fitness_scores.append((individual, fitness))
            
            self.population = sorted(fitness_scores, key=lambda x: x[1], reverse=True)
            
            # Track statistics
            best_fitness = self.population[0][1]
            avg_fitness = sum(f for _, f in self.population) / len(self.population)
            best_fitness_history.append(best_fitness)
            avg_fitness_history.append(avg_fitness)
            
            print(f"   - Best fitness: {best_fitness:.2f}")
            print(f"   - Average fitness: {avg_fitness:.2f}")
            print(f"   - Improvement: {best_fitness - best_fitness_history[0]:.2f} from initial")

        # Return the best individual found
        best_assignment, best_fitness = self.population[0]
        print(f"\n--- GA Finished ---")
        print(f"Best Fitness Found: {best_fitness:.2f}")
        print(f"Total Improvement: {best_fitness - best_fitness_history[0]:.2f}")
        
        # Save the best assignment
        self.save_result(best_assignment, best_fitness)
        
        return best_assignment

    def save_result(self, assignment, fitness):
        """Saves the final assignment to a JSON file with detailed information."""
        filepath = os.path.join(OUTPUT_DIR, OUTPUT_FILENAME)
        try:
            os.makedirs(OUTPUT_DIR, exist_ok=True)
            
            output_data = {
                "event_name": self.requirements.get('event_name', 'Unknown Event'),
                "fitness_score": round(fitness, 2),
                "total_participants_assigned": sum(len(pids) for pids in assignment.values()),
                "roles": {}
            }
            
            for role in self.roles:
                role_id = role['role_id']
                role_name = role['role_name']
                needed = role['quantity_needed']
                assigned_pids = assignment.get(role_id, [])
                
                participants_info = []
                for pid in assigned_pids:
                    if pid in self.participants_df.index:
                        participant = self.participants_df.loc[pid]
                        skill_match = {}
                        for skill in role['required_skills']:
                            if skill in participant.index:
                                skill_match[skill] = int(participant[skill])
                        
                        participants_info.append({
                            "id": str(pid),
                            "name": participant['name'],
                            "year": int(participant['year']),
                            "past_events": int(participant['past_events']),
                            "skill_levels": skill_match
                        })
                
                output_data["roles"][role_id] = {
                    "role_name": role_name,
                    "quantity_needed": needed,
                    "quantity_assigned": len(assigned_pids),
                    "status": "✓ Met" if len(assigned_pids) == needed else f"⚠ {abs(needed - len(assigned_pids))} {'short' if len(assigned_pids) < needed else 'over'}",
                    "required_skills": role['required_skills'],
                    "assigned_participants": participants_info
                }

            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2)
            print(f"✅ Best team assignment saved to '{filepath}'")
        except Exception as e:
            print(f"❌ ERROR saving result to '{filepath}': {e}")


# Example Usage
if __name__ == "__main__":
    reqs_ga = data_loader.load_event_requirements()
    participants_ga_df = data_loader.load_participants()

    if reqs_ga and participants_ga_df is not None:
        ga = TeamFormationGA(reqs_ga, participants_ga_df)
        best_team = ga.run()
        print("\n✅ Optimization complete! Check output/optimal_teams.json for results.")
    else:
        print("Could not run GA due to data loading errors.")