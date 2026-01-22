import json
import uuid
import urllib.request
import urllib.parse
import websocket # websocket-client
import time

class ComfyUIClient:
    def __init__(self, server_address="127.0.0.1:8188"):
        self.server_address = server_address
        self.client_id = str(uuid.uuid4())
        self.ws = None

    def connect(self):
        """Establishes a WebSocket connection to the ComfyUI server."""
        try:
            ws_url = f"ws://{self.server_address}/ws?clientId={self.client_id}"
            self.ws = websocket.WebSocket()
            self.ws.connect(ws_url)
            print(f"-> Connected to ComfyUI at {ws_url}")
            return True
        except Exception as e:
            print(f"!!! ERROR: Could not connect to ComfyUI WebSocket: {e}")
            return False

    def close(self):
        if self.ws:
            self.ws.close()

    def queue_prompt(self, prompt_workflow):
        """
        Sends a workflow (prompt) to the ComfyUI server.
        Returns the prompt_id.
        """
        p = {"prompt": prompt_workflow, "client_id": self.client_id}
        data = json.dumps(p).encode('utf-8')
        req = urllib.request.Request(f"http://{self.server_address}/prompt", data=data)
        
        try:
            with urllib.request.urlopen(req) as response:
                response_data = json.loads(response.read())
                return response_data['prompt_id']
        except Exception as e:
            print(f"!!! ERROR: Failed to queue prompt: {e}")
            return None

    def get_history(self, prompt_id):
        """Retrieves history for a specific prompt_id to get output filenames."""
        try:
            with urllib.request.urlopen(f"http://{self.server_address}/history/{prompt_id}") as response:
                return json.loads(response.read())
        except Exception as e:
            print(f"!!! ERROR: Failed to get history for {prompt_id}: {e}")
            return None

    def get_image(self, filename, subfolder, folder_type):
        """Downloads an image/video from ComfyUI."""
        data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
        url_values = urllib.parse.urlencode(data)
        try:
            with urllib.request.urlopen(f"http://{self.server_address}/view?{url_values}") as response:
                return response.read()
        except Exception as e:
            print(f"!!! ERROR: Failed to download media {filename}: {e}")
            return None

    def wait_for_completion(self, prompt_id):
        """
        Waits for the prompt execution to finish by listening to the WebSocket.
        Returns the outputs dictionary from history.
        """
        if not self.ws:
            if not self.connect():
                return None

        while True:
            try:
                out = self.ws.recv()
                if isinstance(out, str):
                    message = json.loads(out)
                    # print(f"DEBUG: WS Message: {message['type']}") 
                    if message['type'] == 'executing':
                        data = message['data']
                        if data['node'] is None and data['prompt_id'] == prompt_id:
                            print("-> ComfyUI execution finished.")
                            break
            except Exception as e:
                print(f"!!! ERROR: WebSocket error while waiting: {e}")
                break
        
        # execution finished, fetch history
        history = self.get_history(prompt_id)
        if history and prompt_id in history:
            return history[prompt_id]['outputs']
        return None
