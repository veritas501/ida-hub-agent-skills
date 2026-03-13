"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";

import { Header } from "@/components/Header";
import { fetchConfig, fetchNetworkInterfaces } from "@/lib/api";
import type { ConfigResponse, NetworkInterfacesResponse } from "@/lib/types";

const ConfigMarkdown = dynamic(() => import("@/components/ConfigMarkdown"), {
  ssr: false,
  loading: () => <div className="animate-pulse h-40 bg-[var(--line-strong)]/20 rounded-xl"></div>
});

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

const TOAST_DURATION_MS = 2000;

export default function ConfigPage() {
  const {
    data: interfacesData,
    error: interfacesError,
    isLoading: interfacesLoading,
    mutate: mutateInterfaces,
    isValidating: interfacesValidating,
  } = useSWR<NetworkInterfacesResponse>(
    "network/interfaces",
    fetchNetworkInterfaces,
  );

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
    isValidating: configValidating,
  } = useSWR<ConfigResponse>(selectedIp ? `config/${selectedIp}` : null, () =>
    fetchConfig(selectedIp),
  );

  const [isCopiedAll, setIsCopiedAll] = useState(false);

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
      configData.python_helper ?? "",
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
    }, TOAST_DURATION_MS);
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
      setIsCopiedAll(true);
      setTimeout(() => setIsCopiedAll(false), TOAST_DURATION_MS);
    } catch {
      showToast("error", "复制失败，请手动复制");
    }
  }

  const isRefreshing = interfacesValidating || configValidating;
  const interfacesCount = interfacesData?.interfaces.length ?? 0;

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <Header
        title="Agent Configuration"
        onRefresh={onRefresh}
        refreshing={isRefreshing}
      />

      {toast ? (
        <div className="pointer-events-none fixed bottom-8 left-1/2 z-50 max-w-xs animate-toast">
          <div
            role={toast.type === "error" ? "alert" : "status"}
            aria-live={toast.type === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            className={
              toast.type === "success"
                ? "rounded-xl border border-emerald-200 bg-[var(--success-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)] shadow-sm"
                : "rounded-xl border border-rose-200 bg-[var(--danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--danger)] shadow-sm"
            }
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                {toast.type === "success" ? "check_circle" : "error"}
              </span>
              {toast.message}
            </div>
          </div>
        </div>
      ) : null}

      <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:px-6 animate-slide-up">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="app-section-label">Configuration</p>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)] md:text-[30px]">
              生成 Agent 配置
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              选择可用 IPv4 网卡，查看生成结果并复制，直接用于 Agent
              或相关脚本。
            </p>
          </div>

          <div className="app-subcard flex flex-wrap items-start gap-4 px-4 py-3 lg:justify-end">
            <div>
              <p className="app-section-label">Interfaces</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                {interfacesCount}
              </p>
            </div>
            <div
              className="hidden h-10 w-px bg-[var(--line)] sm:block"
              aria-hidden
            />
            <div>
              <p className="app-section-label">Selected IP</p>
              <p className="mt-1 text-sm font-medium text-[var(--text)]">
                {selectedIp || "Waiting..."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="app-card p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text)]">
                    1. 选择 IPv4 网卡
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    选择一个可被其他设备或本机插件访问的 IPv4
                    地址。默认会优先使用后端推荐的地址。
                  </p>
                </div>
                <div className="text-sm font-medium text-[var(--muted)] bg-[var(--panel-muted)] px-3 py-1.5 rounded-lg border border-[var(--line)]">
                  Hub 端口: <span className="text-[var(--text)]">10086</span>
                </div>
              </div>

              {interfacesError ? (
                <div className="app-state-panel app-state-panel-error mt-5">
                  <p className="app-section-label text-[var(--danger)]">
                    Request Error
                  </p>
                  <p className="mt-2 text-sm font-semibold">网卡列表请求失败</p>
                  <pre
                    className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-sm"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {String(interfacesError)}
                  </pre>
                </div>
              ) : interfacesLoading ? (
                <div className="app-state-panel mt-5">
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    正在加载网卡列表...
                  </p>
                </div>
              ) : (
                <div className="mt-5">
                  <label
                    htmlFor="ip-select"
                    className="app-section-label block"
                  >
                    Available Interfaces
                  </label>
                  <div className="relative mt-2">
                    <select
                      id="ip-select"
                      value={selectedIp}
                      onChange={(event) => setSelectedIp(event.target.value)}
                      disabled={!interfacesData?.interfaces.length}
                      className="w-full appearance-none rounded-xl border border-[var(--line-strong)] bg-white px-4 py-3 pr-10 text-sm font-medium text-[var(--text)] shadow-sm transition-all duration-200 ease-out focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:bg-gray-50 disabled:text-gray-400 hover:border-gray-300 cursor-pointer"
                    >
                      {interfacesData?.interfaces.map((item) => (
                        <option
                          key={`${item.name}-${item.ipv4}`}
                          value={item.ipv4}
                        >
                          {item.ipv4} • {item.name}
                          {item.is_loopback ? " (Loopback)" : ""}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--muted)]">
                      <span className="material-symbols-outlined">
                        expand_more
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="app-card overflow-hidden">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--line)] p-5">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text)]">
                    2. 预览与复制
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    配置结果将根据所选 IP 实时生成
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!markdownText || isCopiedAll}
                  onClick={() => void onCopyAll()}
                  className={`app-btn-primary shrink-0 transition-all duration-200 ease-out active:scale-[0.98] ${
                    isCopiedAll ? "!bg-[var(--success)] !text-white" : ""
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[18px]"
                    aria-hidden
                  >
                    {isCopiedAll ? "check" : "copy_all"}
                  </span>
                  <span>{isCopiedAll ? "已复制！" : "一键复制全部"}</span>
                </button>
              </div>

              <div className="p-5 bg-[#fafbfc]">
                {configLoading ? (
                  <div className="app-state-panel">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[var(--muted)] spin">
                        progress_activity
                      </span>
                      <p className="text-sm text-[var(--muted)]">
                        正在生成配置...
                      </p>
                    </div>
                  </div>
                ) : configError ? (
                  <div className="app-state-panel app-state-panel-error">
                    <p className="app-section-label text-[var(--danger)]">
                      Generation Failed
                    </p>
                    <p className="mt-2 text-sm font-semibold">配置生成失败</p>
                    <pre
                      className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-sm"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {String(configError)}
                    </pre>
                  </div>
                ) : !markdownText ? (
                  <div className="app-state-panel app-state-panel-empty flex flex-col items-center justify-center py-10 text-center">
                    <span className="material-symbols-outlined text-4xl text-[var(--line-strong)] mb-3">
                      integration_instructions
                    </span>
                    <p className="app-section-label">No Configuration Yet</p>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
                      请在上方选择一个 IPv4 地址以生成配置内容。
                    </p>
                  </div>
                ) : (
                  <ConfigMarkdown
                    markdownText={markdownText}
                    onCopySuccess={() => showToast("success", "代码段已复制")}
                  />
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <div className="app-card sticky top-6 p-5">
              <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3 mb-4">
                <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">
                  lightbulb
                </span>
                <h3 className="text-base font-semibold text-[var(--text)]">
                  说明与提示
                </h3>
              </div>

              <div className="space-y-5 text-sm text-[var(--muted)]">
                <div>
                  <p className="app-section-label mb-2">使用场景</p>
                  <div className="bg-[var(--primary-soft)] rounded-lg p-3 text-[13px] leading-6 text-[var(--primary-strong)] border border-[var(--primary)]/10">
                    生成的配置可以直接用于配置 Agent
                    或作为独立脚本执行，从而与后端的 IDA 实例进行通信。
                  </div>
                </div>

                <div>
                  <p className="app-section-label flex items-center gap-1.5 text-[var(--danger)] mb-2">
                    <span className="material-symbols-outlined text-[14px]">
                      warning
                    </span>
                    网络可达性
                  </p>
                  <p className="leading-6 text-[13px] bg-[var(--danger-soft)] p-3 rounded-lg border border-[var(--danger)]/20 text-[var(--danger)]">
                    如果前端单独运行（例如跨域或代理模式），请确保生成的配置中包含的
                    Hub 地址（即左侧选择的 IP）与目标环境网络相通。
                  </p>
                </div>

                <div>
                  <p className="app-section-label mb-2">快速操作</p>
                  <ul className="space-y-2 text-[13px] leading-6">
                    <li className="flex gap-2">
                      <span className="material-symbols-outlined text-[16px] text-[var(--success)] mt-0.5">
                        check_circle
                      </span>
                      <span>悬浮代码块右上角可单独复制某段代码。</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="material-symbols-outlined text-[16px] text-[var(--success)] mt-0.5">
                        check_circle
                      </span>
                      <span>
                        点击&quot;一键复制全部&quot;可获取完整配置流。
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
