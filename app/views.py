import base64
import json
import os
from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods


def index(request):
    """Render the main application page."""
    return render(request, 'index.html')


@csrf_exempt
@require_http_methods(["POST"])
def upload_image(request):
    """
    Accept a base64-encoded image via POST, decode it,
    and save it to /media/image.png.

    Expected JSON body:
        { "image": "data:image/png;base64,<base64_string>" }

    Returns:
        { "status": "uploaded" }  on success
        { "status": "error", "message": "..." }  on failure
    """
    try:
        body = json.loads(request.body)
        image_data = body.get('image', '')

        if not image_data:
            return JsonResponse({'status': 'error', 'message': 'No image data provided.'}, status=400)

        # Strip the data-URL prefix (e.g. "data:image/png;base64,")
        if ',' in image_data:
            image_data = image_data.split(',', 1)[1]

        # Decode base64 → bytes
        image_bytes = base64.b64decode(image_data)

        # Ensure the media directory exists
        os.makedirs(settings.MEDIA_ROOT, exist_ok=True)

        # Save to media/image.png
        save_path = os.path.join(settings.MEDIA_ROOT, 'image.png')
        with open(save_path, 'wb') as f:
            f.write(image_bytes)

        # Optional: upload to Google Drive (placeholder — not yet implemented)
        upload_to_drive(save_path)

        return JsonResponse({'status': 'uploaded'})

    except (json.JSONDecodeError, ValueError) as e:
        return JsonResponse({'status': 'error', 'message': f'Invalid request: {str(e)}'}, status=400)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': f'Server error: {str(e)}'}, status=500)


# ---------------------------------------------------------------------------
# Google Drive placeholder — implement when ready
# ---------------------------------------------------------------------------

def upload_to_drive(file_path):
    """
    Upload the given file to Google Drive.

    TODO: Implement using the Google Drive API (google-api-python-client).
          Steps:
          1. pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
          2. Create OAuth 2.0 credentials in Google Cloud Console.
          3. Authenticate and build the Drive service.
          4. Call service.files().create(...) with the file_path.

    Args:
        file_path (str): Absolute path to the file to upload.
    """
    pass
