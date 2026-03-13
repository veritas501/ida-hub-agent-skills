#!/usr/bin/env python3
"""
Build script to compile frontend and copy static files to the Python package.

This script:
1. Runs 'npm run build' in the hub_frontend directory
2. Copies the output to src/ida_chat_hub/static/

Usage:
    python scripts/build_frontend.py [--skip-npm]
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def get_project_root() -> Path:
    """Get the repository root directory."""
    return Path(__file__).resolve().parents[2]


def get_frontend_dir() -> Path:
    """Get the frontend directory."""
    return get_project_root() / "hub_frontend"


def get_static_output_dir() -> Path:
    """Get the static output directory in the Python package."""
    return (
        get_project_root()
        / "hub_backend"
        / "src"
        / "ida_chat_hub"
        / "static"
    )


def run_npm_build(frontend_dir: Path) -> bool:
    """Run npm build in the frontend directory."""
    print(f"Running 'npm run build' in {frontend_dir}...")

    # Check if npm is available
    if shutil.which("npm") is None:
        print("ERROR: npm not found. Please install Node.js first.")
        return False

    # Check if package.json exists
    if not (frontend_dir / "package.json").exists():
        print(f"ERROR: package.json not found in {frontend_dir}")
        return False

    # Run npm install if node_modules doesn't exist
    if not (frontend_dir / "node_modules").exists():
        print("Running 'npm install' first...")
        result = subprocess.run(
            ["npm", "install"],
            cwd=frontend_dir,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"npm install failed: {result.stderr}")
            return False

    # Run npm build
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=frontend_dir,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(f"npm build failed: {result.stderr}")
        return False

    print("npm build completed successfully.")
    return True


def copy_static_files(frontend_dir: Path, output_dir: Path) -> bool:
    """Copy built static files to the Python package."""
    source_dir = frontend_dir / "out"

    if not source_dir.exists():
        print(f"ERROR: Frontend output directory not found: {source_dir}")
        print("Make sure the Next.js build completed successfully.")
        return False

    # Remove existing static directory
    if output_dir.exists():
        print(f"Removing existing directory: {output_dir}")
        shutil.rmtree(output_dir)

    # Copy files
    print(f"Copying {source_dir} -> {output_dir}")
    shutil.copytree(source_dir, output_dir)

    print(f"Static files copied successfully to {output_dir}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build frontend and copy static files to Python package"
    )
    parser.add_argument(
        "--skip-npm",
        action="store_true",
        help="Skip npm build, only copy existing files",
    )
    args = parser.parse_args()

    frontend_dir = get_frontend_dir()
    output_dir = get_static_output_dir()

    print(f"Frontend directory: {frontend_dir}")
    print(f"Output directory: {output_dir}")
    print()

    if not args.skip_npm:
        if not run_npm_build(frontend_dir):
            return 1

    if not copy_static_files(frontend_dir, output_dir):
        return 1

    print("\nBuild completed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
