"use client";

import useSWR from "swr";

import { Header } from "@/components/Header";
import { InstanceList } from "@/components/InstanceList";
import { fetchInstances } from "@/lib/api";
import type { InstanceInfo } from "@/lib/types";

export default function DashboardPage() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<InstanceInfo[]>(
    "instances",
    fetchInstances,
    {
      refreshInterval: 5000
    }
  );

  return (
    <main className="min-h-screen bg-[#f6f6f8]">
      <Header title="IDA Hub Server" onRefresh={() => void mutate()} refreshing={isValidating} />
      <section className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold tracking-tight text-[#222d3f] md:text-[24px]">
            Connected Instances ({data?.length ?? 0})
          </h2>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-[#e4e8ef] bg-white p-6 text-sm text-[#69758a]">
            正在加载实例列表...
          </div>
        ) : null}

        {error ? (
          <pre className="overflow-x-auto rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {String(error)}
          </pre>
        ) : null}

        {!isLoading && !error ? <InstanceList instances={data ?? []} /> : null}
      </section>
    </main>
  );
}
