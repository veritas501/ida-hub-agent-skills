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


@dataclass
class ExecutionResult:
    """Execution outcome returned to Hub."""

    success: bool
    output: str = ""
    error: str | None = None


ScriptExecutor = Callable[[str], ExecutionResult]


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

        buffer = io.StringIO()
        context = build_execution_context()

        try:
            # 在主线程捕获 print 输出，便于回传给 Hub.
            with redirect_stdout(buffer):
                exec(compile(code, "<ida_hub>", "exec"), context, context)
        except Exception:
            output = buffer.getvalue()
            error = traceback.format_exc()
            return ExecutionResult(success=False, output=output, error=error)

        return ExecutionResult(success=True, output=buffer.getvalue())
