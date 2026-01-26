import requests

def debug_download(font_name):
    url = f"https://fonts.google.com/download?family={font_name}"
    print(f"URL: {url}")
    try:
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        print(f"Content Type: {response.headers.get('content-type')}")
        print(f"First 200 bytes: {response.content[:200]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_download("Montserrat")
