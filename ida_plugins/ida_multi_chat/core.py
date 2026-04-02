"""Core execution utilities for running Hub-delivered scripts in IDA."""

from __future__ import annotations

import io
import traceback
from contextlib import redirect_stdout
from dataclasses import dataclass
from typing import Any, Callable

import ida_kernwin  # type: ignore
import idaapi  # type: ignore
import idautils  # type: ignore
import idc  # type: ignore
from ida_domain import Database  # type: ignore

# Maximum characters kept in stdout/error output before truncation.
OUTPUT_BUDGET_CHARS: int = 200_000

# Smaller budget for traceback strings (rarely exceeds this).
_ERROR_BUDGET_CHARS: int = 50_000

# Marker appended when truncation occurs.
_TRUNCATION_MARKER = "\n\n[OUTPUT TRUNCATED -- {kept} of {total} chars shown. Refine your script to reduce output.]\n"


class _CappedStringIO(io.TextIOBase):
    """A write-only text stream that silently discards data beyond *cap* chars.

    This avoids unbounded memory growth when user scripts produce massive
    stdout output, cutting the problem at the source instead of after the fact.
    """

    __slots__ = ("_parts", "_len", "_cap", "_overflowed")

    def __init__(self, cap: int = OUTPUT_BUDGET_CHARS) -> None:
        self._parts: list[str] = []
        self._len: int = 0
        self._cap: int = cap
        self._overflowed: bool = False

    # -- TextIOBase interface --------------------------------------------------

    def writable(self) -> bool:  # noqa: D102
        return True

    def write(self, s: str) -> int:  # noqa: D102
        if self._len >= self._cap:
            self._overflowed = True
            return len(s)
        remaining = self._cap - self._len
        if len(s) > remaining:
            s = s[:remaining]
            self._overflowed = True
        self._parts.append(s)
        self._len += len(s)
        return len(s)

    # -- Public helpers --------------------------------------------------------

    def getvalue(self) -> str:
        """Return accumulated output (at most *cap* chars)."""
        return "".join(self._parts)

    @property
    def overflowed(self) -> bool:
        """Whether any data was discarded due to the cap."""
        return self._overflowed


@dataclass
class ExecutionResult:
    """Execution outcome returned to Hub."""

    success: bool
    output: str = ""
    error: str | None = None


ScriptExecutor = Callable[[str], ExecutionResult]


def _apply_output_budget(raw: str, budget: int = OUTPUT_BUDGET_CHARS) -> str:
    """Truncate *raw* to at most *budget* characters (plus a short marker).

    The returned string may slightly exceed *budget* by the length of the
    appended truncation marker (~100 chars).  This is intentional so that the
    caller always receives exactly *budget* chars of real content.
    """

    if len(raw) <= budget:
        return raw
    return raw[:budget] + _TRUNCATION_MARKER.format(kept=budget, total=len(raw))


def create_ida_domain_db() -> Any:
    """Create a best-effort ida-domain Database object.

    Different ida-domain versions may expose different constructors.
    """

    constructors: list[Callable[[], Any]] = []
    if callable(Database):
        constructors.append(Database)

    for method_name in ("current", "open"):
        method = getattr(Database, method_name, None)
        if callable(method):
            constructors.append(method)

    for constructor in constructors:
        try:
            return constructor()
        except Exception:
            continue
    return None


def build_execution_context() -> dict[str, Any]:
    """Build the globals/locals context used by user script execution."""

    return {
        "__builtins__": __builtins__,
        "db": create_ida_domain_db(),
        "idaapi": idaapi,
        "idautils": idautils,
        "idc": idc,
        "ida_kernwin": ida_kernwin,
    }


class IDAScriptExecutor:
    """Execute Python code safely in IDA main thread."""

    def execute(self, code: str) -> ExecutionResult:
        """Schedule script execution via ``ida_kernwin.execute_sync``."""

        holder: dict[str, ExecutionResult] = {}

        def run_script() -> int:
            holder["result"] = self._run_in_main_thread(code)
            return 1 if holder["result"].success else 0

        execute_sync = getattr(ida_kernwin, "execute_sync", None)
        if not callable(execute_sync):
            return ExecutionResult(
                success=False,
                error="The current IDA environment does not support execute_sync.",
            )

        try:
            execute_sync(run_script, getattr(ida_kernwin, "MFF_FAST", 0))
        except Exception:
            return ExecutionResult(success=False, error=traceback.format_exc())

        return holder.get(
            "result",
            ExecutionResult(
                success=False, error="The script executor did not return a result."
            ),
        )

    def _run_in_main_thread(self, code: str) -> ExecutionResult:
        """Run compiled code and capture stdout/traceback."""

        buffer = _CappedStringIO()
        context = build_execution_context()

        try:
            # 在主线程捕获 print 输出，便于回传给 Hub.
            with redirect_stdout(buffer):
                exec(compile(code, "<ida_hub>", "exec"), context, context)
        except Exception:
            output = self._finalize_output(buffer)
            error = _apply_output_budget(
                traceback.format_exc(), budget=_ERROR_BUDGET_CHARS
            )
            return ExecutionResult(success=False, output=output, error=error)

        return ExecutionResult(success=True, output=self._finalize_output(buffer))

    @staticmethod
    def _finalize_output(buffer: _CappedStringIO) -> str:
        """Extract output from *buffer*, appending a truncation notice if it overflowed."""

        output = buffer.getvalue()
        if buffer.overflowed:
            output += _TRUNCATION_MARKER.format(
                kept=len(output), total=f"{buffer._cap}+"
            )
        return output
