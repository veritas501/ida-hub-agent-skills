#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_PYPROJECT = ROOT / "hub_backend" / "pyproject.toml"
BACKEND_INIT = ROOT / "hub_backend" / "src" / "ida_chat_hub" / "__init__.py"
PLUGIN_INIT = ROOT / "ida_plugins" / "ida_multi_chat" / "__init__.py"
FRONTEND_PACKAGE = ROOT / "hub_frontend" / "package.json"
FRONTEND_PACKAGE_LOCK = ROOT / "hub_frontend" / "package-lock.json"
TARGET_FILES = (
    BACKEND_PYPROJECT,
    BACKEND_INIT,
    PLUGIN_INIT,
    FRONTEND_PACKAGE,
    FRONTEND_PACKAGE_LOCK,
)

SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\."
    r"(0|[1-9]\d*)\."
    r"(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)
PYPROJECT_VERSION_PATTERN = re.compile(
    r'(?ms)(?P<prefix>^\[project\]\s*$.*?^version\s*=\s*")(?P<version>[^"]+)(?P<suffix>")'
)
INIT_VERSION_PATTERN = re.compile(
    r'(?m)(?P<prefix>^__version__\s*=\s*")(?P<version>[^"]+)(?P<suffix>"\s*$)'
)


@dataclass(frozen=True)
class FileChange:
    path: Path
    label: str
    before: str
    after: str
    content: str


def validate_version(version: str) -> str:
    if not SEMVER_PATTERN.fullmatch(version):
        raise ValueError(
            f"Invalid version '{version}'. Expected semver-like value such as 0.2.0."
        )
    return version


def relative_path(path: Path) -> str:
    return str(path.relative_to(ROOT))


def ensure_files_exist(paths: tuple[Path, ...]) -> None:
    missing = [relative_path(path) for path in paths if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"Missing target files: {', '.join(missing)}")


def replace_single_match(
    text: str,
    pattern: re.Pattern[str],
    new_version: str,
    description: str,
) -> tuple[str, str]:
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise ValueError(
            f"{description}: expected exactly 1 match, found {len(matches)}"
        )

    old_version = matches[0].group("version")
    new_text = pattern.sub(
        lambda match: f"{match.group('prefix')}{new_version}{match.group('suffix')}",
        text,
        count=1,
    )
    return new_text, old_version


def update_package_json(path: Path, new_version: str) -> tuple[str, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{relative_path(path)}: expected a JSON object")

    current_version = data.get("version")
    if not isinstance(current_version, str):
        raise ValueError(f"{relative_path(path)}: missing string field 'version'")

    data["version"] = new_version
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n", current_version


def update_package_lock(path: Path, new_version: str) -> tuple[str, str, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{relative_path(path)}: expected a JSON object")

    top_level_version = data.get("version")
    if not isinstance(top_level_version, str):
        raise ValueError(f"{relative_path(path)}: missing string field 'version'")

    packages = data.get("packages")
    if not isinstance(packages, dict):
        raise ValueError(f"{relative_path(path)}: missing object field 'packages'")

    root_package = packages.get("")
    if not isinstance(root_package, dict):
        raise ValueError(
            f"{relative_path(path)}: missing object field \"packages['']\""
        )

    root_version = root_package.get("version")
    if not isinstance(root_version, str):
        raise ValueError(
            f"{relative_path(path)}: missing string field \"packages[''].version\""
        )

    data["version"] = new_version
    root_package["version"] = new_version

    before = f'top-level={top_level_version}, packages[""]={root_version}'
    after = f'top-level={new_version}, packages[""]={new_version}'
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n", before, after


def build_changes(new_version: str) -> list[FileChange]:
    changes: list[FileChange] = []

    pyproject_text = BACKEND_PYPROJECT.read_text(encoding="utf-8")
    updated_pyproject, old_pyproject = replace_single_match(
        pyproject_text,
        PYPROJECT_VERSION_PATTERN,
        new_version,
        f"{relative_path(BACKEND_PYPROJECT)} [project].version",
    )
    if old_pyproject != new_version:
        changes.append(
            FileChange(
                path=BACKEND_PYPROJECT,
                label="[project].version",
                before=old_pyproject,
                after=new_version,
                content=updated_pyproject,
            )
        )

    init_text = BACKEND_INIT.read_text(encoding="utf-8")
    updated_init, old_init = replace_single_match(
        init_text,
        INIT_VERSION_PATTERN,
        new_version,
        f"{relative_path(BACKEND_INIT)} __version__",
    )
    if old_init != new_version:
        changes.append(
            FileChange(
                path=BACKEND_INIT,
                label="__version__",
                before=old_init,
                after=new_version,
                content=updated_init,
            )
        )

    plugin_init_text = PLUGIN_INIT.read_text(encoding="utf-8")
    updated_plugin_init, old_plugin_version = replace_single_match(
        plugin_init_text,
        INIT_VERSION_PATTERN,
        new_version,
        f"{relative_path(PLUGIN_INIT)} __version__",
    )
    if old_plugin_version != new_version:
        changes.append(
            FileChange(
                path=PLUGIN_INIT,
                label="__version__",
                before=old_plugin_version,
                after=new_version,
                content=updated_plugin_init,
            )
        )

    updated_package_json, old_package_json = update_package_json(
        FRONTEND_PACKAGE, new_version
    )
    if old_package_json != new_version:
        changes.append(
            FileChange(
                path=FRONTEND_PACKAGE,
                label="version",
                before=old_package_json,
                after=new_version,
                content=updated_package_json,
            )
        )

    (
        updated_package_lock,
        before_package_lock,
        after_package_lock,
    ) = update_package_lock(FRONTEND_PACKAGE_LOCK, new_version)
    if before_package_lock != after_package_lock:
        changes.append(
            FileChange(
                path=FRONTEND_PACKAGE_LOCK,
                label='version + packages[""].version',
                before=before_package_lock,
                after=after_package_lock,
                content=updated_package_lock,
            )
        )

    return changes


def print_changes(changes: list[FileChange], dry_run: bool) -> None:
    prefix = "[dry-run] " if dry_run else ""
    print(f"{prefix}Version update plan:")
    for change in changes:
        print(
            f"- {relative_path(change.path)} ({change.label}): "
            f"{change.before} -> {change.after}"
        )


def apply_changes(changes: list[FileChange]) -> None:
    for change in changes:
        change.path.write_text(change.content, encoding="utf-8")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Synchronize version metadata across backend and frontend files."
    )
    parser.add_argument("version", help="Target version, for example 0.2.0")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show planned updates without writing files",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)

    try:
        new_version = validate_version(args.version)
        ensure_files_exist(TARGET_FILES)
        changes = build_changes(new_version)
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if not changes:
        print(f"All target files are already at version {new_version}. Nothing to do.")
        return 0

    print_changes(changes, dry_run=args.dry_run)
    if args.dry_run:
        return 0

    apply_changes(changes)
    print(f"Updated {len(changes)} file(s) to version {new_version}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
