"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import ReactMarkdown from "react-markdown";

import { Header } from "@/components/Header";
import { fetchConfig, fetchNetworkInterfaces } from "@/lib/api";
import type { ConfigResponse } from "@/lib/types";

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

export default function ConfigPage() {
  const {
    data: interfacesData,
    error: interfacesError,
    isLoading: interfacesLoading,
    mutate: mutateInterfaces,
    isValidating: interfacesValidating
  } = useSWR("network/interfaces", fetchNetworkInterfaces);

  const [selectedIp, setSelectedIp] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!selectedIp && interfacesData?.default_ip) {
      setSelectedIp(interfacesData.default_ip);
    }
  }, [interfacesData, selectedIp]);

  const {
    data: configData,
    error: configError,
    isLoading: configLoading,
    mutate: mutateConfig,
    isValidating: configValidating
  } = useSWR<ConfigResponse>(selectedIp ? `config/${selectedIp}` : null, () => fetchConfig(selectedIp));

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const markdownText = useMemo(() => {
    if (!configData) {
      return "";
    }
    if (configData.result) {
      return configData.result;
    }
    return [
      "# List instances",
      configData.curl_examples?.instances ?? "",
      "",
      "# Execute code",
      configData.curl_examples?.execute ?? "",
      "",
      "# Python helper",
      configData.python_helper ?? ""
    ].join("\n");
  }, [configData]);

  function showToast(type: "success" | "error", message: string): void {
    setToast({ type, message });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2000);
  }

  function onRefresh(): void {
    void mutateInterfaces();
    if (selectedIp) {
      void mutateConfig();
    }
  }

  async function onCopyAll(): Promise<void> {
    if (!markdownText) {
      return;
    }
    try {
      await copyText(markdownText);
      showToast("success", "复制成功");
    } catch {
      showToast("error", "复制失败，请手动复制");
    }
  }

  const isRefreshing = interfacesValidating || configValidating;

  return (
    <main className="min-h-screen bg-[#f6f6f8]">
      <Header title="Claude Code Configuration" onRefresh={onRefresh} refreshing={isRefreshing} />
      {toast ? (
        <div className="pointer-events-none fixed right-4 top-20 z-50">
          <div
            className={
              toast.type === "success"
                ? "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
                : "rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
            }
          >
            {toast.message}
          </div>
        </div>
      ) : null}
      <section className="mx-auto w-full max-w-6xl space-y-4 px-4 py-7 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[#6e7890]">先选择 IPv4 网卡地址，再生成对应 Hub 配置命令。</p>
            <Link href="/" className="mt-1 inline-block text-sm font-semibold text-[#2b6cee] hover:underline">
              ← Back to Dashboard
            </Link>
          </div>
          <button
            type="button"
            disabled={!markdownText}
            onClick={() => void onCopyAll()}
            className="rounded-lg bg-[#2b6cee] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Copy All
          </button>
        </div>

        <section className="rounded-2xl border border-[#e4e8ef] bg-white p-4">
          <label htmlFor="ip-select" className="mb-2 block text-sm font-semibold text-[#283248]">
            IPv4 网卡
          </label>
          <select
            id="ip-select"
            value={selectedIp}
            onChange={(event) => setSelectedIp(event.target.value)}
            disabled={interfacesLoading || !interfacesData?.interfaces.length}
            className="w-full rounded-lg border border-[#d7dfea] bg-white px-3 py-2 text-sm text-[#1e283a] outline-none focus:border-[#2b6cee]"
          >
            {interfacesData?.interfaces.map((item) => (
              <option key={`${item.name}-${item.ipv4}`} value={item.ipv4}>
                {item.ipv4} ({item.name}{item.is_loopback ? ", loopback" : ""})
              </option>
            ))}
          </select>
        </section>

        {interfacesLoading ? (
          <div className="rounded-2xl border border-[#e4e8ef] bg-white p-6 text-sm text-[#69758a]">
            正在加载网卡列表...
          </div>
        ) : null}

        {interfacesError ? (
          <pre className="overflow-x-auto rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {String(interfacesError)}
          </pre>
        ) : null}

        {configLoading ? (
          <div className="rounded-2xl border border-[#e4e8ef] bg-white p-6 text-sm text-[#69758a]">
            正在加载配置...
          </div>
        ) : null}

        {configError ? (
          <pre className="overflow-x-auto rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {String(configError)}
          </pre>
        ) : null}

        {markdownText ? (
          <section className="rounded-2xl border border-[#e4e8ef] bg-white p-5">
            <div className="markdown-body space-y-3 text-[14px] leading-6 text-[#1f2a3d]">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h3 className="text-[16px] font-semibold text-[#283248]">{children}</h3>,
                  h2: ({ children }) => <h4 className="text-[15px] font-semibold text-[#283248]">{children}</h4>,
                  p: ({ children }) => <p className="text-[14px] text-[#1f2a3d]">{children}</p>,
                  code: ({ children, className }) => {
                    const isInline = !className;
                    if (isInline) {
                      return <code className="rounded bg-[#eef2f8] px-1 py-0.5 text-[13px] text-[#1e315c]">{children}</code>;
                    }
                    return <code className="text-[13px] leading-6 text-slate-100">{children}</code>;
                  },
                  pre: ({ children }) => (
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-[#111827] p-3 text-[13px] leading-6 text-slate-100">
                      {children}
                    </pre>
                  ),
                  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
                  li: ({ children }) => <li className="text-[14px] text-[#1f2a3d]">{children}</li>
                }}
              >
                {markdownText}
              </ReactMarkdown>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
