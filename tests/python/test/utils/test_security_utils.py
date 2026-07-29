"""Tests for utils.security_utils.

security_utils guards the upload/analysis endpoints: path confinement,
upload validation, input/log sanitization, request-schema validation,
API-key gating, security headers, CSRF tokens and password hashing.
"""

import os
from io import BytesIO

import pytest
from flask import Flask, jsonify
from security_config import SecurityConfig
from werkzeug.datastructures import FileStorage

import utils.security_utils as Security

# ---------- sanitize_path ----------


def test_sanitize_path_resolves_paths_inside_base(tmp_path):
    """A well-behaved relative path resolves to an absolute path inside base."""
    result = Security.sanitize_path("data.evt", str(tmp_path))
    assert result == str(tmp_path / "data.evt")


def test_sanitize_path_rejects_directory_traversal(tmp_path):
    """`..` components escaping the base directory must be rejected with None."""
    base = tmp_path / "uploads"
    base.mkdir()
    assert Security.sanitize_path("../../etc/passwd", str(base)) is None


def test_sanitize_path_allows_nested_subdirectories(tmp_path):
    """Nested paths that stay inside the base directory are allowed."""
    result = Security.sanitize_path(os.path.join("sub", "dir", "f.txt"), str(tmp_path))
    assert result == str(tmp_path / "sub" / "dir" / "f.txt")


def test_sanitize_path_handles_unresolvable_input():
    """Inputs that blow up path resolution (embedded NUL) return None."""
    assert Security.sanitize_path("bad\x00name", "/tmp") is None


# ---------- validate_file_upload ----------


def _file_storage(filename):
    return FileStorage(stream=BytesIO(b"content"), filename=filename)


def test_validate_file_upload_rejects_missing_file():
    """No file object or empty filename is invalid."""
    valid, message = Security.validate_file_upload(None)
    assert valid is False and message == "No file provided"

    valid, message = Security.validate_file_upload(_file_storage(""))
    assert valid is False and message == "No file provided"


def test_validate_file_upload_rejects_name_that_sanitizes_to_nothing():
    """A filename that secure_filename strips completely is invalid."""
    valid, message = Security.validate_file_upload(_file_storage("../"))
    assert valid is False and message == "Invalid filename"


def test_validate_file_upload_rejects_disallowed_extension():
    """Extensions outside ALLOWED_EXTENSIONS are refused with an explanation."""
    valid, message = Security.validate_file_upload(_file_storage("evil.exe"))
    assert valid is False
    assert "File type not allowed" in message


def test_validate_file_upload_accepts_allowed_extension_case_insensitively():
    """Allowed extensions pass validation regardless of case."""
    valid, message = Security.validate_file_upload(_file_storage("data.EVT"))
    assert valid is True and message == ""


def test_validate_file_upload_honours_custom_extension_set():
    """An explicit allowed_extensions set overrides the configured default."""
    valid, _ = Security.validate_file_upload(_file_storage("notes.md"), {".md"})
    assert valid is True
    valid, _ = Security.validate_file_upload(_file_storage("data.evt"), {".md"})
    assert valid is False


# ---------- sanitize_input ----------


def test_sanitize_input_strips_nul_and_control_characters():
    """NUL and C0 control chars are removed; newline and tab survive."""
    assert Security.sanitize_input("a\x00b\x01c\nd\te") == "abc\nd\te"


def test_sanitize_input_recurses_into_dicts_and_lists():
    """Nested containers are sanitized key-by-key and item-by-item."""
    data = {"k\x00ey": ["v\x01al", {"inner\x02": "ok"}]}
    assert Security.sanitize_input(data) == {"key": ["val", {"inner": "ok"}]}


def test_sanitize_input_returns_none_beyond_max_depth():
    """Recursion depth exhaustion yields None instead of unbounded recursion."""
    assert Security.sanitize_input("value", max_depth=0) is None


def test_sanitize_input_passes_through_other_types():
    """Non-string scalars are returned unchanged."""
    assert Security.sanitize_input(42) == 42
    assert Security.sanitize_input(None) is None


# ---------- sanitize_log_data ----------


def test_sanitize_log_data_redacts_sensitive_fields_recursively():
    """Keys containing password/token/secret/key/authorization are redacted."""
    data = {
        "username": "user",
        "password": "hunter2",
        "nested": {"api_token": "abc", "value": 1},
    }
    result = Security.sanitize_log_data(data)
    assert result["username"] == "user"
    assert result["password"] == "***REDACTED***"
    assert result["nested"] == {"api_token": "***REDACTED***", "value": 1}


def test_sanitize_log_data_redacts_nested_dict_values():
    """Nested dicts under non-sensitive keys are sanitized recursively."""
    data = {"outer": {"secret": "s3cr3t", "plain": "x"}}
    result = Security.sanitize_log_data(data)
    assert result["outer"]["secret"] == "***REDACTED***"
    assert result["outer"]["plain"] == "x"


def test_sanitize_log_data_disabled_returns_data_untouched(monkeypatch):
    """With SANITIZE_LOGS off the data passes through unmodified."""
    monkeypatch.setattr(SecurityConfig, "SANITIZE_LOGS", False)
    data = {"password": "visible"}
    assert Security.sanitize_log_data(data) is data


# ---------- validate_request_data decorator ----------


@pytest.fixture
def schema_app():
    """A minimal Flask app with a schema-validated JSON view."""
    app = Flask(__name__)

    @app.route("/validated", methods=["POST"])
    @Security.validate_request_data(
        {
            "filename": {"type": str, "required": True, "max_length": 10},
            "dt": {"type": float, "min": 0.001, "max": 100.0},
            "mode": {"type": str, "pattern": r"^[a-z]+$"},
        }
    )
    def validated():
        return jsonify(ok=True)

    return app.test_client()


