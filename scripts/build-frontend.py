#!/usr/bin/env python3
"""
Frontend build script for DAVE
Handles Vite bundling with fallback to legacy mode
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def check_node_installed():
    """Check if Node.js is installed"""
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            version = result.stdout.strip()
            print(f"✓ Node.js {version} found")
            return True
    except FileNotFoundError:
        pass
    return False

def install_npm_dependencies():
    """Install npm dependencies"""
    print("Installing npm dependencies...")
    try:
        subprocess.run(['npm', 'install'], check=True)
        print("✓ Dependencies installed")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install dependencies: {e}")
        return False

def build_with_vite():
    """Build frontend assets with Vite"""
    print("\nBuilding frontend with Vite...")
    try:
        # Clean previous build
        dist_path = Path("src/main/resources/static/dist")
        if dist_path.exists():
            shutil.rmtree(dist_path)
            print("✓ Cleaned previous build")
        
        # Run Vite build
        env = os.environ.copy()
        env['NODE_ENV'] = 'production'
        subprocess.run(['npm', 'run', 'build'], check=True, env=env)
        print("✓ Frontend built successfully")
        
        # Check output
        if dist_path.exists():
            files = list(dist_path.rglob("*"))
            print(f"✓ Generated {len(files)} files")
            return True
        else:
            print("✗ Build directory not created")
            return False
            
    except subprocess.CalledProcessError as e:
        print(f"✗ Build failed: {e}")
        return False

def create_fallback_symlinks():
    """Create symlinks for fallback to unbundled assets"""
    print("\nCreating fallback symlinks...")
    
    static_dir = Path("src/main/resources/static")
    dist_dir = static_dir / "dist"
    
    # Create dist directory if it doesn't exist
    dist_dir.mkdir(exist_ok=True)
    
    # Create symlinks for fallback
    symlinks = [
        ("scripts", "js"),
        ("styles", "css"),
        ("img", "img"),
        ("fonts", "fonts")
    ]
    
    for src, dst in symlinks:
        src_path = static_dir / src
        dst_path = dist_dir / dst
        
        if src_path.exists() and not dst_path.exists():
            try:
                dst_path.symlink_to(f"../{src}")
                print(f"✓ Created symlink: {dst} -> ../{src}")
            except OSError as e:
                # Fall back to copying on Windows
                if dst_path.exists():
                    shutil.rmtree(dst_path)
                shutil.copytree(src_path, dst_path)
                print(f"✓ Copied {src} to {dst}")

def main():
    """Main build process"""
    print("DAVE Frontend Build Script")
    print("=" * 50)
    
    # Check if we should use Vite or legacy mode
    use_vite = '--legacy' not in sys.argv
    
    if use_vite and check_node_installed():
        # Try modern Vite build
        if Path("package.json").exists():
            if install_npm_dependencies():
                if build_with_vite():
                    print("\n✅ Frontend build completed successfully!")
                    return 0
                else:
                    print("\n⚠️  Vite build failed, falling back to legacy mode")
        else:
            print("⚠️  package.json not found, using legacy mode")
    
    # Legacy mode: create symlinks to unbundled assets
    print("\nUsing legacy unbundled mode...")
    create_fallback_symlinks()
    print("\n✅ Legacy mode setup completed!")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())