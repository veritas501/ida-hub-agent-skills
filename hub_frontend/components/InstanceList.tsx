import type { InstanceInfo } from "@/lib/types";

import { InstanceCard } from "./InstanceCard";

interface InstanceListProps {
  instances: InstanceInfo[];
}

export function InstanceList({ instances }: InstanceListProps) {
  if (instances.length === 0) {
    return (
      <section className="app-state-panel app-state-panel-empty text-left">
        <p className="app-section-label">Empty State</p>
        <h3 className="mt-2 text-lg font-semibold text-[var(--text)]">当前没有已连接的 IDA 实例</h3>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          可以按下面顺序快速排查：确认 Hub 已启动、插件已执行 Connect、并检查默认连接地址是否为
          <code className="app-inline-code ml-1" style={{ fontFamily: "var(--font-mono)" }}>127.0.0.1:10086</code>
          。
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
          <li>检查 Hub backend 是否正在监听 10086 端口。</li>
          <li>在 IDA 中通过 Edit -&gt; IDA Multi Chat -&gt; Connect 重新连接。</li>
          <li>若仍未出现实例，优先确认本机地址与 WebSocket 连接配置是否一致。</li>
        </ul>
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      {instances.map((instance) => (
        <InstanceCard key={instance.instance_id} instance={instance} />
      ))}
    </div>
  );
}