def test_validate_request_data_accepts_valid_payload(schema_app):
    """A payload matching the schema reaches the wrapped view."""
    response = schema_app.post("/validated", json={"filename": "a.evt", "dt": 1.5, "mode": "avg"})
    assert response.status_code == 200
    assert response.get_json() == {"ok": True}


def test_validate_request_data_rejects_missing_required_field(schema_app):
    """Missing required fields are refused with a 400 naming the field."""
    response = schema_app.post("/validated", json={"dt": 1.5})
    assert response.status_code == 400
    assert "filename" in response.get_json()["error"]


def test_validate_request_data_rejects_wrong_type(schema_app):
    """Type mismatches are refused with a 400 naming the expected type."""
    response = schema_app.post("/validated", json={"filename": 42})
    assert response.status_code == 400
    assert "Invalid type for filename" in response.get_json()["error"]


def test_validate_request_data_enforces_numeric_bounds(schema_app):
    """min/max rules produce 400 for out-of-range numbers."""
    response = schema_app.post("/validated", json={"filename": "a.evt", "dt": 0.0})
    assert response.status_code == 400
    assert "dt must be >= 0.001" in response.get_json()["error"]

    response = schema_app.post("/validated", json={"filename": "a.evt", "dt": 1000.0})
    assert response.status_code == 400
    assert "dt must be <= 100.0" in response.get_json()["error"]


def test_validate_request_data_enforces_string_rules(schema_app):
    """pattern and max_length string rules produce 400 responses."""
    response = schema_app.post("/validated", json={"filename": "a.evt", "mode": "NOT_LOWER"})
    assert response.status_code == 400
    assert "Invalid format for mode" in response.get_json()["error"]

    response = schema_app.post("/validated", json={"filename": "much_too_long_name.evt"})
    assert response.status_code == 400
    assert "maximum length" in response.get_json()["error"]


def test_validate_request_data_treats_non_json_request_as_empty(schema_app):
    """A non-JSON body counts as an empty payload: required fields then fail."""
    response = schema_app.post("/validated", data="plain body")
    assert response.status_code == 400
    assert "filename" in response.get_json()["error"]


# ---------- require_api_key decorator ----------


@pytest.fixture
def api_key_app():
    app = Flask(__name__)

    @app.route("/protected")
    @Security.require_api_key
    def protected():
        return jsonify(ok=True)

    return app.test_client()


def test_require_api_key_passthrough_when_disabled(api_key_app, monkeypatch):
    """With API_KEY_ENABLED off no key is needed."""
    monkeypatch.setattr(SecurityConfig, "API_KEY_ENABLED", False)
    assert api_key_app.get("/protected").status_code == 200


def test_require_api_key_rejects_missing_and_invalid_keys(api_key_app, monkeypatch):
    """With API keys enabled, missing or unknown keys yield 401."""
    monkeypatch.setattr(SecurityConfig, "API_KEY_ENABLED", True)
    monkeypatch.setattr(SecurityConfig, "API_KEYS", ["good-key"])

    response = api_key_app.get("/protected")
    assert response.status_code == 401
    assert response.get_json()["error"] == "API key required"

    response = api_key_app.get("/protected", headers={"X-API-Key": "bad-key"})
    assert response.status_code == 401
    assert response.get_json()["error"] == "Invalid API key"


def test_require_api_key_accepts_configured_key(api_key_app, monkeypatch):
    """A configured key in the X-API-Key header unlocks the view."""
    monkeypatch.setattr(SecurityConfig, "API_KEY_ENABLED", True)
    monkeypatch.setattr(SecurityConfig, "API_KEYS", ["good-key"])
    response = api_key_app.get("/protected", headers={"X-API-Key": "good-key"})
    assert response.status_code == 200


# ---------- headers / csrf / passwords ----------


def test_apply_security_headers_sets_all_configured_headers():
    """Every header in SECURITY_HEADERS is stamped onto the response."""
    app = Flask(__name__)
    with app.test_request_context("/"):
        response = app.make_response("body")
        result = Security.apply_security_headers(response)
    for header, value in SecurityConfig.SECURITY_HEADERS.items():
        assert result.headers[header] == value


def test_csrf_token_generation_and_validation():
    """A generated token validates; a different token does not."""
    app = Flask(__name__)
    with app.test_request_context("/"):
        token = Security.generate_csrf_token()
        assert len(token) == 64  # 32 random bytes as hex
        # Repeated calls in the same request return the same token
        assert Security.generate_csrf_token() == token
        assert Security.validate_csrf_token(token) is True
        assert Security.validate_csrf_token("0" * 64) is False


def test_validate_csrf_token_without_generated_token_is_false():
    """Validation before any token was generated must fail closed."""
    app = Flask(__name__)
    with app.test_request_context("/"):
        assert Security.validate_csrf_token("anything") is False


def test_hash_password_roundtrip_and_rejection():
    """verify_password accepts the original password and rejects others."""
    hashed, salt = Security.hash_password("correct horse")
    assert Security.verify_password("correct horse", hashed, salt) is True
    assert Security.verify_password("battery staple", hashed, salt) is False


def test_hash_password_is_deterministic_for_same_salt():
    """Hashing with an explicit hex salt reproduces the same digest."""
    hashed1, salt = Security.hash_password("pw")
    hashed2, salt2 = Security.hash_password("pw", salt)
    assert hashed1 == hashed2
    assert salt == salt2
