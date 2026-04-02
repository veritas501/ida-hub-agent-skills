import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { clearAuth, getUsername } from "@/lib/auth";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";

const VERSION = "0.1.0";

/** 导航项 — 激活态用底部橙色线条指示 */
function navClass(active: boolean): string {
  const base =
    "relative flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition-colors duration-200";
  if (active) {
    return `${base} text-[var(--primary-text)] after:absolute after:bottom-0 after:left-2 after:right-2 after:h-[2px] after:rounded-full after:bg-[var(--primary)]`;
  }
  return `${base} text-[var(--muted)] hover:text-[var(--text-secondary)]`;
}

function languageOptionClass(active: boolean): string {
  return active
    ? "relative z-10 inline-flex min-w-[28px] items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold text-[var(--text)]"
    : "relative z-10 inline-flex min-w-[28px] items-center justify-center rounded-full px-2 py-1 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--text-secondary)]";
}

export function Header() {
  const { pathname } = useLocation();
  const [username, setUsername] = useState<string | null>(null);
  const { locale, setLocale, t } = useI18n();

  useEffect(() => { setUsername(getUsername()); }, []);

  function handleLogout() {
    clearAuth();
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--topbar-border)] bg-[var(--topbar-bg)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
        {/* 品牌 + 导航 */}
        <div className="flex items-center gap-6">
          {/* 品牌标识 */}
          <div className="flex items-center gap-2.5 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <Icon name="terminal" size={18} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-tight text-[var(--text)]">{t("header.brand")}</p>
              <p className="text-[10px] font-medium text-[var(--muted)]">v{VERSION}</p>
            </div>
          </div>

          {/* 导航 */}
          <nav className="flex items-center">
            <Link to="/" className={navClass(pathname === "/")}>
              <Icon name="dashboard" size={16} aria-hidden />
              <span>{t("header.nav.dashboard")}</span>
            </Link>
            <Link to="/ida_config" className={navClass(pathname === "/ida_config")}>
              <Icon name="extension" size={16} aria-hidden />
              <span>{t("header.nav.idaConfig")}</span>
            </Link>
            <Link to="/agent_config" className={navClass(pathname === "/agent_config")}>
              <Icon name="smart_toy" size={16} aria-hidden />
              <span>{t("header.nav.agentConfig")}</span>
            </Link>
          </nav>
        </div>

        {/* 右侧工具区 */}
        <div className="flex items-center gap-3">
          {/* 语言切换 */}
          <div
            className="relative inline-flex h-7 items-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-elevated)] p-0.5"
            aria-label={t("header.language.label")}
          >
            <span
              className={`pointer-events-none absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-[var(--panel-muted)] border border-[var(--line-strong)] transition-transform duration-200 ease-out ${locale === "zh" ? "translate-x-0" : "translate-x-full"}`}
              aria-hidden
            />
            <button type="button" onClick={() => setLocale("zh")} aria-pressed={locale === "zh"} aria-label={t("header.language.switchToChinese")} className={languageOptionClass(locale === "zh")}>
              {t("header.language.zhShort")}
            </button>
            <button type="button" onClick={() => setLocale("en")} aria-pressed={locale === "en"} aria-label={t("header.language.switchToEnglish")} className={languageOptionClass(locale === "en")}>
              {t("header.language.enShort")}
            </button>
          </div>

          {username ? (
            <>
              <div className="h-4 w-px bg-[var(--line)]" aria-hidden />
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-[var(--muted-strong)]">
                  <Icon name="person" size={14} aria-hidden />{username}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] active:scale-95"
                  title={t("header.logout")}
                  aria-label={t("header.logout")}
                >
                  <Icon name="logout" size={16} aria-hidden />
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
