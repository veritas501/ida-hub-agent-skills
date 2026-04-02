import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import { fetchAgentConfig, fetchNetworkInterfaces } from "@/lib/api";
import { copyText, getCopyErrorMessageKey } from "@/lib/clipboard";
import type { AgentConfigResponse, NetworkInterfacesResponse } from "@/lib/types";

const AgentConfigMarkdown = lazy(() => import("@/components/AgentConfigMarkdown"));

type ToastState = { type: "success" | "error"; message: string } | null;
const TOAST_DURATION_MS = 2000;

export default function AgentConfigPage() {
  const { data: interfacesData, error: interfacesError, isLoading: interfacesLoading } = useSWR<NetworkInterfacesResponse>("network/interfaces", fetchNetworkInterfaces);
  const [selectedIp, setSelectedIp] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useI18n();

  useEffect(() => { if (!selectedIp && interfacesData?.default_ip) setSelectedIp(interfacesData.default_ip); }, [interfacesData, selectedIp]);
  const { data: agentConfigData, error: agentConfigError, isLoading: agentConfigLoading } = useSWR<AgentConfigResponse>(selectedIp ? `agent_config/${selectedIp}` : null, () => fetchAgentConfig(selectedIp));
  const [isCopiedAll, setIsCopiedAll] = useState(false);

  useEffect(() => { return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current); }; }, []);

  const markdownText = useMemo(() => agentConfigData?.result ?? "", [agentConfigData]);

  function showToast(type: "success" | "error", message: string): void {
    setToast({ type, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => { setToast(null); toastTimerRef.current = null; }, TOAST_DURATION_MS);
  }

  async function onCopyAll(): Promise<void> {
    if (!markdownText) return;
    const result = await copyText(markdownText);
    if (!result.ok) { showToast("error", t(getCopyErrorMessageKey(result))); return; }
    setIsCopiedAll(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setIsCopiedAll(false), TOAST_DURATION_MS);
  }

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[var(--bg)]">
        <Header />

        {/* Toast */}
        {toast ? (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 max-w-xs animate-toast">
            <div
              role={toast.type === "error" ? "alert" : "status"}
              aria-live={toast.type === "error" ? "assertive" : "polite"} aria-atomic="true"
              className={`flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2.5 text-[13px] font-medium shadow-lg ${
                toast.type === "success"
                  ? "border-[rgba(61,206,128,0.15)] bg-[var(--success-soft)] text-[var(--success)]"
                  : "border-[rgba(239,83,80,0.15)] bg-[var(--danger-soft)] text-[var(--danger)]"
              }`}
            >
              <Icon name={toast.type === "success" ? "check_circle" : "error"} size={16} />
              {toast.message}
            </div>
          </div>
        ) : null}

        <section className="mx-auto w-full max-w-6xl space-y-5 px-5 py-6 sm:px-8 animate-slide-up">
          {/* 页面标题 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="app-page-title">{t("agentConfig.heading")}</h1>
              <p className="mt-1 app-page-subtitle max-w-2xl">{t("agentConfig.description")}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="app-badge app-badge-muted">
                {t("common.interfaces")}: {interfacesData?.interfaces.length ?? 0}
              </span>
              {selectedIp ? (
                <span className="app-badge app-badge-muted font-mono">
                  {selectedIp}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              {/* Step 1: IP 选择 */}
              <section className="app-card p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[11px] font-bold text-[var(--primary)]">1</span>
                      <h2 className="text-sm font-semibold text-[var(--text)]">{t("agentConfig.selectIpv4")}</h2>
                    </div>
                    <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{t("agentConfig.selectIpv4Description")}</p>
                  </div>
                  <span className="app-badge app-badge-muted">{t("common.hubPort")}: 10086</span>
                </div>
                {interfacesError ? (
                  <div className="app-state-panel app-state-panel-error mt-4">
                    <p className="app-section-label text-[var(--danger)]">{t("common.requestError")}</p>
                    <p className="mt-1.5 text-[13px] font-medium">{t("agentConfig.interfacesRequestFailed")}</p>
                  </div>
                ) : interfacesLoading ? (
                  <div className="mt-4 h-10 skeleton" />
                ) : (
                  <div className="mt-4">
                    <label htmlFor="ip-select" className="app-section-label block mb-1.5">{t("common.availableInterfaces")}</label>
                    <div className="relative">
                      <select id="ip-select" value={selectedIp} onChange={(event) => setSelectedIp(event.target.value)} disabled={!interfacesData?.interfaces.length} className="app-select">
                        {interfacesData?.interfaces.map((item) => (
                          <option key={`${item.name}-${item.ipv4}`} value={item.ipv4}>
                            {item.ipv4} - {item.name}{item.is_loopback ? ` (${t("common.loopback")})` : ""}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--muted)]">
                        <Icon name="expand_more" size={16} />
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Step 2: 预览 */}
              <section className="app-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[11px] font-bold text-[var(--primary)]">2</span>
                    <h2 className="text-sm font-semibold text-[var(--text)]">{t("agentConfig.previewTitle")}</h2>
                  </div>
                  <button type="button" disabled={!markdownText || isCopiedAll} onClick={() => void onCopyAll()}
                    className={`app-btn-primary ${isCopiedAll ? "!bg-[var(--success)] !shadow-none" : ""}`}>
                    <Icon name={isCopiedAll ? "check" : "copy_all"} size={16} />
                    <span>{isCopiedAll ? t("agentConfig.copiedAll") : t("agentConfig.copyAll")}</span>
                  </button>
                </div>
                <div className="bg-[var(--panel-elevated)] p-5">
                  {agentConfigLoading ? (
                    <div className="space-y-3">
                      <div className="h-4 w-48 skeleton" />
                      <div className="h-3 w-full skeleton" />
                      <div className="h-3 w-3/4 skeleton" />
                      <div className="h-20 skeleton" />
                    </div>
                  ) : agentConfigError ? (
                    <div className="app-state-panel app-state-panel-error">
                      <p className="app-section-label text-[var(--danger)]">{t("common.generationFailed")}</p>
                      <p className="mt-1.5 text-[13px] font-medium">{t("agentConfig.configGenerationFailed")}</p>
                    </div>
                  ) : !markdownText ? (
                    <div className="app-state-panel app-state-panel-empty flex flex-col items-center justify-center py-8 text-center">
                      <Icon name="integration_instructions" size={32} className="mb-2 text-[var(--line-strong)]" />
                      <p className="app-section-label">{t("agentConfig.emptyTitle")}</p>
                      <p className="mt-1.5 max-w-sm text-[13px] text-[var(--muted)]">{t("agentConfig.emptyDescription")}</p>
                    </div>
                  ) : (
                    <Suspense fallback={<div className="space-y-3"><div className="h-4 w-48 skeleton" /><div className="h-3 w-full skeleton" /><div className="h-20 skeleton" /></div>}>
                      <AgentConfigMarkdown markdownText={markdownText} onCopySuccess={() => showToast("success", t("agentConfig.copiedBlock"))} onCopyError={(result) => showToast("error", t(getCopyErrorMessageKey(result)))} />
                    </Suspense>
                  )}
                </div>
              </section>
            </div>

            {/* 侧栏 Tips */}
            <aside>
              <div className="app-card sticky top-20 p-5">
                <div className="mb-3 flex items-center gap-2 border-b border-[var(--line)] pb-3">
                  <Icon name="lightbulb" size={16} className="text-[var(--primary)]" />
                  <h3 className="text-sm font-semibold text-[var(--text)]">{t("agentConfig.tipsTitle")}</h3>
                </div>
                <div className="space-y-4 text-[13px]">
                  <div>
                    <p className="app-section-label mb-1.5">{t("agentConfig.usageTitle")}</p>
                    <div className="rounded-[var(--radius-sm)] border border-[rgba(232,123,53,0.1)] bg-[var(--primary-soft)] p-2.5 text-[12px] leading-relaxed text-[var(--primary-text)]">
                      {t("agentConfig.usageDescription")}
                    </div>
                  </div>
                  <div>
                    <p className="app-section-label mb-1.5 flex items-center gap-1.5 text-[var(--danger)]">
                      <Icon name="warning" size={12} />{t("agentConfig.networkReachability")}
                    </p>
                    <div className="rounded-[var(--radius-sm)] border border-[rgba(239,83,80,0.15)] bg-[var(--danger-soft)] p-2.5 text-[12px] leading-relaxed text-[var(--danger)]">
                      {t("agentConfig.networkReachabilityDescription")}
                    </div>
                  </div>
                  <div>
                    <p className="app-section-label mb-1.5">{t("agentConfig.quickActions")}</p>
                    <ul className="space-y-1.5 text-[12px] text-[var(--muted-strong)]">
                      <li className="flex gap-1.5"><Icon name="check_circle" size={14} className="mt-0.5 text-[var(--success)]" /><span>{t("agentConfig.quickActionCopyBlock")}</span></li>
                      <li className="flex gap-1.5"><Icon name="check_circle" size={14} className="mt-0.5 text-[var(--success)]" /><span>{t("agentConfig.quickActionCopyAll")}</span></li>
                    </ul>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </AuthGuard>
  );
}
