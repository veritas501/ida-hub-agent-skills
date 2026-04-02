import useSWR from "swr";

import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { InstanceList } from "@/components/InstanceList";
import { useI18n } from "@/components/I18nProvider";
import { fetchInstances } from "@/lib/api";
import type { InstanceInfo } from "@/lib/types";

/** 骨架屏 — 实例卡片占位 */
function InstanceSkeleton() {
  return (
    <div className="app-card space-y-3 p-5">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full skeleton" />
        <div className="h-4 w-40 skeleton" />
        <div className="ml-auto h-4 w-24 skeleton" />
      </div>
      <div className="flex gap-4">
        <div className="h-3 w-16 skeleton" />
        <div className="h-3 w-16 skeleton" />
        <div className="h-3 w-28 skeleton" />
      </div>
      <div className="h-3 w-56 skeleton" />
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useI18n();
  const { data, error, isLoading } = useSWR<InstanceInfo[]>("instances", fetchInstances, { refreshInterval: 5000 });
  const instanceCount = data?.length ?? 0;

  return (
    <AuthGuard fallback={
      <main className="min-h-screen bg-[var(--bg)]">
        <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-5 py-6 sm:px-8">
          <section className="app-state-panel w-full fade-in">
            <p className="app-section-label">{t("common.loading")}</p>
            <p className="mt-1.5 text-sm text-[var(--text)]">{t("dashboard.authChecking")}</p>
          </section>
        </section>
      </main>
    }>
      <main className="min-h-screen bg-[var(--bg)]">
        <Header />
        <section className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 animate-slide-up">
          {/* 标题区 — 精简 */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="app-page-title">{t("dashboard.heading")}</h1>
              <p className="mt-1 app-page-subtitle">{t("dashboard.title")}</p>
            </div>
            {!isLoading && !error ? (
              <span className="app-badge app-badge-muted">
                {t("dashboard.instances")}: {instanceCount}
              </span>
            ) : null}
          </div>

          {/* 加载态 — 骨架屏 */}
          {isLoading ? (
            <div className="grid gap-4">
              <InstanceSkeleton />
              <InstanceSkeleton />
            </div>
          ) : null}

          {/* 错误态 */}
          {error ? (
            <section className="app-state-panel app-state-panel-error fade-in">
              <p className="app-section-label text-[var(--danger)]">{t("common.requestError")}</p>
              <p className="mt-1.5 text-sm font-medium">{t("dashboard.instancesRequestFailed")}</p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[13px] font-mono">{String(error)}</pre>
              <p className="mt-2 text-[13px]">{t("dashboard.refreshHint")}</p>
            </section>
          ) : null}

          {!isLoading && !error ? <InstanceList instances={data ?? []} /> : null}
        </section>
      </main>
    </AuthGuard>
  );
}
