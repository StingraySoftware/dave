#!/usr/bin/env python3
"""
Update version numbers across the project
Usage: python update-version.py <new_version>
"""

import json
import re
import sys
from pathlib import Path


def update_pyproject_toml(version: str) -> None:
    """Update version in pyproject.toml"""
    path = Path("pyproject.toml")
    content = path.read_text()
    
    # Update version line
    content = re.sub(
        r'^version = "[^"]*"',
        f'version = "{version}"',
        content,
        flags=re.MULTILINE
    )
    
    path.write_text(content)
    print(f"Updated {path}")


def update_version_py(version: str) -> None:
    """Update version in __version__.py"""
    path = Path("src/main/python/__version__.py")
    
    # Parse version into tuple
    parts = version.split(".")
    version_tuple = f"({', '.join(parts)})"
    
    content = f'''"""DAVE version information"""

__version__ = "{version}"
__version_info__ = {version_tuple}
__author__ = "StingRay Software Team"
__license__ = "Apache-2.0"
'''
    
    path.write_text(content)
    print(f"Updated {path}")


def update_package_json(version: str) -> None:
    """Update version in package.json"""
    path = Path("src/main/js/electron/package.json")
    
    with open(path, "r") as f:
        data = json.load(f)
    
    data["version"] = version
    
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    
    print(f"Updated {path}")


def update_claude_md(version: str) -> None:
    """Update version in CLAUDE.md"""
    path = Path("CLAUDE.md")
    if not path.exists():
        return
    
    content = path.read_text()
    
    # Update version references
    content = re.sub(
        r'DAVE \d+\.\d+\.\d+',
        f'DAVE {version}',
        content
    )
    
    path.write_text(content)
    print(f"Updated {path}")


def main():
    if len(sys.argv) != 2:
        print("Usage: python update-version.py <new_version>")
        sys.exit(1)
    
    version = sys.argv[1]
    
    # Validate version format
    if not re.match(r'^\d+\.\d+\.\d+(-\w+(\.\d+)?)?$', version):
        print(f"Invalid version format: {version}")
        print("Expected format: X.Y.Z or X.Y.Z-suffix")
        sys.exit(1)
    
    print(f"Updating version to: {version}")
    
    try:
        update_pyproject_toml(version)
        update_version_py(version)
        update_package_json(version)
        update_claude_md(version)
        
        print("\nVersion update complete!")
        
    except Exception as e:
        print(f"Error updating version: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()