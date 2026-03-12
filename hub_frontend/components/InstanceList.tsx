import type { InstanceInfo } from "@/lib/types";

import { InstanceCard } from "./InstanceCard";

interface InstanceListProps {
  instances: InstanceInfo[];
}

export function InstanceList({ instances }: InstanceListProps) {
  if (instances.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cfd7e5] bg-white p-8 text-center text-sm text-[#69758a]">
        当前没有已连接的 IDA 实例。
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {instances.map((instance) => (
        <InstanceCard key={instance.instance_id} instance={instance} />
      ))}
    </div>
  );
}
