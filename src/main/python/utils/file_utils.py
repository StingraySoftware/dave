import os

from security_config import SecurityConfig
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

import utils.dave_logger as logging
import utils.exception_helper as ExHelper
from config import CONFIG

# Handle libmagic import gracefully - must be after other imports
MAGIC_AVAILABLE = False
try:
    # On Windows CI, python-magic often causes access violations during import
    # Skip magic import in CI environments to prevent hanging
    if os.environ.get("CI") or os.environ.get("GITHUB_ACTIONS"):
        if os.name == "nt":  # Windows
            raise ImportError("Skipping python-magic on Windows CI to prevent access violations")

    import magic

    MAGIC_AVAILABLE = True
except ImportError as e:
    MAGIC_AVAILABLE = False
    logging.warn("python-magic not available, falling back to mimetypes: " + str(e))


def get_destination(target, filename):
    try:
        if CONFIG.IS_LOCAL_SERVER:
            # Import security utils
            from utils.security_utils import sanitize_path

            if filename.startswith("/") and os.path.isfile(filename):
                # Validate absolute path
                sanitized = sanitize_path(filename, "/")
                if sanitized:
                    return sanitized
                else:
                    logging.warning(f"Invalid absolute path: {filename}")
                    return ""
            else:
                # Relative path - must be within target directory
                sanitized = sanitize_path(filename, target)
                if sanitized:
                    return sanitized
                else:
                    logging.warning(f"Invalid relative path: {filename}")
                    return ""
        else:
            # Always use secure filename for uploads
            safe_filename = secure_filename(filename)
            if not safe_filename:
                logging.error(f"Invalid filename: {filename}")
                return ""
            return os.path.join(target, safe_filename)
    except Exception:
        logging.error(ExHelper.getException("get_destination"))
        return ""


def file_exist(target, filename):
    return os.path.isfile(get_destination(target, filename))


def is_valid_file(destination):
    try:
        if not destination or not os.path.isfile(destination):
            return False

        base = os.path.basename(destination)
        file_extension = os.path.splitext(base)[1].lower()

        if MAGIC_AVAILABLE:
            try:
                ext = magic.from_file(destination)
                return (
                    (ext.find("ASCII") == 0)
                    or (ext.find("FITS") == 0)
                    or (ext.find("gzip") > -1)
                    or ((ext == "data") and (file_extension in [".p", ".nc"]))
                )
            except Exception as e:
                # Handle Windows access violations and other magic runtime errors
                logging.warn(f"python-magic runtime error, falling back to extension check: {e}")
                # Fall through to extension-based fallback
        else:
            # Fallback to file extension checking
            valid_extensions = [".txt", ".dat", ".lc", ".evt", ".fits", ".fit", ".gz", ".p", ".nc"]
            if file_extension in valid_extensions:
                return True

            # For files without extension, try to check if it's text
            if file_extension == "":
                try:
                    with open(destination, encoding="utf-8") as f:
                        f.read(1024)  # Try reading first 1KB as text
                    return True
                except (UnicodeDecodeError, OSError):
                    return False

            return False
    except Exception:
        return False


# save_file: Upload a data file to the Flask server path
#            Only called if not IS_LOCAL_SERVER
# @param: file: file to upload
# @param: target: folder name for upload destination
#
def save_file(target: str, file: FileStorage) -> str:
    logging.debug(f"save_file: {type(file)} - {file}")

    # Import security utils
    from utils.security_utils import validate_file_upload

    # Validate file before saving
    is_valid, error_msg = validate_file_upload(file)
    if not is_valid:
        logging.error(f"File validation failed: {error_msg}")
        return ""

    if not os.path.isdir(target):
        os.mkdir(target, SecurityConfig.UPLOAD_FOLDER_PERMISSIONS)

    destination = get_destination(target, file.filename)
    if not destination:
        logging.error("Failed to get valid destination path")
        return ""

    file.save(destination)

    # Set secure file permissions
    os.chmod(destination, 0o644)

    return destination


# get_intermediate_filename: Upload a data file to the Flask server path
#
# @param: filepath: file to upload
# @param: target: folder name for upload destination
#
def get_intermediate_filename(target, filepath, extension):
    if not os.path.isdir(target):
        os.mkdir(target)

    base = os.path.basename(filepath)
    filename = os.path.splitext(base)[0]
    destination = get_destination(target, filename + extension)

    if os.path.isfile(destination):
        os.remove(destination)

    return destination


def get_files_in_dir(dirpath):
    return [f for f in os.listdir(dirpath) if os.path.isfile(os.path.join(dirpath, f))]
