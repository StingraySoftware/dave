"""
Security utilities for DAVE application
"""

import hashlib
import hmac
import os
import re
from functools import wraps
from pathlib import Path
from typing import Any

from flask import jsonify, request
from security_config import SecurityConfig
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

import utils.dave_logger as logging


def sanitize_path(filepath: str, base_path: str) -> str | None:
    """
    Sanitize file path to prevent directory traversal attacks

    Args:
        filepath: The file path to sanitize
        base_path: The base directory that files should be confined to

    Returns:
        Sanitized absolute path or None if path is invalid
    """
    try:
        # Get absolute paths
        base = Path(base_path).resolve()
        file_path = Path(base_path).joinpath(filepath).resolve()

        # Check if file_path is within base_path
        if base in file_path.parents or file_path == base:
            return str(file_path)
        else:
            logging.warning(f"Path traversal attempt detected: {filepath}")
            return None
    except Exception as e:
        logging.error(f"Error sanitizing path: {e}")
        return None


def validate_file_upload(
    file: FileStorage, allowed_extensions: set | None = None
) -> tuple[bool, str]:
    """
    Validate uploaded file

    Args:
        file: The uploaded file
        allowed_extensions: Set of allowed file extensions

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not file or not file.filename:
        return False, "No file provided"

    # Check file size (enforced by Flask MAX_CONTENT_LENGTH)

    # Secure the filename
    filename = secure_filename(file.filename)
    if not filename:
        return False, "Invalid filename"

    # Check extension
    if allowed_extensions is None:
        allowed_extensions = SecurityConfig.ALLOWED_EXTENSIONS

    ext = os.path.splitext(filename)[1].lower()

    # Convert allowed_extensions to lowercase for case-insensitive comparison
    allowed_extensions_lower = {ext.lower() for ext in allowed_extensions}

    if ext not in allowed_extensions_lower:
        # Log more detailed validation failure
        logging.warning(
            f"File type validation failed for '{filename}' with extension '{ext}'. Allowed: {allowed_extensions_lower}"
        )
        return (
            False,
            f"File type not allowed. Allowed types: {', '.join(sorted(allowed_extensions_lower))}",
        )

    # Additional validation could include:
    # - Magic byte validation
    # - Virus scanning
    # - Content validation

    return True, ""


def sanitize_input(data: Any, max_depth: int = 10) -> Any:
    """
    Sanitize input data to prevent injection attacks

    Args:
        data: Input data to sanitize
        max_depth: Maximum recursion depth

    Returns:
        Sanitized data
    """
    if max_depth <= 0:
        return None

    if isinstance(data, str):
        # Remove null bytes
        data = data.replace("\x00", "")
        # Remove control characters except newline and tab
        data = re.sub(r"[\x01-\x08\x0b-\x0c\x0e-\x1f\x7f]", "", data)
        return data

    elif isinstance(data, dict):
        return {
            sanitize_input(k, max_depth - 1): sanitize_input(v, max_depth - 1)
            for k, v in data.items()
        }

    elif isinstance(data, list):
        return [sanitize_input(item, max_depth - 1) for item in data]

    else:
        return data


def sanitize_log_data(data: dict[str, Any]) -> dict[str, Any]:
    """
    Sanitize sensitive data before logging

    Args:
        data: Data to sanitize

    Returns:
        Sanitized data safe for logging
    """
    if not SecurityConfig.SANITIZE_LOGS:
        return data

    sanitized = {}
    for key, value in data.items():
        if any(sensitive in key.lower() for sensitive in SecurityConfig.SENSITIVE_FIELDS):
            sanitized[key] = "***REDACTED***"
        elif isinstance(value, dict):
            sanitized[key] = sanitize_log_data(value)
        else:
            sanitized[key] = value

    return sanitized


def validate_request_data(schema: dict[str, Any]):
    """
    Decorator to validate request data against a schema

    Args:
        schema: Dictionary defining expected fields and types

    Example:
        @validate_request_data({
            'filename': {'type': str, 'required': True},
            'dt': {'type': float, 'required': True, 'min': 0.001}
        })
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            data = request.get_json() if request.is_json else {}

            for field, rules in schema.items():
                # Check required fields
                if rules.get("required", False) and field not in data:
                    return jsonify(error=f"Missing required field: {field}"), 400

                if field in data:
                    value = data[field]

                    # Type checking
                    expected_type = rules.get("type")
                    if expected_type and not isinstance(value, expected_type):
                        return jsonify(
                            error=f"Invalid type for {field}. Expected {expected_type.__name__}"
                        ), 400

                    # Min/max validation for numbers
                    if isinstance(value, int | float):
                        min_val = rules.get("min")
                        max_val = rules.get("max")

                        if min_val is not None and value < min_val:
                            return jsonify(error=f"{field} must be >= {min_val}"), 400

                        if max_val is not None and value > max_val:
                            return jsonify(error=f"{field} must be <= {max_val}"), 400

                    # String validation
                    if isinstance(value, str):
                        pattern = rules.get("pattern")
                        if pattern and not re.match(pattern, value):
                            return jsonify(error=f"Invalid format for {field}"), 400

                        max_length = rules.get("max_length")
                        if max_length and len(value) > max_length:
                            return jsonify(
                                error=f"{field} exceeds maximum length of {max_length}"
                            ), 400

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def require_api_key(f):
    """
    Decorator to require API key authentication
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not SecurityConfig.API_KEY_ENABLED:
            return f(*args, **kwargs)

        api_key = request.headers.get(SecurityConfig.API_KEY_HEADER)

        if not api_key:
            return jsonify(error="API key required"), 401

        if api_key not in SecurityConfig.API_KEYS:
            return jsonify(error="Invalid API key"), 401

        return f(*args, **kwargs)

    return decorated_function


def apply_security_headers(response):
    """
    Apply security headers to response
    """
    for header, value in SecurityConfig.SECURITY_HEADERS.items():
        response.headers[header] = value
    return response


def generate_csrf_token() -> str:
    """
    Generate CSRF token
    """
    if not hasattr(request, "csrf_token"):
        request.csrf_token = os.urandom(32).hex()
    return request.csrf_token


def validate_csrf_token(token: str) -> bool:
    """
    Validate CSRF token
    """
    return hasattr(request, "csrf_token") and hmac.compare_digest(request.csrf_token, token)


def hash_password(password: str, salt: bytes | None = None) -> tuple[str, str]:
    """
    Hash password using PBKDF2

    Args:
        password: Password to hash
        salt: Optional salt (will be generated if not provided)

    Returns:
        Tuple of (hashed_password, salt) as hex strings
    """
    if salt is None:
        salt = os.urandom(32)
    else:
        salt = bytes.fromhex(salt) if isinstance(salt, str) else salt

    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return hashed.hex(), salt.hex()


def verify_password(password: str, hashed: str, salt: str) -> bool:
    """
    Verify password against hash
    """
    computed_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(computed_hash, hashed)
