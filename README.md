# It's summit — Setup & Deployment Guide

## Local Development

### 1. Clone / extract the project

```
cd /path/to/your/workspace
```

### 2. Create & activate a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the development server

```bash
python manage.py runserver
```

Open http://127.0.0.1:8000 in your browser.

> **Camera note**: `getUserMedia` requires a secure context (HTTPS).  
> In Chrome/Edge you can enable the exception for localhost at:  
> `chrome://flags/#unsafely-treat-insecure-origin-as-secure`  
> Or use Firefox, which allows camera on localhost by default.

---

## Deploy on PythonAnywhere

### 1. Upload the project

- Zip the entire `project/` folder and upload via PythonAnywhere's **Files** tab, or
- Use `git clone` in a PythonAnywhere Bash console.

### 2. Create a virtual environment

```bash
mkvirtualenv --python=python3.10 its-summit
pip install -r requirements.txt
```

### 3. Configure the Web App

- Go to **Web** tab → Add a new web app → Manual configuration → Python 3.10
- Set **Source code**: `/home/<username>/project`
- Set **Working directory**: `/home/<username>/project`

### 4. Edit the WSGI file

In the PythonAnywhere web app WSGI file replace everything with:

```python
import os
import sys

path = '/home/<username>/project'
if path not in sys.path:
    sys.path.insert(0, path)

os.environ['DJANGO_SETTINGS_MODULE'] = 'project.settings'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

### 5. Configure Static & Media files

In the **Web** tab, under **Static files**, add:

| URL          | Directory                                    |
|--------------|----------------------------------------------|
| `/static/`   | `/home/<username>/project/static`            |
| `/media/`    | `/home/<username>/project/media`             |

> You do NOT need to run `collectstatic` if you map `/static/` to the `static/` source folder directly.

### 6. Update settings.py

```python
DEBUG = False
ALLOWED_HOSTS = ['<username>.pythonanywhere.com']
SECRET_KEY = 'your-real-secret-key-here'   # generate a new one!
```

### 7. Reload the Web App

Click **Reload** on the Web tab. Visit `https://<username>.pythonanywhere.com`.

---

## Project Structure

```
project/
├── manage.py
├── requirements.txt
├── README.md
├── project/
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── app/
│   ├── __init__.py
│   ├── views.py       ← /upload endpoint + upload_to_drive() placeholder
│   └── urls.py
├── templates/
│   └── index.html
├── static/
│   ├── style.css
│   ├── script.js
│   ├── frame.png      ← replace with your real frame overlay
│   └── bg.jpg         ← replace with your real background
└── media/             ← uploaded images saved here
```

---

## Replacing Placeholders

- **`static/frame.png`** — Replace with your real transparent frame PNG (any size; it will be scaled to fit).
- **`static/bg.jpg`** — Replace with your desired background image.

---

## Google Drive Integration (future)

Open `app/views.py` and implement the `upload_to_drive(file_path)` function:

```python
# pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2 import service_account

def upload_to_drive(file_path):
    SCOPES = ['https://www.googleapis.com/auth/drive.file']
    creds = service_account.Credentials.from_service_account_file('credentials.json', scopes=SCOPES)
    service = build('drive', 'v3', credentials=creds)
    media = MediaFileUpload(file_path, mimetype='image/png')
    service.files().create(body={'name': os.path.basename(file_path)}, media_body=media, fields='id').execute()
```

