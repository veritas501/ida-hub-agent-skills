#!/usr/bin/env python3
"""同步 monorepo 中所有模块的版本号。

目标文件:
  - package.json              (根)
  - apps/api/package.json
  - apps/web/package.json
  - packages/shared/package.json
  - ida_plugins/ida_multi_chat/__init__.py
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# ── 目标文件 ──────────────────────────────────────────────
PACKAGE_JSONS = (
    ROOT / "package.json",
    ROOT / "apps" / "api" / "package.json",
    ROOT / "apps" / "web" / "package.json",
    ROOT / "packages" / "shared" / "package.json",
)
PLUGIN_INIT = ROOT / "ida_plugins" / "ida_multi_chat" / "__init__.py"
TARGET_FILES: tuple[Path, ...] = (*PACKAGE_JSONS, PLUGIN_INIT)

# ── 正则 ──────────────────────────────────────────────────
SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\."
    r"(0|[1-9]\d*)\."
    r"(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
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
            f"无效版本号 '{version}'，需要 semver 格式，例如 0.6.0"
        )
    return version


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def ensure_files_exist(paths: tuple[Path, ...]) -> None:
    missing = [rel(p) for p in paths if not p.is_file()]
    if missing:
        raise FileNotFoundError(f"缺少目标文件: {', '.join(missing)}")


def replace_single_match(
    text: str,
    pattern: re.Pattern[str],
    new_version: str,
    description: str,
) -> tuple[str, str]:
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise ValueError(f"{description}: 期望匹配 1 次，实际 {len(matches)} 次")
    old_version = matches[0].group("version")
    new_text = pattern.sub(
        lambda m: f"{m.group('prefix')}{new_version}{m.group('suffix')}",
        text,
        count=1,
    )
    return new_text, old_version


def update_package_json(path: Path, new_version: str) -> tuple[str, str] | None:
    """更新 package.json 的 version 字段，若无 version 字段则返回 None（跳过）。"""
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{rel(path)}: 不是 JSON 对象")
    current = data.get("version")
    if not isinstance(current, str):
        return None  # private monorepo 根等无 version 字段的包，跳过
    data["version"] = new_version
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n", current


def build_changes(new_version: str) -> list[FileChange]:
    changes: list[FileChange] = []

    # package.json 文件
    for pkg in PACKAGE_JSONS:
        result = update_package_json(pkg, new_version)
        if result is None:
            continue
        content, old = result
        if old != new_version:
            changes.append(FileChange(pkg, "version", old, new_version, content))

    # 插件 __version__
    text = PLUGIN_INIT.read_text(encoding="utf-8")
    content, old = replace_single_match(
        text, INIT_VERSION_PATTERN, new_version, f"{rel(PLUGIN_INIT)} __version__"
    )
    if old != new_version:
        changes.append(FileChange(PLUGIN_INIT, "__version__", old, new_version, content))

    return changes


def print_changes(changes: list[FileChange], dry_run: bool) -> None:
    prefix = "[dry-run] " if dry_run else ""
    print(f"{prefix}版本更新计划:")
    for c in changes:
        print(f"  {rel(c.path)} ({c.label}): {c.before} -> {c.after}")


def apply_changes(changes: list[FileChange]) -> None:
    for c in changes:
        c.path.write_text(c.content, encoding="utf-8")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="同步 monorepo 中所有模块的版本号"
    )
    parser.add_argument("version", help="目标版本号，例如 0.6.0")
    parser.add_argument(
        "--dry-run", action="store_true", help="仅显示计划，不写入文件"
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    try:
        new_version = validate_version(args.version)
        ensure_files_exist(TARGET_FILES)
        changes = build_changes(new_version)
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as exc:
        print(f"错误: {exc}", file=sys.stderr)
        return 1

    if not changes:
        print(f"所有文件已是版本 {new_version}，无需更新。")
        return 0

    print_changes(changes, dry_run=args.dry_run)
    if args.dry_run:
        return 0

    apply_changes(changes)
    print(f"已更新 {len(changes)} 个文件至版本 {new_version}。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
