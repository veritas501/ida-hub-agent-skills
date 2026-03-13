"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function CodeBlockCopyButton({
  text,
  onCopy,
}: {
  text: string;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void copyText(text);
        setCopied(true);
        onCopy();
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-600/50 bg-slate-700/50 text-slate-300 transition-all duration-200 ease-out hover:bg-slate-600 hover:text-white active:scale-[0.95]"
      title="Copy code"
      aria-label="Copy code"
    >
      <span className="material-symbols-outlined text-[14px]">
        {copied ? "check" : "content_copy"}
      </span>
    </button>
  );
}

interface ConfigMarkdownProps {
  markdownText: string;
  onCopySuccess: () => void;
}

export default function ConfigMarkdown({ markdownText, onCopySuccess }: ConfigMarkdownProps) {
  return (
    <div className="markdown-body text-[14px] leading-7 text-[var(--text)]">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h3 className="text-[17px] font-semibold tracking-tight text-[var(--text)] flex items-center gap-2 mt-6 first:mt-0 mb-3">
              <span className="w-1 h-4 bg-[var(--primary)] rounded-full inline-block"></span>
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h4 className="text-[15px] font-semibold tracking-tight text-[var(--text)] mt-4 mb-2">
              {children}
            </h4>
          ),
          h3: ({ children }) => (
            <h5 className="text-[14px] font-semibold tracking-tight text-[var(--text)]">
              {children}
            </h5>
          ),
          p: ({ children }) => (
            <p className="text-[14px] leading-7 text-[var(--text)] mb-3">
              {children}
            </p>
          ),
          code: ({ children, className, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="app-inline-code"
                  style={{ fontFamily: "var(--font-mono)" }}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            const codeText = String(children).replace(/\n$/, "");
            const language = match ? match[1] : "text";

            return (
              <>
                <div className="absolute right-3 top-3 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <CodeBlockCopyButton
                    text={codeText}
                    onCopy={onCopySuccess}
                  />
                </div>
                <SyntaxHighlighter
                  language={language}
                  style={vscDarkPlus as any}
                  customStyle={{
                    margin: 0,
                    padding: 0,
                    background: "transparent",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    fontFamily: "var(--font-mono)",
                  }}
                  codeTagProps={{
                    className: "font-mono",
                    style: { fontFamily: "var(--font-mono)" },
                  }}
                >
                  {codeText}
                </SyntaxHighlighter>
              </>
            );
          },
          pre: ({ children }) => (
            <div className="relative group my-4 rounded-xl overflow-hidden border border-slate-800 shadow-sm bg-[var(--code-bg)]">
              <div className="flex items-center px-4 py-2 bg-slate-800 border-b border-slate-700/50">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                </div>
                <div className="ml-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Code
                </div>
              </div>
              <div className="p-4 overflow-x-auto">
                {children}
              </div>
            </div>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1.5 pl-5 text-[14px] text-[var(--text)] mb-4 marker:text-[var(--muted)]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1.5 pl-5 text-[14px] text-[var(--text)] mb-4 marker:text-[var(--muted)]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-7">{children}</li>
          ),
        }}
      >
        {markdownText}
      </ReactMarkdown>
    </div>
  );
}