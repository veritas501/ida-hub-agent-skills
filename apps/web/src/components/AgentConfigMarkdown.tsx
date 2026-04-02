import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import { copyText, type CopyTextResult } from "@/lib/clipboard";

function CodeBlockCopyButton({
  text,
  onCopySuccess,
  onCopyError,
}: {
  text: string;
  onCopySuccess: () => void;
  onCopyError: (result: Extract<CopyTextResult, { ok: false }>) => void;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleCopy = useCallback(() => {
    void (async () => {
      const result = await copyText(text);
      if (!result.ok) { onCopyError(result); return; }
      setCopied(true);
      onCopySuccess();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    })();
  }, [onCopyError, onCopySuccess, text]);

  return (
    <button
      onClick={handleCopy}
      className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[var(--panel-muted)] text-[var(--muted)] transition-all duration-150 hover:bg-[var(--panel)] hover:text-[var(--text)] active:scale-95"
      title={t("markdown.copyCode")}
      aria-label={t("markdown.copyCode")}
    >
      <Icon name={copied ? "check" : "content_copy"} size={12} />
    </button>
  );
}

interface AgentConfigMarkdownProps {
  markdownText: string;
  onCopySuccess: () => void;
  onCopyError: (result: Extract<CopyTextResult, { ok: false }>) => void;
}

export default function AgentConfigMarkdown({
  markdownText,
  onCopySuccess,
  onCopyError,
}: AgentConfigMarkdownProps) {
  const { t } = useI18n();

  return (
    <div className="markdown-body text-[14px] leading-7 text-[var(--text)]">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h3 className="mt-5 mb-2.5 flex items-center gap-2 text-base font-semibold tracking-tight text-[var(--text)] first:mt-0">
              <span className="inline-block h-3.5 w-1 rounded-full bg-[var(--primary)]" />
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h4 className="mt-4 mb-2 text-[15px] font-semibold tracking-tight text-[var(--text)]">
              {children}
            </h4>
          ),
          h3: ({ children }) => (
            <h5 className="text-[14px] font-semibold tracking-tight text-[var(--text)]">
              {children}
            </h5>
          ),
          p: ({ children }) => (
            <p className="mb-2.5 text-[14px] leading-7 text-[var(--text-secondary)]">
              {children}
            </p>
          ),
          code: ({ children, className, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !className;
            if (isInline) {
              return (
                <code className="app-inline-code" style={{ fontFamily: "var(--font-mono)" }} {...props}>
                  {children}
                </code>
              );
            }
            const codeText = String(children).replace(/\n$/, "");
            const language = match ? match[1] : "text";
            return (
              <>
                <div className="absolute right-2.5 top-2.5 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <CodeBlockCopyButton text={codeText} onCopySuccess={onCopySuccess} onCopyError={onCopyError} />
                </div>
                <SyntaxHighlighter
                  language={language}
                  style={vscDarkPlus as never}
                  customStyle={{
                    margin: 0, padding: 0, background: "transparent",
                    fontSize: "13px", lineHeight: "1.6", fontFamily: "var(--font-mono)",
                  }}
                  codeTagProps={{ className: "font-mono", style: { fontFamily: "var(--font-mono)" } }}
                >
                  {codeText}
                </SyntaxHighlighter>
              </>
            );
          },
          pre: ({ children }) => (
            <div className="group relative my-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--code-bg)]">
              <div className="flex items-center border-b border-[var(--line)] bg-[var(--panel-muted)] px-3 py-1.5">
                <div className="flex gap-1.5" aria-hidden>
                  <span className="h-2 w-2 rounded-full bg-[#ef5350]/50" />
                  <span className="h-2 w-2 rounded-full bg-[#f5a623]/50" />
                  <span className="h-2 w-2 rounded-full bg-[#3dce80]/50" />
                </div>
                <span className="ml-3 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
                  {t("common.code")}
                </span>
              </div>
              <div className="overflow-x-auto p-3.5">{children}</div>
            </div>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1 pl-5 text-[14px] text-[var(--text-secondary)] marker:text-[var(--muted)]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-[14px] text-[var(--text-secondary)] marker:text-[var(--muted)]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-7">{children}</li>,
        }}
      >
        {markdownText}
      </ReactMarkdown>
    </div>
  );
}
