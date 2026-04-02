import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import { login, register } from "@/lib/api";
import { setAuth } from "@/lib/auth";

type Mode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();
  const isRegister = mode === "register";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) { setError(t("login.fillUsernamePassword")); return; }
    if (isRegister && password !== confirmPassword) { setError(t("login.passwordMismatch")); return; }
    setLoading(true);
    try {
      const fn = isRegister ? register : login;
      const res = await fn(username.trim(), password);
      setAuth(res.username, res.token);
      window.location.href = "/";
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }

  function switchMode() { setMode(isRegister ? "login" : "register"); setError(""); setConfirmPassword(""); }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      {/* 网格背景 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(232, 123, 53, 0.04) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        {/* 品牌区 */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
            <Icon name="terminal" size={26} />
          </span>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-[var(--text)]">{t("login.appName")}</h1>
            <p className="mt-0.5 text-[13px] text-[var(--muted)]">
              {isRegister ? t("login.registerSubtitle") : t("login.loginSubtitle")}
            </p>
          </div>
        </div>

        {/* 登录卡片 — 顶部渐变边框 */}
        <div className="app-card overflow-hidden">
          <div className="h-[2px] bg-gradient-to-r from-[var(--primary)] via-[#f0944f] to-[var(--primary-strong)]" />
          <div className="p-5">
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {/* 用户名 */}
              <div>
                <label htmlFor="username" className="app-section-label mb-1.5 block">{t("login.username")}</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--muted)]">
                    <Icon name="person" size={18} />
                  </span>
                  <input
                    id="username" type="text" autoComplete="username"
                    value={username} onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("login.usernamePlaceholder")}
                    className="app-input app-input-with-icon"
                  />
                </div>
              </div>

              {/* 密码 */}
              <div>
                <label htmlFor="password" className="app-section-label mb-1.5 block">{t("login.password")}</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--muted)]">
                    <Icon name="lock" size={18} />
                  </span>
                  <input
                    id="password" type="password"
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("login.passwordPlaceholder")}
                    className="app-input app-input-with-icon"
                  />
                </div>
              </div>

              {/* 确认密码 */}
              {isRegister ? (
                <div>
                  <label htmlFor="confirm-password" className="app-section-label mb-1.5 block">{t("login.confirmPassword")}</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--muted)]">
                      <Icon name="lock" size={18} />
                    </span>
                    <input
                      id="confirm-password" type="password" autoComplete="new-password"
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t("login.confirmPasswordPlaceholder")}
                      className="app-input app-input-with-icon"
                    />
                  </div>
                </div>
              ) : null}

              {/* 错误提示 */}
              {error ? (
                <div role="alert" className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[rgba(239,83,80,0.2)] bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] font-medium text-[var(--danger)]">
                  <Icon name="error" size={16} />{error}
                </div>
              ) : null}

              {/* 提交按钮 */}
              <button type="submit" disabled={loading} className="app-btn-primary w-full justify-center">
                <Icon name={loading ? "progress_activity" : isRegister ? "how_to_reg" : "login"} size={16} spin={loading} />
                <span>{loading ? t("login.submitting") : isRegister ? t("login.submitRegister") : t("login.submitLogin")}</span>
              </button>
            </form>

            {/* 切换模式 */}
            <div className="mt-4 border-t border-[var(--line)] pt-3 text-center">
              <p className="text-[13px] text-[var(--muted)]">
                {isRegister ? t("login.hasAccount") : t("login.noAccount")}
                <button type="button" onClick={switchMode} className="ml-1 font-semibold text-[var(--primary-text)] hover:text-[var(--primary)]">
                  {isRegister ? t("login.backToLogin") : t("login.createAccount")}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
