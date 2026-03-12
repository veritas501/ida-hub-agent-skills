"use client";

import { useMemo, useState } from "react";

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
    <article className="fade-in rounded-2xl border border-[#e4e8ef] bg-white p-4 shadow-[0_1px_0_rgba(9,16,28,0.04)] md:p-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-600">
              Online
            </span>
          </div>
          <h3 className="truncate text-lg leading-tight font-semibold text-[#263043] md:text-[32px]">{displayModule}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowExecute((prev) => !prev)}
              className="flex h-9 items-center gap-2 rounded-lg bg-[#2b6cee] px-5 text-[13px] font-semibold text-white hover:opacity-90"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                play_arrow
              </span>
              <span>Execute</span>
            </button>
            <button
              type="button"
              onClick={() => setShowInfo((prev) => !prev)}
              className="flex h-9 items-center gap-2 rounded-lg bg-[#eef1f6] px-5 text-[13px] font-semibold text-[#3d495f] hover:bg-[#e4e9f1]"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                info
              </span>
              <span>Info</span>
            </button>
          </div>
        </div>

        <div className="grid w-full max-w-[340px] grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#9aa3b3]">ID</p>
            <code
              className="mt-1 block max-w-[180px] truncate rounded bg-[#eef1f6] px-2 py-0.5 text-[12px] font-semibold text-[#59647b]"
              title={instance.instance_id}
            >
              {instance.instance_id}
            </code>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#9aa3b3]">Architecture</p>
            <p className="mt-1 text-[13px] font-medium text-[#4a556d]">{instance.architecture || "unknown"}</p>
          </div>
        </div>
      </div>

      {showInfo ? (
        <div className="mt-4 space-y-1 rounded-xl border border-[#e4e8ef] bg-[#f8f9fc] p-3 text-[13px] text-[#4a556d]">
          <p className="break-all">
            <span className="font-semibold text-[#2e394d]">DB Path:</span> {instance.db_path || "<empty>"}
          </p>
          <p>
            <span className="font-semibold text-[#2e394d]">Connected At:</span> {connectedAt}
          </p>
          <p>
            <span className="font-semibold text-[#2e394d]">Platform:</span> {instance.platform || "unknown"}
          </p>
        </div>
      ) : null}

      {showExecute ? (
        <div className="mt-4 space-y-3 rounded-xl border border-[#e4e8ef] bg-[#f8f9fc] p-3">
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            rows={5}
            className="w-full rounded-lg border border-[#d5dce8] bg-white p-3 font-mono text-sm outline-none ring-[#2b6cee] focus:ring"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExecute}
              disabled={loading}
              className="rounded-lg bg-[#2b6cee] px-4 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Running..." : "Run"}
            </button>
          </div>
          {errorText ? (
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
              {errorText}
            </pre>
          ) : null}
          {result ? (
            <div className="space-y-2">
              <p
                className={
                  result.success
                    ? "text-sm font-semibold text-emerald-700"
                    : "text-sm font-semibold text-rose-700"
                }
              >
                {result.success ? "执行成功" : "执行失败"}
              </p>
              {result.output ? (
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-2 text-xs text-slate-100">
                  {result.output}
                </pre>
              ) : null}
              {result.error ? (
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
                  {result.error}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
