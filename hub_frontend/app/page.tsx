"use client";

import useSWR from "swr";

import { Header } from "@/components/Header";
import { InstanceList } from "@/components/InstanceList";
import { fetchInstances } from "@/lib/api";
import type { InstanceInfo } from "@/lib/types";

export default function DashboardPage() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<
    InstanceInfo[]
  >("instances", fetchInstances, {
    refreshInterval: 5000,
  });

  const instanceCount = data?.length ?? 0;

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <Header
        title="IDA Hub Server"
        onRefresh={() => void mutate()}
        refreshing={isValidating}
      />
      <section className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 animate-slide-up">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="app-section-label">Dashboard</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)] md:text-[30px]">
              已连接实例
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              在一个桌面视图中查看当前在线的 IDA
              实例，并针对指定目标执行代码与排查连接状态。
            </p>
          </div>

          <div className="app-subcard flex flex-wrap items-start gap-4 px-4 py-3 lg:justify-end">
            <div>
              <p className="app-section-label">Instances</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                {instanceCount}
              </p>
            </div>
            <div
              className="hidden h-10 w-px bg-[var(--line)] sm:block"
              aria-hidden
            />
            <div>
              <p className="app-section-label">Refresh</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                每 5 秒自动刷新
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <section className="app-state-panel fade-in">
            <p className="app-section-label">Loading</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              正在加载实例列表，请稍候...
            </p>
          </section>
        ) : null}

        {error ? (
          <section className="app-state-panel app-state-panel-error fade-in">
            <p className="app-section-label text-[var(--danger)]">
              Request Error
            </p>
            <p className="mt-2 text-sm font-semibold">实例列表请求失败</p>
            <pre
              className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-sm"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {String(error)}
            </pre>
            <p className="mt-3 text-sm leading-6">
              请先确认 Hub 服务可访问，再使用右上角 Refresh 重新拉取数据。
            </p>
          </section>
        ) : null}

        {!isLoading && !error ? <InstanceList instances={data ?? []} /> : null}
      </section>
    </main>
  );
}
