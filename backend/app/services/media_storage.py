from __future__ import annotations

from pathlib import Path
from typing import Optional

from ..config import get_settings

_MEDIA_ROOT_CACHE: Optional[Path] = None


def _compute_root() -> Path:
    settings = get_settings()
    candidate = settings.media_root or "media"
    path = Path(candidate)
    if not path.is_absolute():
        path = Path(__file__).resolve().parent.parent / path
    return path


def ensure_media_root() -> Path:
    """Create and return the absolute media root directory."""
    global _MEDIA_ROOT_CACHE
    if _MEDIA_ROOT_CACHE is None:
        _MEDIA_ROOT_CACHE = _compute_root()
    _MEDIA_ROOT_CACHE.mkdir(parents=True, exist_ok=True)
    return _MEDIA_ROOT_CACHE


def ensure_session_dir(session_id: int) -> Path:
    """Ensure and return the directory for a specific exam session."""
    root = ensure_media_root()
    session_dir = root / f"session_{session_id}"
    session_dir.mkdir(parents=True, exist_ok=True)
    return session_dir


def ensure_file_path(session_id: int, filename: str) -> Path:
    """Return an absolute path for storing the final media file."""
    safe_name = filename or f"session_{session_id}.webm"
    return ensure_session_dir(session_id) / safe_name


def write_chunk(session_id: int, filename: str, data: bytes, reset: bool = False) -> Path:
    """Write a chunk to disk, overwriting when reset=True."""
    destination = ensure_file_path(session_id, filename)
    mode = "wb" if reset else "ab"
    with open(destination, mode) as handler:
        handler.write(data)
    return destination


def relative_storage_path(path: Path) -> str:
    """Return a path relative to the media root for persistence."""
    root = ensure_media_root()
    return str(path.resolve().relative_to(root.resolve()))


def resolve_storage_path(storage_path: str) -> Path:
    """Convert a stored relative path back to an absolute path under the media root."""
    root = ensure_media_root().resolve()
    candidate = (root / storage_path).resolve()
    if not str(candidate).startswith(str(root)):
        raise ValueError("Invalid media storage path")
    return candidate


def ensure_certificate_dir(user_id: int) -> Path:
    """Ensure and return the directory for a specific user's certificate files."""
    root = ensure_media_root()
    cert_dir = root / "certificates" / str(user_id)
    cert_dir.mkdir(parents=True, exist_ok=True)
    return cert_dir


def certificate_file_path(user_id: int, filename: str = "certificate.pdf") -> Path:
    """Return an absolute path for storing the user's certificate PDF."""
    safe_name = filename or "certificate.pdf"
    return ensure_certificate_dir(user_id) / safe_name


def ensure_statement_dir(user_id: int, statement_id: int) -> Path:
    """Ensure and return the directory for a specific user's statement attachments."""
    root = ensure_media_root()
    d = root / "statements" / str(user_id) / str(statement_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def ensure_multi_apartment_dir(project_id: int) -> Path:
    """Ensure and return the directory for a specific multi-apartment project."""
    root = ensure_media_root()
    project_dir = root / "multi_apartment" / str(project_id)
    project_dir.mkdir(parents=True, exist_ok=True)
    return project_dir


def multi_apartment_pdf_path(project_id: int, filename: str) -> Path:
    """Return an absolute path for storing the project PDF."""
    safe_name = filename or "project.pdf"
    return ensure_multi_apartment_dir(project_id) / safe_name


