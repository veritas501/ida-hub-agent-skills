import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import { fetchIDAConfig, fetchNetworkInterfaces } from "@/lib/api";
import { copyText, getCopyErrorMessageKey } from "@/lib/clipboard";
import type { IDAConfigResponse, NetworkInterfacesResponse } from "@/lib/types";

type ToastState = { type: "success" | "error"; message: string } | null;
const TOAST_DURATION_MS = 2000;

export default function IDAConfigPage() {
  const { data: interfacesData, error: interfacesError, isLoading: interfacesLoading } = useSWR<NetworkInterfacesResponse>("network/interfaces", fetchNetworkInterfaces);
  const [selectedIp, setSelectedIp] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [isCopiedConfig, setIsCopiedConfig] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useI18n();

  useEffect(() => { if (!selectedIp && interfacesData?.default_ip) setSelectedIp(interfacesData.default_ip); }, [interfacesData, selectedIp]);
  const { data: idaConfigData, error: idaConfigError, isLoading: idaConfigLoading } = useSWR<IDAConfigResponse>(selectedIp ? `ida_config/${selectedIp}` : null, () => fetchIDAConfig(selectedIp));
  useEffect(() => { return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current); }; }, []);

  const idaConfigText = useMemo(() => idaConfigData?.ida_config?.trim() ?? "", [idaConfigData]);

  function showToast(type: "success" | "error", message: string): void {
    setToast({ type, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => { setToast(null); toastTimerRef.current = null; }, TOAST_DURATION_MS);
  }

  async function onCopyConfig(): Promise<void> {
    if (!idaConfigText) return;
    const result = await copyText(idaConfigText);
    if (!result.ok) { showToast("error", t(getCopyErrorMessageKey(result))); return; }
    setIsCopiedConfig(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setIsCopiedConfig(false), TOAST_DURATION_MS);
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
              <h1 className="app-page-title">{t("idaConfig.heading")}</h1>
              <p className="mt-1 app-page-subtitle max-w-2xl">{t("idaConfig.description")}</p>
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

          <div className="space-y-5">
            {/* Step 1: IP 选择 */}
            <section className="app-card p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[11px] font-bold text-[var(--primary)]">1</span>
                    <h2 className="text-sm font-semibold text-[var(--text)]">{t("idaConfig.selectIpv4")}</h2>
                  </div>
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{t("idaConfig.selectIpv4Description")}</p>
                </div>
                <span className="app-badge app-badge-muted">{t("common.hubPort")}: 10086</span>
              </div>
              {interfacesError ? (
                <div className="app-state-panel app-state-panel-error mt-4">
                  <p className="app-section-label text-[var(--danger)]">{t("common.requestError")}</p>
                  <p className="mt-1.5 text-[13px] font-medium">{t("idaConfig.interfacesRequestFailed")}</p>
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

            {/* Step 2: 配置 */}
            <section className="app-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[11px] font-bold text-[var(--primary)]">2</span>
                  <h2 className="text-sm font-semibold text-[var(--text)]">{t("idaConfig.copyTitle")}</h2>
                </div>
                <button type="button" disabled={!idaConfigText || isCopiedConfig} onClick={() => void onCopyConfig()}
                  className={`app-btn-primary ${isCopiedConfig ? "!bg-[var(--success)] !shadow-none" : ""}`}>
                  <Icon name={isCopiedConfig ? "check" : "vpn_key"} size={16} />
                  <span>{isCopiedConfig ? t("common.copied") : t("idaConfig.copyButton")}</span>
                </button>
              </div>
              <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--panel-elevated)] p-4">
                {idaConfigLoading ? (
                  <div className="h-6 w-64 skeleton" />
                ) : idaConfigError ? (
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[13px] text-[var(--danger)] font-mono">{String(idaConfigError)}</pre>
                ) : idaConfigText ? (
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[13px] text-[var(--text)] font-mono">{idaConfigText}</pre>
                ) : (
                  <p className="text-[13px] text-[var(--muted)]">{t("idaConfig.emptyState")}</p>
                )}
              </div>
            </section>
          </div>
        </section>
      </main>
    </AuthGuard>
  );
}
