import sys
import os
import json

# Adjust path to include project root
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

from planify_reelmaker.src import agentic_reelmaker

def evaluate_script(input_context: str, generated_script: str) -> dict:
    """
    Evaluates the generated script using LLM-as-a-judge (Ollama).
    Scores the script on Coherence and Precision on a scale of 1-10.
    """
    prompt = f"""You are an expert evaluator for AI-generated video scripts. 
Evaluate the following generated script based on the provided input context.

[Input Context]: {input_context}

[Generated Script]: {generated_script}

Evaluate on two metrics (Score 1-10 each):
1. Precision: Does the script stick exactly to the provided input context without hallucinating or adding random, unrelated details? (10 = perfectly accurate to context, 1 = completely unrelated/hallucinated).
2. Coherence: Does the script flow logically, have natural transitions, and read well as a continuous, engaging video narrative? (10 = perfectly coherent and fluid, 1 = disjointed, confusing).

Output ONLY a valid JSON object with the scores and a brief one-sentence reason for each. No other text.
Format example: 
{{
  "precision_score": 8,
  "precision_reason": "...",
  "coherence_score": 9,
  "coherence_reason": "..."
}}
"""

    response = agentic_reelmaker.call_ollama(prompt, model="llama3:8b")
    
    if response:
        try:
            # Clean up response to ensure it parses as JSON
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()
            
            result = json.loads(json_str)
            return result
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON response: {e}\nRaw output: {response}")
            return None
    return None

if __name__ == "__main__":
    # Test Data Example
    test_context = "A technology workshop focused on learning Python and professional networking."
    print("Generating test script...")
    
    generated_script = agentic_reelmaker.generate_script_from_text(test_context, video_duration_sec=15.0)
    
    print("\n--- Generated Script ---")
    print(generated_script)
    print("------------------------\n")
    
    print("Evaluating Precision and Coherence scores using LLM-as-a-judge...")
    scores = evaluate_script(test_context, generated_script)
    
    if scores:
        print("\n=== Evaluation Results ===")
        print(f"Precision Score : {scores.get('precision_score', 'N/A')}/10")
        print(f"Reason          : {scores.get('precision_reason', 'N/A')}")
        print(f"Coherence Score : {scores.get('coherence_score', 'N/A')}/10")
        print(f"Reason          : {scores.get('coherence_reason', 'N/A')}")
        print("==========================\n")
    else:
        print("Evaluation failed. Please check Ollama connection.")
