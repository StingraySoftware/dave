"""
Security configuration for DAVE application
"""

import os
from datetime import timedelta


class SecurityConfig:
    """Security-related configuration settings"""

    # Flask Security
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", os.urandom(32).hex())
    SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "True").lower() == "true"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    PERMANENT_SESSION_LIFETIME = timedelta(
        hours=int(os.environ.get("SESSION_LIFETIME_HOURS", "24"))
    )

    # CORS Configuration
    CORS_ENABLED = os.environ.get("CORS_ENABLED", "True").lower() == "true"
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:*").split(",")
    CORS_ALLOW_HEADERS = ["Content-Type", "Authorization"]
    CORS_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]

    # File Upload Security
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_UPLOAD_SIZE_MB", "500")) * 1024 * 1024
    ALLOWED_EXTENSIONS = {
        ".txt",
        ".dat",
        ".lc",
        ".evt",
        ".fits",
        ".fit",
        ".fts",
        ".gz",
        ".p",
        ".nc",
    }
    UPLOAD_FOLDER_PERMISSIONS = 0o755

    # Rate Limiting
    RATELIMIT_ENABLED = os.environ.get("RATELIMIT_ENABLED", "True").lower() == "true"
    RATELIMIT_DEFAULT = os.environ.get("RATELIMIT_DEFAULT", "100 per hour")
    RATELIMIT_STORAGE_URL = os.environ.get("REDIS_URL", "memory://")

    # Security Headers
    SECURITY_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    }

    # Authentication (for future implementation)
    AUTH_ENABLED = os.environ.get("AUTH_ENABLED", "False").lower() == "true"
    AUTH_METHOD = os.environ.get("AUTH_METHOD", "jwt")  # jwt, oauth2, basic
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.environ.get("JWT_TOKEN_LIFETIME_HOURS", "1")))

    # API Security
    API_KEY_ENABLED = os.environ.get("API_KEY_ENABLED", "False").lower() == "true"
    API_KEY_HEADER = "X-API-Key"
    API_KEYS = os.environ.get("API_KEYS", "").split(",") if os.environ.get("API_KEYS") else []

    # Dangerous Endpoints Protection
    PROTECT_SHUTDOWN = os.environ.get("PROTECT_SHUTDOWN", "True").lower() == "true"
    SHUTDOWN_PASSWORD = os.environ.get("SHUTDOWN_PASSWORD", None)

    # Logging Security
    SANITIZE_LOGS = os.environ.get("SANITIZE_LOGS", "True").lower() == "true"
    SENSITIVE_FIELDS = ["password", "token", "secret", "key", "authorization"]

    @classmethod
    def validate_config(cls):
        """Validate security configuration"""
        errors = []

        if cls.SECRET_KEY == os.urandom(32).hex():
            errors.append(
                "WARNING: Using random SECRET_KEY. Set FLASK_SECRET_KEY environment variable."
            )

        if not cls.CORS_ORIGINS:
            errors.append("WARNING: No CORS origins configured.")

        if cls.AUTH_ENABLED and not cls.JWT_SECRET_KEY:
            errors.append("ERROR: AUTH_ENABLED but no JWT_SECRET_KEY set.")

        if cls.API_KEY_ENABLED and not cls.API_KEYS:
            errors.append("ERROR: API_KEY_ENABLED but no API_KEYS configured.")

        if cls.PROTECT_SHUTDOWN and not cls.SHUTDOWN_PASSWORD:
            errors.append("WARNING: Shutdown endpoint protected but no password set.")

        return errors
