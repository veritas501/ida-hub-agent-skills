export type CopyMethod = "clipboard" | "execCommand" | "none";
export type CopyFailureReason = "not_secure_context" | "permission_denied" | "unsupported" | "unknown";
export type CopyErrorMessageKey = "common.copyFailed" | "common.copyFailedNotSecureContext" | "common.copyFailedPermissionDenied" | "common.copyFailedUnsupported";
export type CopyTextResult = { ok: true; method: Exclude<CopyMethod, "none"> } | { ok: false; method: CopyMethod; reason: CopyFailureReason };

function classifyClipboardError(error: unknown): CopyFailureReason {
  if (!window.isSecureContext) return "not_secure_context";
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "permission_denied";
    if (error.name === "SecurityError") return "not_secure_context";
    if (error.name === "NotSupportedError") return "unsupported";
  }
  return "unknown";
}

function fallbackCopyWithExecCommand(text: string): CopyTextResult {
  if (typeof document.execCommand !== "function") return { ok: false, method: "none", reason: "unsupported" };
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  try {
    const copied = document.execCommand("copy");
    if (copied) return { ok: true, method: "execCommand" };
    return { ok: false, method: "execCommand", reason: !window.isSecureContext ? "not_secure_context" : "unknown" };
  } catch {
    return { ok: false, method: "execCommand", reason: !window.isSecureContext ? "not_secure_context" : "unknown" };
  } finally {
    document.body.removeChild(textarea);
    if (selection) { selection.removeAllRanges(); if (previousRange) selection.addRange(previousRange); }
    activeElement?.focus();
  }
}

export function getCopyErrorMessageKey(result: Extract<CopyTextResult, { ok: false }>): CopyErrorMessageKey {
  switch (result.reason) {
    case "not_secure_context": return "common.copyFailedNotSecureContext";
    case "permission_denied": return "common.copyFailedPermissionDenied";
    case "unsupported": return "common.copyFailedUnsupported";
    default: return "common.copyFailed";
  }
}

export async function copyText(text: string): Promise<CopyTextResult> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: "clipboard" };
    } catch (error) {
      const fallbackResult = fallbackCopyWithExecCommand(text);
      if (fallbackResult.ok) return fallbackResult;
      return { ok: false, method: fallbackResult.method, reason: fallbackResult.reason === "unknown" ? classifyClipboardError(error) : fallbackResult.reason };
    }
  }
  return fallbackCopyWithExecCommand(text);
}
