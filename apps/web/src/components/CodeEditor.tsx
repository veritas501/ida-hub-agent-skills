import { useCallback, useMemo, useRef } from "react";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-python";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";

interface CodeEditorProps { value: string; onChange: (code: string) => void; onRun?: () => void; running?: boolean; id?: string; minHeight?: string; maxHeight?: string; }
function highlightPython(code: string): string { return highlight(code, languages.python, "python"); }

export function CodeEditor({ value, onChange, onRun, running = false, id, minHeight = "168px", maxHeight = "400px" }: CodeEditorProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const lineCount = useMemo(() => Math.max(value.split("\n").length, 7), [value]);
  const lineNumbers = useMemo(() => Array.from({ length: lineCount }, (_, i) => i + 1), [lineCount]);
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => { if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop; }, []);

  return (
    <div className="code-editor overflow-hidden rounded-[var(--radius-md)] border border-[var(--line-strong)]">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--panel-muted)] px-3 py-1.5">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-[#ef5350]/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#f5a623]/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#3dce80]/60" />
          </div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">{t("common.python")}</span>
        </div>
        {onRun && (
          <button type="button" onClick={onRun} disabled={running} aria-busy={running}
            className="app-btn-primary !min-h-[28px] !px-2.5 !py-1 !text-[12px]">
            <Icon name={running ? "hourglass_top" : "play_arrow"} size={14} spin={running} />
            <span>{running ? t("common.running") : t("common.run")}</span>
          </button>
        )}
      </div>
      {/* 编辑区 */}
      <div className="flex overflow-auto" style={{ minHeight, maxHeight, background: "var(--code-bg)" }} onScroll={handleScroll}>
        <div ref={gutterRef} className="pointer-events-none shrink-0 select-none overflow-hidden border-r border-[var(--line)] py-[10px] pr-3 text-right" style={{ width: 44 }} aria-hidden>
          {lineNumbers.map((n) => (
            <div key={n} className="leading-[1.6] text-[12px]" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", height: "20.8px" }}>{n}</div>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <Editor value={value} onValueChange={onChange} highlight={highlightPython} tabSize={4} insertSpaces textareaId={id} padding={10}
            style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6, color: "#e4e6eb", caretColor: "var(--primary)", minHeight }} />
        </div>
      </div>
    </div>
  );
}
