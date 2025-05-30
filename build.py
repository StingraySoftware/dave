#!/usr/bin/env python3
"""
Modern build system for DAVE - Data Analysis of Variable Events
Replaces legacy bash scripts with cross-platform Python solution
"""

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


class DaveBuilder:
    """Main builder class for DAVE application"""
    
    def __init__(self, platform_name: Optional[str] = None):
        self.platform_name = platform_name or self._detect_platform()
        self.project_root = Path(__file__).parent
        self.build_dir = self.project_root / "build"
        self.dist_dir = self.project_root / "dist"
        self.version = self._generate_version()
        self.electron_dir = self.project_root / "src" / "main" / "js" / "electron"
        
    def _detect_platform(self) -> str:
        """Detect the current platform"""
        system = platform.system().lower()
        if system == "darwin":
            return "macos"
        elif system == "linux":
            return "linux"
        elif system == "windows":
            return "windows"
        else:
            raise ValueError(f"Unsupported platform: {system}")
    
    def _generate_version(self) -> str:
        """Generate version string from git and timestamp"""
        try:
            # Get git commit hash
            commit = subprocess.check_output(
                ["git", "rev-parse", "--short", "HEAD"],
                cwd=self.project_root,
                text=True
            ).strip()
        except (subprocess.CalledProcessError, FileNotFoundError):
            commit = "unknown"
        
        # Generate timestamp
        timestamp = datetime.now().strftime("%Y%m%d.%H%M%S")
        
        # Check for CI build number
        build_number = os.environ.get("BUILD_NUMBER")
        job_name = os.environ.get("JOB_NAME", "dave")
        
        if build_number:
            return f"{job_name}-build{build_number}"
        else:
            return f"{timestamp}-{commit}"
    
    def _update_package_json(self) -> None:
        """Update version in package.json"""
        package_path = self.electron_dir / "package.json"
        with open(package_path, "r") as f:
            data = json.load(f)
        
        data["version"] = self.version
        
        with open(package_path, "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")  # Add trailing newline
        
        print(f"Updated package.json version to: {self.version}")
    
    def _run_command(self, cmd: List[str], cwd: Optional[Path] = None) -> None:
        """Run a command with error handling"""
        print(f"Running: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            cwd=cwd or self.project_root,
            check=True,
            capture_output=True,
            text=True
        )
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
    
    def clean(self) -> None:
        """Clean build artifacts"""
        print("Cleaning build artifacts...")
        
        # Remove build directories
        for dir_path in [self.build_dir, self.dist_dir]:
            if dir_path.exists():
                shutil.rmtree(dir_path)
                print(f"Removed: {dir_path}")
        
        # Clean node_modules if requested
        node_modules = self.electron_dir / "node_modules"
        if node_modules.exists() and input("Remove node_modules? (y/N): ").lower() == "y":
            shutil.rmtree(node_modules)
            print(f"Removed: {node_modules}")
    
    def install_dependencies(self) -> None:
        """Install Node.js dependencies"""
        print("Installing Node.js dependencies...")
        self._run_command(["npm", "ci"], cwd=self.electron_dir)
    
    def build_electron(self, use_forge: bool = False) -> None:
        """Build Electron application"""
        print(f"Building Electron app for {self.platform_name}...")
        
        # Update package.json version
        self._update_package_json()
        
        if use_forge:
            # Use Electron Forge
            print("Using Electron Forge for building...")
            
            # Package the app first
            self._run_command(["npm", "run", "forge:package"], cwd=self.electron_dir)
            
            # Then create installers
            forge_targets = {
                "linux": "forge:make-linux",
                "macos": "forge:make-mac", 
                "windows": "forge:make-win"
            }
            
            forge_target = forge_targets.get(self.platform_name)
            if forge_target:
                self._run_command(["npm", "run", forge_target], cwd=self.electron_dir)
        else:
            # Use Electron Builder (legacy)
            print("Using Electron Builder (legacy)...")
            
            targets = {
                "linux": "build-linux",
                "macos": "build-mac",
                "windows": "build-win"
            }
            
            build_target = targets.get(self.platform_name)
            if not build_target:
                raise ValueError(f"No build target for platform: {self.platform_name}")
            
            # Run Electron build
            self._run_command(["npm", "run", build_target], cwd=self.electron_dir)
    
    def copy_resources(self) -> None:
        """Copy additional resources to build output"""
        print("Copying resources...")
        
        # Platform-specific resource paths
        if self.platform_name == "linux":
            resources_dir = self.electron_dir / "build" / "DAVEApp-linux-x64" / "resources"
        elif self.platform_name == "macos":
            resources_dir = (
                self.electron_dir / "build" / "DAVEApp-darwin-x64" / 
                "DAVEApp.app" / "Contents" / "Resources"
            )
        elif self.platform_name == "windows":
            resources_dir = self.electron_dir / "build" / "DAVEApp-win32-x64" / "resources"
        else:
            raise ValueError(f"Unknown platform: {self.platform_name}")
        
        if not resources_dir.exists():
            raise FileNotFoundError(f"Resources directory not found: {resources_dir}")
        
        # Copy static resources
        static_src = self.project_root / "src" / "main" / "resources" / "static"
        static_dst = resources_dir / "static"
        if static_src.exists():
            shutil.copytree(static_src, static_dst, dirs_exist_ok=True)
            print(f"Copied static resources to: {static_dst}")
        
        # Copy templates
        templates_src = self.project_root / "src" / "main" / "resources" / "templates"
        templates_dst = resources_dir / "templates"
        if templates_src.exists():
            shutil.copytree(templates_src, templates_dst, dirs_exist_ok=True)
            print(f"Copied templates to: {templates_dst}")
        
        # Copy bash scripts
        bash_src = self.project_root / "src" / "main" / "resources" / "bash"
        bash_dst = resources_dir / "bash"
        if bash_src.exists():
            shutil.copytree(bash_src, bash_dst, dirs_exist_ok=True)
            print(f"Copied bash scripts to: {bash_dst}")
        
        # Create version files
        self._create_version_files(resources_dir)
    
    def _create_version_files(self, resources_dir: Path) -> None:
        """Create version tracking files"""
        # Create version.txt
        version_txt = resources_dir / "version.txt"
        version_txt.write_text(self.version)
        print(f"Created: {version_txt}")
        
        # Create version.js
        version_js = resources_dir / "static" / "scripts" / "version.js"
        version_js_content = f'var VERSION = "{self.version}";\n'
        version_js.write_text(version_js_content)
        print(f"Created: {version_js}")
    
    def create_distribution(self) -> Path:
        """Create distribution package"""
        print("Creating distribution package...")
        
        # Ensure dist directory exists
        self.dist_dir.mkdir(exist_ok=True)
        
        # Determine build output directory
        if self.platform_name == "linux":
            build_output = self.electron_dir / "build" / "DAVEApp-linux-x64"
            archive_name = f"DAVEApp-{self.version}-linux-x64.zip"
        elif self.platform_name == "macos":
            build_output = self.electron_dir / "build" / "DAVEApp-darwin-x64"
            archive_name = f"DAVEApp-{self.version}-darwin-x64.zip"
        elif self.platform_name == "windows":
            build_output = self.electron_dir / "build" / "DAVEApp-win32-x64"
            archive_name = f"DAVEApp-{self.version}-win32-x64.zip"
        else:
            raise ValueError(f"Unknown platform: {self.platform_name}")
        
        if not build_output.exists():
            raise FileNotFoundError(f"Build output not found: {build_output}")
        
        # Create zip archive
        archive_path = self.dist_dir / archive_name
        print(f"Creating archive: {archive_path}")
        
        with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(build_output):
                for file in files:
                    file_path = Path(root) / file
                    arc_name = file_path.relative_to(build_output.parent)
                    zf.write(file_path, arc_name)
        
        print(f"Distribution package created: {archive_path}")
        print(f"Size: {archive_path.stat().st_size / 1024 / 1024:.2f} MB")
        
        return archive_path
    
    def build_python(self) -> None:
        """Build Python components (future: wheel/executable)"""
        print("Building Python components...")
        
        # For now, we rely on Pixi environment
        # In the future, this could:
        # - Build a Python wheel
        # - Create a standalone executable with PyInstaller
        # - Bundle Python runtime
        
        print("Python build complete (using Pixi environment)")
    
    def run_tests(self) -> None:
        """Run test suite"""
        print("Running tests...")
        
        # Run Python tests
        print("\nRunning Python tests...")
        self._run_command(["pixi", "run", "test"])
        
        # Run Electron tests if they exist
        test_script = self.electron_dir / "package.json"
        with open(test_script) as f:
            package_data = json.load(f)
        
        if "test" in package_data.get("scripts", {}):
            print("\nRunning Electron tests...")
            self._run_command(["npm", "test"], cwd=self.electron_dir)
    
    def full_build(self, use_forge: bool = False) -> Path:
        """Execute full build pipeline"""
        print(f"Starting full build for {self.platform_name}")
        print(f"Version: {self.version}")
        print(f"Build system: {'Electron Forge' if use_forge else 'Electron Builder'}")
        print("-" * 60)
        
        try:
            # Install dependencies
            self.install_dependencies()
            
            # Build components
            self.build_python()
            self.build_electron(use_forge=use_forge)
            
            if not use_forge:
                # Only copy resources for Electron Builder
                # Forge handles this automatically
                self.copy_resources()
                
                # Create distribution
                dist_path = self.create_distribution()
            else:
                # For Forge, return the output directory
                dist_path = self.electron_dir / "out"
            
            print("\n" + "=" * 60)
            print(f"Build completed successfully!")
            print(f"Output: {dist_path}")
            print("=" * 60)
            
            return dist_path
            
        except Exception as e:
            print(f"\nBuild failed: {e}", file=sys.stderr)
            raise


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Build DAVE application",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python build.py                    # Full build for current platform
  python build.py --platform linux   # Build for specific platform
  python build.py --forge            # Use Electron Forge instead of Builder
  python build.py --clean            # Clean build artifacts
  python build.py --test             # Run tests only
        """
    )
    
    parser.add_argument(
        "--platform",
        choices=["linux", "macos", "windows"],
        help="Target platform (default: auto-detect)"
    )
    parser.add_argument(
        "--forge",
        action="store_true",
        help="Use Electron Forge instead of Electron Builder"
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Clean build artifacts"
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run tests only"
    )
    parser.add_argument(
        "--no-tests",
        action="store_true",
        help="Skip running tests during build"
    )
    
    args = parser.parse_args()
    
    # Create builder
    builder = DaveBuilder(platform_name=args.platform)
    
    try:
        if args.clean:
            builder.clean()
        elif args.test:
            builder.run_tests()
        else:
            # Run tests first unless skipped
            if not args.no_tests:
                builder.run_tests()
            
            # Execute full build
            builder.full_build(use_forge=args.forge)
            
    except KeyboardInterrupt:
        print("\nBuild interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nBuild error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()