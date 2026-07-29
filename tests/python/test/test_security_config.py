"""Tests for security_config.SecurityConfig.

SecurityConfig centralizes the Flask security settings; validate_config is
its self-check that reports misconfiguration warnings/errors as strings.
"""

from datetime import timedelta

import pytest
from security_config import SecurityConfig


def test_default_configuration_shape():
    """The defaults DAVE ships with must stay coherent (types and key values)."""
    assert isinstance(SecurityConfig.SECRET_KEY, str) and len(SecurityConfig.SECRET_KEY) >= 32
    assert SecurityConfig.SESSION_COOKIE_HTTPONLY is True
    assert SecurityConfig.SESSION_COOKIE_SAMESITE == "Lax"
    assert isinstance(SecurityConfig.PERMANENT_SESSION_LIFETIME, timedelta)
    assert ".evt" in SecurityConfig.ALLOWED_EXTENSIONS
    assert ".fits" in SecurityConfig.ALLOWED_EXTENSIONS
    assert ".rmf" in SecurityConfig.ALLOWED_EXTENSIONS
    assert SecurityConfig.MAX_CONTENT_LENGTH > 0
    assert "X-Content-Type-Options" in SecurityConfig.SECURITY_HEADERS
    assert SecurityConfig.API_KEY_HEADER == "X-API-Key"


def test_validate_config_reports_no_hard_errors_by_default():
    """The shipped defaults must not produce ERROR-level findings."""
    errors = SecurityConfig.validate_config()
    assert all(not finding.startswith("ERROR") for finding in errors)


def test_validate_config_flags_missing_cors_origins(monkeypatch):
    """Empty CORS origins produce a warning naming CORS."""
    monkeypatch.setattr(SecurityConfig, "CORS_ORIGINS", [])
    errors = SecurityConfig.validate_config()
    assert any("CORS" in finding for finding in errors)


def test_validate_config_flags_auth_without_jwt_secret(monkeypatch):
    """AUTH_ENABLED without a JWT secret is an ERROR-level finding."""
    monkeypatch.setattr(SecurityConfig, "AUTH_ENABLED", True)
    monkeypatch.setattr(SecurityConfig, "JWT_SECRET_KEY", "")
    errors = SecurityConfig.validate_config()
    assert any(finding.startswith("ERROR") and "JWT_SECRET_KEY" in finding for finding in errors)


def test_validate_config_flags_api_keys_enabled_without_keys(monkeypatch):
    """API_KEY_ENABLED without configured keys is an ERROR-level finding."""
    monkeypatch.setattr(SecurityConfig, "API_KEY_ENABLED", True)
    monkeypatch.setattr(SecurityConfig, "API_KEYS", [])
    errors = SecurityConfig.validate_config()
    assert any(finding.startswith("ERROR") and "API_KEYS" in finding for finding in errors)


def test_validate_config_flags_protected_shutdown_without_password(monkeypatch):
    """Shutdown protection without a password produces a warning."""
    monkeypatch.setattr(SecurityConfig, "PROTECT_SHUTDOWN", True)
    monkeypatch.setattr(SecurityConfig, "SHUTDOWN_PASSWORD", None)
    errors = SecurityConfig.validate_config()
    assert any("Shutdown endpoint" in finding for finding in errors)


@pytest.mark.parametrize(
    "attrs",
    [
        {"PROTECT_SHUTDOWN": False},
        {"PROTECT_SHUTDOWN": True, "SHUTDOWN_PASSWORD": "pw"},
    ],
)
def test_validate_config_quiet_when_shutdown_correctly_configured(monkeypatch, attrs):
    """No shutdown warning when protection is off or a password is set."""
    for name, value in attrs.items():
        monkeypatch.setattr(SecurityConfig, name, value)
    errors = SecurityConfig.validate_config()
    assert not any("Shutdown endpoint" in finding for finding in errors)
