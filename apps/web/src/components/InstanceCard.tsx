import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import { executeCode } from "@/lib/api";
import { copyText, getCopyErrorMessageKey } from "@/lib/clipboard";
import { formatMessage, getDateTimeLocale } from "@/lib/i18n/helpers";
import type { ExecuteResponse, InstanceInfo } from "@/lib/types";

import { CodeEditor } from "./CodeEditor";
import { Icon } from "./ui/Icon";

interface InstanceCardProps {
  instance: InstanceInfo;
  index: number;
}

const DEFAULT_CODE = "print('hello from hub')";
type CopyField = "title";
type CopyFeedback =
  | { field: CopyField; type: "success"; message: string }
  | { field: CopyField; type: "error"; message: string }
  | null;

export function InstanceCard({ instance, index }: InstanceCardProps) {
  const [showExecute, setShowExecute] = useState(false);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExecuteResponse | null>(null);
  const [errorText, setErrorText] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { locale, t } = useI18n();

  const copyToClipboard = useCallback(async (text: string, field: CopyField) => {
    const result = await copyText(text);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    if (!result.ok) {
      setCopyFeedback({ field, type: "error", message: t(getCopyErrorMessageKey(result)) });
      copyTimerRef.current = setTimeout(() => setCopyFeedback(null), 2000);
      return;
    }
    setCopyFeedback({ field, type: "success", message: t("instanceCard.copiedInstanceId") });
    copyTimerRef.current = setTimeout(() => setCopyFeedback(null), 2000);
  }, [t]);

  useEffect(() => {
    return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); };
  }, []);

  const executePanelId = useId();
  const displayModule = instance.module || t("common.unknown");
  const connectedAt = useMemo(() => {
    const date = new Date(instance.connected_at);
    return Number.isNaN(date.getTime())
      ? instance.connected_at
      : date.toLocaleString(getDateTimeLocale(locale));
  }, [instance.connected_at, locale]);

  async function onExecute() {
    setLoading(true);
    setErrorText("");
    setResult(null);
    try {
      const response = await executeCode({ instance_id: instance.instance_id, code });
      setResult(response);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <article
      className="app-card animate-slide-up p-5 opacity-0"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* 头部行：在线状态 + instance_id + 模块名 */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="app-badge app-badge-success">
          <span className="h-2 w-2 rounded-full bg-[var(--success)] pulse-dot" aria-hidden />
          <span>{t("instanceCard.online")}</span>
        </span>

        <button
          type="button"
          className="group flex items-center gap-1.5"
          title={t("instanceCard.copyInstanceId")}
          aria-label={`${t("instanceCard.copyInstanceId")} ${instance.instance_id}`}
          onClick={() => void copyToClipboard(instance.instance_id, "title")}
        >
          <code className="app-inline-code transition-colors group-hover:border-[var(--primary)] group-hover:text-[var(--text)] active:scale-[0.97]">
            {instance.instance_id}
          </code>
          <Icon name="content_copy" size={13} className="text-[var(--muted)] group-hover:text-[var(--primary-text)]" />
        </button>

        {copyFeedback?.field === "title" ? (
          <span
            className={`text-xs font-medium fade-in ${copyFeedback.type === "success" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
            role={copyFeedback.type === "error" ? "alert" : "status"}
            aria-live={copyFeedback.type === "error" ? "assertive" : "polite"}
          >
            {copyFeedback.message}
          </span>
        ) : null}

        <span className="ml-auto text-sm font-medium text-[var(--text)]" title={displayModule}>
          {displayModule}
        </span>
      </div>

      {/* 元数据行：紧凑水平排列 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--text-secondary)]">
        <span>{instance.architecture || t("common.unknown")}</span>
        <span className="text-[var(--line-strong)]" aria-hidden>|</span>
        <span>{instance.platform || t("common.unknown")}</span>
        <span className="text-[var(--line-strong)]" aria-hidden>|</span>
        <span>{connectedAt}</span>
      </div>

      {/* DB 路径 */}
      {instance.db_path ? (
        <p className="mt-2 truncate text-[12px] font-mono text-[var(--muted)]" title={instance.db_path}>
          {instance.db_path}
        </p>
      ) : null}

      {/* 操作栏 */}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowExecute((prev) => !prev)}
          aria-expanded={showExecute}
          aria-controls={executePanelId}
          className="app-btn-primary"
          title={showExecute ? t("instanceCard.collapseExecutePanel") : t("instanceCard.openExecutePanel")}
        >
          <Icon name={showExecute ? "expand_less" : "play_arrow"} size={16} />
          <span>{showExecute ? t("instanceCard.collapse") : t("instanceCard.fastExecute")}</span>
        </button>
      </div>

      {/* 执行面板 */}
      {showExecute ? (
        <section
          id={executePanelId}
          className="mt-4 space-y-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--panel-elevated)] p-4 fade-in"
          aria-label={formatMessage(t("instanceCard.executeCodeOn"), { module: displayModule })}
        >
          <div>
            <label htmlFor={`${executePanelId}-code`} className="app-section-label mb-2 block">
              {t("instanceCard.pythonCode")}
            </label>
            <CodeEditor value={code} onChange={setCode} onRun={onExecute} running={loading} id={`${executePanelId}-code`} />
          </div>

          {errorText ? (
            <div className="rounded-[var(--radius-sm)] border border-[rgba(239,83,80,0.2)] bg-[var(--danger-soft)] p-3 fade-in" aria-live="polite">
              <p className="app-section-label text-[var(--danger)]">{t("common.requestError")}</p>
              <pre className="mt-1.5 whitespace-pre-wrap break-words text-[13px] font-medium text-[var(--danger)]" style={{ fontFamily: "var(--font-mono)" }}>
                {errorText}
              </pre>
            </div>
          ) : null}

          {result ? (
            <div
              className={`space-y-3 rounded-[var(--radius-sm)] border p-4 fade-in ${
                result.success
                  ? "border-[rgba(61,206,128,0.15)] bg-[var(--success-soft)]"
                  : "border-[rgba(239,83,80,0.15)] bg-[var(--danger-soft)]"
              }`}
              aria-live="polite"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Icon name={result.success ? "check_circle" : "error"} size={16}
                    className={result.success ? "text-[var(--success)]" : "text-[var(--danger)]"} />
                  <span className={`text-sm font-semibold ${result.success ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                    {result.success ? t("common.success") : t("common.failed")}
                  </span>
                </div>
                <code className="truncate text-[11px] font-mono text-[var(--muted)]">{result.request_id}</code>
              </div>

              {result.output ? (
                <div>
                  <p className="app-section-label mb-1.5">{t("common.output")}</p>
                  <pre className="app-code-block">{result.output}</pre>
                </div>
              ) : null}

              {result.error ? (
                <div>
                  <p className="app-section-label mb-1.5 text-[var(--danger)]">{t("common.error")}</p>
                  <pre className="whitespace-pre-wrap break-words rounded-[var(--radius-sm)] border border-[rgba(239,83,80,0.15)] bg-[var(--danger-soft)] p-3 text-[13px] font-medium text-[var(--danger)]" style={{ fontFamily: "var(--font-mono)" }}>
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
