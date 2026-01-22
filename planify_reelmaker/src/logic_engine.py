import torch
import clip
from PIL import Image
import numpy as np

class LogicEngine:
    def __init__(self, device):
        self.device = device
        self.model = None
        self.preprocess = None
        self.load_clip()

    def load_clip(self):
        """Loads the CLIP model."""
        try:
            print("-> Loading CLIP model (ViT-B/32)...")
            # jit=False is often safer for some environments
            self.model, self.preprocess = clip.load("ViT-B/32", device=self.device, jit=False)
            print("-> CLIP model loaded successfully.")
        except Exception as e:
            print(f"!!! ERROR: Failed to load CLIP model: {e}")

    def get_image_embedding(self, image_array):
        """Generates CLIP embedding for a numpy image array."""
        if self.model is None:
            return None
        
        try:
            # Convert numpy array to PIL
            pil_image = Image.fromarray(image_array.astype(np.uint8))
            image_input = self.preprocess(pil_image).unsqueeze(0).to(self.device)
            
            with torch.no_grad():
                image_features = self.model.encode_image(image_input)
            
            return image_features / image_features.norm(dim=-1, keepdim=True)
        except Exception as e:
            print(f"   - CLIP embedding failed: {e}")
            return None

    def classify_and_sequence(self, media_list):
        """
        Classifies images into 'Pre-event' (Preparation) and 'Post-event' (Aftermath/Celebration)
        using CLIP, then sequences them logically.
        
        media_list: List of dicts {'name': str, 'array': np.array, 'score': float}
        """
        if self.model is None:
            print("-> CLIP not loaded. Falling back to simple score sorting.")
            # Sort descending by score
            return sorted(media_list, key=lambda x: x.get('score', 0), reverse=True)

        print("-> sequencing media with Logic Inflow (CLIP)...")
        
        # Define prompts for classification
        text_prompts = ["preparation, setup, empty venue, makeup, behind the scenes", 
                        "party, celebration, dancing, crowd, event in progress, happy people"]
        text_tokens = clip.tokenize(text_prompts).to(self.device)
        
        with torch.no_grad():
            text_features = self.model.encode_text(text_tokens)
            text_features /= text_features.norm(dim=-1, keepdim=True)

        pre_event_items = []
        post_event_items = []

        for item in media_list:
            image_emb = self.get_image_embedding(item['array'])
            if image_emb is None:
                # Fallback: put in post-event if uncertain
                post_event_items.append(item)
                continue

            # Calculate similarity
            similarity = (100.0 * image_emb @ text_features.T).softmax(dim=-1)
            probs = similarity[0].cpu().numpy()
            
            # Index 0 = Pre-event, Index 1 = Post-event
            if probs[0] > probs[1]:
                item['logic_type'] = 'pre_event'
                pre_event_items.append(item)
            else:
                item['logic_type'] = 'post_event'
                post_event_items.append(item)

        # Sort each group by quality score (best first)
        pre_event_items.sort(key=lambda x: x.get('score', 0), reverse=True)
        post_event_items.sort(key=lambda x: x.get('score', 0), reverse=True)
        
        print(f"-> Logic Sequencing: {len(pre_event_items)} Pre-event, {len(post_event_items)} Post-event.")
        
        # Combine: Preparation -> Celebration
        return pre_event_items + post_event_items
