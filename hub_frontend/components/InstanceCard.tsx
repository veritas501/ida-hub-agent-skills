"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";

import { executeCode } from "@/lib/api";
import type { ExecuteResponse, InstanceInfo } from "@/lib/types";

interface InstanceCardProps {
  instance: InstanceInfo;
}

const DEFAULT_CODE = "print('hello from hub')";

export function InstanceCard({ instance }: InstanceCardProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [showExecute, setShowExecute] = useState(false);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExecuteResponse | null>(null);
  const [errorText, setErrorText] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyToClipboard = useCallback(
    (text: string, field: string) => {
      navigator.clipboard.writeText(text).then(() => {
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        setCopiedField(field);
        copyTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
      });
    },
    [],
  );

  const infoPanelId = useId();
  const executePanelId = useId();
  const displayModule = instance.module || "unknown";
  const connectedAt = useMemo(() => {
    const date = new Date(instance.connected_at);
    return Number.isNaN(date.getTime()) ? instance.connected_at : date.toLocaleString();
  }, [instance.connected_at]);

  async function onExecute() {
    setLoading(true);
    setErrorText("");
    setResult(null);

    try {
      const response = await executeCode({
        instance_id: instance.instance_id,
        code
      });
      setResult(response);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="app-card fade-in p-4 md:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" aria-hidden />
            <span className="app-section-label text-[var(--success)]">Online</span>
          </div>

          <h3 className="truncate text-xl font-semibold tracking-tight text-[var(--text)] md:text-2xl">
            {displayModule}
          </h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Review instance details or execute Python code directly on this target.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowExecute((prev) => !prev)}
              aria-expanded={showExecute}
              aria-controls={executePanelId}
              className="app-btn-primary"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                play_arrow
              </span>
              <span>Execute</span>
            </button>
            <button
              type="button"
              onClick={() => setShowInfo((prev) => !prev)}
              aria-expanded={showInfo}
              aria-controls={infoPanelId}
              className="app-btn-secondary"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                info
              </span>
              <span>Info</span>
            </button>
          </div>
        </div>

        <div className="app-subcard grid w-full gap-4 p-4 sm:grid-cols-2 xl:max-w-[380px] xl:min-w-[360px]">
          <div className="min-w-0">
            <p className="app-section-label">Instance ID</p>
            <code
              className="mt-2 block cursor-pointer truncate rounded-lg bg-white px-3 py-2 text-[12px] font-semibold text-[#516079] transition-colors hover:bg-[var(--panel-muted)]"
              style={{ fontFamily: "var(--font-mono)" }}
              title="Click to copy"
              role="button"
              tabIndex={0}
              onClick={() => copyToClipboard(instance.instance_id, "card")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  copyToClipboard(instance.instance_id, "card");
                }
              }}
            >
              {copiedField === "card" ? "Copied!" : instance.instance_id}
            </code>
          </div>
          <div>
            <p className="app-section-label">Architecture</p>
            <p className="mt-2 text-sm font-medium text-[var(--text)]">{instance.architecture || "unknown"}</p>
          </div>
          <div>
            <p className="app-section-label">Platform</p>
            <p className="mt-2 text-sm font-medium text-[var(--text)]">{instance.platform || "unknown"}</p>
          </div>
          <div>
            <p className="app-section-label">Connected</p>
            <p className="mt-2 text-sm font-medium text-[var(--text)]">{connectedAt}</p>
          </div>
        </div>
      </div>

      {showInfo ? (
        <section id={infoPanelId} className="app-subcard mt-4 p-4" aria-label={`Instance details for ${displayModule}`}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="app-section-label">Module</p>
              <p className="mt-2 text-sm font-medium text-[var(--text)]">{displayModule}</p>
            </div>
            <div>
              <p className="app-section-label">Database Path</p>
              <p className="mt-2 break-all text-sm font-medium text-[var(--text)]">{instance.db_path || "<empty>"}</p>
            </div>
          </div>
        </section>
      ) : null}

      {showExecute ? (
        <section id={executePanelId} className="app-subcard mt-4 space-y-4 p-4" aria-label={`Execute code on ${displayModule}`}>
          <p className="text-sm text-[var(--muted)]">
            Target:&nbsp;
            <span className="font-semibold text-[var(--text)]">{displayModule}</span>
            &nbsp;
            <code
              className="app-inline-code cursor-pointer transition-colors hover:bg-[var(--panel-muted)]"
              style={{ fontFamily: "var(--font-mono)" }}
              title="Click to copy"
              role="button"
              tabIndex={0}
              onClick={() => copyToClipboard(instance.instance_id, "exec")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  copyToClipboard(instance.instance_id, "exec");
                }
              }}
            >
              {copiedField === "exec" ? "Copied!" : instance.instance_id}
            </code>
          </p>

          <div className="app-card p-4">
            <label htmlFor={`${executePanelId}-code`} className="app-section-label block">
              Python Code
            </label>
            <textarea
              id={`${executePanelId}-code`}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              rows={7}
              spellCheck={false}
              className="mt-3 w-full rounded-xl border border-[var(--line-strong)] bg-white p-3 font-mono text-sm text-[var(--text)]"
              style={{ fontFamily: "var(--font-mono)" }}
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={onExecute}
                disabled={loading}
                aria-busy={loading}
                className="app-btn-primary min-w-[112px]"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden>
                  terminal
                </span>
                <span>{loading ? "Running..." : "Run"}</span>
              </button>
            </div>
          </div>

          {errorText ? (
            <div className="rounded-xl border border-rose-200 bg-[var(--danger-soft)] p-4" aria-live="polite">
              <p className="app-section-label text-[var(--danger)]">Request Error</p>
              <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--danger)]">{errorText}</pre>
            </div>
          ) : null}

          {result ? (
            <div className="app-card space-y-4 p-4" aria-live="polite">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="app-section-label">Execution Result</p>
                  <p
                    className={
                      result.success
                        ? "mt-2 text-sm font-semibold text-[var(--success)]"
                        : "mt-2 text-sm font-semibold text-[var(--danger)]"
                    }
                  >
                    {result.success ? "Success" : "Failed"}
                  </p>
                </div>
                <div className="min-w-0 md:max-w-[50%]">
                  <p className="app-section-label">Request ID</p>
                  <code
                    className="mt-2 block truncate rounded-lg bg-[var(--panel-muted)] px-3 py-2 text-[12px] font-semibold text-[#516079]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {result.request_id}
                  </code>
                </div>
              </div>

              {result.output ? (
                <div>
                  <p className="app-section-label">Output</p>
                  <pre className="app-code-block mt-2" style={{ fontFamily: "var(--font-mono)" }}>{result.output}</pre>
                </div>
              ) : null}

              {result.error ? (
                <div>
                  <p className="app-section-label text-[var(--danger)]">Error</p>
                  <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-rose-200 bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]" style={{ fontFamily: "var(--font-mono)" }}>
                    {result.error}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
