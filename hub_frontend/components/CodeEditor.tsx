"use client";

import { useCallback, useMemo, useRef } from "react";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-python";

interface CodeEditorProps {
  value: string;
  onChange: (code: string) => void;
  onRun?: () => void;
  running?: boolean;
  id?: string;
  minHeight?: string;
  maxHeight?: string;
}

function highlightPython(code: string): string {
  return highlight(code, languages.python, "python");
}

export function CodeEditor({
  value,
  onChange,
  onRun,
  running = false,
  id,
  minHeight = "168px",
  maxHeight = "400px",
}: CodeEditorProps) {
  const gutterRef = useRef<HTMLDivElement>(null);

  const lineCount = useMemo(() => {
    const count = value.split("\n").length;
    return Math.max(count, 7);
  }, [value]);

  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1),
    [lineCount],
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  }, []);

  return (
    <div className="code-editor overflow-hidden rounded-xl border border-[var(--line-strong)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-700/50 bg-[#1e293b] px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-3 w-3 rounded-full bg-slate-600" />
            <span className="h-3 w-3 rounded-full bg-slate-600" />
            <span className="h-3 w-3 rounded-full bg-slate-600" />
          </div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Python
          </span>
        </div>
        {onRun && (
          <button
            type="button"
            onClick={onRun}
            disabled={running}
            aria-busy={running}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-[13px] font-semibold text-white transition-all duration-200 ease-out hover:bg-[var(--primary-strong)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              className="material-symbols-outlined text-[16px]"
              aria-hidden
            >
              {running ? "hourglass_top" : "play_arrow"}
            </span>
            <span>{running ? "Running..." : "Run"}</span>
          </button>
        )}
      </div>

      {/* Editor body */}
      <div
        className="flex overflow-auto"
        style={{
          minHeight,
          maxHeight,
          background: "var(--code-bg)",
        }}
        onScroll={handleScroll}
      >
        {/* Line numbers gutter */}
        <div
          ref={gutterRef}
          className="pointer-events-none shrink-0 select-none overflow-hidden border-r border-[#1e293b] bg-[#0d1117] py-[10px] pr-3 text-right"
          style={{ width: 48 }}
          aria-hidden
        >
          {lineNumbers.map((n) => (
            <div
              key={n}
              className="leading-[1.6] text-[12px]"
              style={{
                color: "rgba(138, 145, 153, 0.4)",
                fontFamily: "var(--font-mono)",
                height: "20.8px",
              }}
            >
              {n}
            </div>
          ))}
        </div>

        {/* Code area */}
        <div className="min-w-0 flex-1">
          <Editor
            value={value}
            onValueChange={onChange}
            highlight={highlightPython}
            tabSize={4}
            insertSpaces
            textareaId={id}
            padding={10}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              lineHeight: 1.6,
              color: "#f8fafc",
              caretColor: "var(--primary)",
              minHeight,
            }}
          />
        </div>
      </div>
    </div>
  );
}
