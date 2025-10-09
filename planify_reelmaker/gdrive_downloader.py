import os
import io
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# Define the scopes required for the Drive API
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
CREDENTIALS_FILE = 'credintials.json'

def download_images_from_folder(folder_url, save_path='temp_images', max_images=15):
    """
    Downloads images from a shared Google Drive folder.
    """
    # Create the save directory if it doesn't exist
    if not os.path.exists(save_path):
        os.makedirs(save_path)

    # Authenticate using the service account
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_FILE, scopes=SCOPES)
    service = build('drive', 'v3', credentials=creds)

    # Extract folder ID from the URL
    folder_id = folder_url.split('/')[-1].split('?')[0]

    print(f"-> Accessing Google Drive folder: {folder_id}")

    # Query to find image files in the specified folder
    query = f"'{folder_id}' in parents and mimeType contains 'image/'"
    results = service.files().list(
        q=query,
        pageSize=max_images,
        fields="nextPageToken, files(id, name)"
    ).execute()
    items = results.get('files', [])

    if not items:
        print("No image files found in the folder.")
        return []

    downloaded_files = []
    print(f"-> Found {len(items)} images. Downloading the first {min(len(items), max_images)}...")

    for item in items:
        file_id = item['id']
        file_name = item['name']
        file_path = os.path.join(save_path, file_name)

        request = service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        
        done = False
        while not done:
            status, done = downloader.next_chunk()
            print(f"   Downloading {file_name}: {int(status.progress() * 100)}%")

        # Write the downloaded content to a file
        with open(file_path, 'wb') as f:
            f.write(fh.getvalue())
        
        downloaded_files.append(file_path)
    
    print("-> Image download complete.")
    return downloaded_files