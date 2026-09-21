import mimetypes
from pathlib import Path

import functions_framework

STATIC_DIR = Path(__file__).parent / "public"
MOUNT_PREFIX = "/rekap"


@functions_framework.http
def serve_rekap(request):
    rel_path = request.path[len(MOUNT_PREFIX):].lstrip("/") or "index.html"
    file_path = STATIC_DIR / rel_path
    if not file_path.is_file():
        file_path = STATIC_DIR / "index.html"

    content_type, _ = mimetypes.guess_type(file_path.name)
    return (
        file_path.read_bytes(),
        200,
        {"Content-Type": content_type or "application/octet-stream"},
    )
