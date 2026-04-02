#!/usr/bin/env python3
"""CLI tool to execute IDA scripts remotely via IDA Hub.

Zero external dependencies — uses only the Python standard library.

Usage:
    python run_script.py -u http://host:10086 -k TOKEN instance_id script.py
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
import urllib.error
import urllib.request

# Output length threshold (chars); beyond this, write to temp file
OUTPUT_THRESHOLD = 4000


def execute_script(hub_url: str, token: str, instance_id: str, code: str) -> dict:
    """Send an execute request to the Hub and return the response JSON."""
    url = f"{hub_url.rstrip('/')}/api/execute"
    payload = json.dumps({"instance_id": instance_id, "code": code}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code}: {body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Connection failed: {e.reason}", file=sys.stderr)
        sys.exit(1)


def handle_output(output: str) -> None:
    """Print to stdout if short enough; otherwise write to a temp file and print its path."""
    if len(output) <= OUTPUT_THRESHOLD:
        print(output)
    else:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False, encoding="utf-8"
        ) as f:
            f.write(output)
            print(f.name)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Execute IDA scripts remotely via IDA Hub",
    )
    parser.add_argument("-u", "--url", required=True, help="Hub URL (e.g., http://127.0.0.1:10086)")
    parser.add_argument("-k", "--token", required=True, help="Bearer token")
    parser.add_argument("instance_id", help="Target IDA instance ID")
    parser.add_argument("script_file", help="Python script file to execute")
    args = parser.parse_args()

    try:
        with open(args.script_file, "r", encoding="utf-8") as f:
            code = f.read()
    except FileNotFoundError:
        print(f"File not found: {args.script_file}", file=sys.stderr)
        sys.exit(1)
    except OSError as e:
        print(f"Failed to read file: {e}", file=sys.stderr)
        sys.exit(1)

    if not code.strip():
        print("Script file is empty", file=sys.stderr)
        sys.exit(1)

    result = execute_script(args.url, args.token, args.instance_id, code)

    error = result.get("error")
    output = result.get("output")

    if error:
        print(error, file=sys.stderr)
        sys.exit(1)

    if output:
        handle_output(output)


if __name__ == "__main__":
    main()
