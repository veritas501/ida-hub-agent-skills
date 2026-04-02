import type { InstanceInfo } from "@/lib/types";
import { useI18n } from "@/components/I18nProvider";
import { InstanceCard } from "./InstanceCard";

interface InstanceListProps { instances: InstanceInfo[]; }

export function InstanceList({ instances }: InstanceListProps) {
  const { t } = useI18n();
  if (instances.length === 0) {
    return (
      <section className="app-state-panel app-state-panel-empty text-left">
        <h3 className="text-sm font-semibold text-[var(--text)]">{t("instanceList.emptyTitle")}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
          {t("instanceList.emptyDescriptionPrefix")}
          <code className="app-inline-code mx-1">/ida_config</code>
          {t("instanceList.emptyDescriptionMiddle")}
          <code className="app-inline-code mx-1">IDA Config</code>
          {t("instanceList.emptyDescriptionSuffix")}
          <code className="app-inline-code mx-1">Check</code>
          {t("instanceList.emptyDescriptionEnd")}
          <code className="app-inline-code mx-1">Connect</code>。
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] text-[var(--muted)]">
          <li>{t("instanceList.checkHub")}</li>
          <li>{t("instanceList.selectIpAndCopyPrefix")}<code className="app-inline-code mx-1">/ida_config</code>{t("instanceList.selectIpAndCopyMiddle")}<code className="app-inline-code mx-1">IDA Config</code>{t("instanceList.selectIpAndCopySuffix")}</li>
          <li>{t("instanceList.settingsInstructionPrefix")}<code className="app-inline-code mx-1">Edit -&gt; IDA Multi Chat -&gt; Settings</code>{t("instanceList.settingsInstructionMiddle")}<code className="app-inline-code mx-1">Check</code>{t("instanceList.settingsInstructionSuffix")}</li>
          <li>{t("instanceList.connectInstructionPrefix")}<code className="app-inline-code mx-1">Edit -&gt; IDA Multi Chat -&gt; Connect</code>{t("instanceList.connectInstructionSuffix")}</li>
        </ul>
      </section>
    );
  }
  return (
    <div className="grid gap-4">
      {instances.map((instance, index) => (<InstanceCard key={instance.instance_id} instance={instance} index={index} />))}
    </div>
  );
}
