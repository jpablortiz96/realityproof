/**
 * AppShell, Sidebar, Topbar and ResponsiveNavigation.
 * Navigation is contextual to the active role. The role selector is a DEMO-only
 * affordance (it switches which demo bearer token the UI uses); real server
 * authorization is still enforced per request by the API.
 */
import React from "react";
import { FlaskConical, Globe, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Lang } from "../i18n.js";
import { cx } from "./ui.js";

export type DemoRole = "REQUESTER" | "VERIFIER" | "OPERATOR" | "JUDGE";

export interface NavItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  badge?: number;
}

export interface IntegrationStatus {
  paypalReady: boolean;
  geminiReady: boolean;
  geminiModel?: string;
}

function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0 shrink-0">
      <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-lime flex items-center justify-center shrink-0 shadow-[0_6px_20px_-8px_rgba(198,255,98,0.7)]">
        <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-lime-ink" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] sm:text-[17px] font-semibold tracking-tight text-ink leading-none">
          RealityProof
        </span>
        {!compact && <span className="block text-xs text-ink-3 mt-1">Proof before payment</span>}
      </span>
    </div>
  );
}

function RoleSwitcher({
  role,
  onChange,
  lang,
  roleLabels,
  id,
  compact,
}: {
  role: DemoRole;
  onChange: (r: DemoRole) => void;
  lang: Lang;
  roleLabels: Record<DemoRole, string>;
  id: string;
  compact?: boolean;
}) {
  return (
    <div className={cx(compact ? "" : "rounded-xl border border-prov-demo/35 bg-prov-demo/[0.06] p-3")}>
      {!compact && (
        <div className="flex items-center justify-between mb-2">
          <label htmlFor={id} className="text-xs font-medium text-ink-2">
            {lang === "es" ? "Ver como" : "View as"}
          </label>
          <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-prov-demo">
            <FlaskConical className="w-3 h-3" aria-hidden="true" />
            DEMO
          </span>
        </div>
      )}
      {compact && (
        <label htmlFor={id} className="sr-only">
          {lang === "es" ? "Rol de demostración" : "Demo role"}
        </label>
      )}
      <select
        id={id}
        value={role}
        onChange={(e) => onChange(e.target.value as DemoRole)}
        className={cx(
          "w-full bg-canvas border border-prov-demo/45 rounded-lg text-ink font-medium cursor-pointer",
          compact ? "text-xs px-2 py-1.5 min-h-[38px] max-w-[148px] sm:max-w-[180px]" : "text-sm px-3 py-2 min-h-[40px]"
        )}
      >
        {(Object.keys(roleLabels) as DemoRole[]).map((r) => (
          <option key={r} value={r}>
            {compact ? `DEMO · ${roleLabels[r]}` : roleLabels[r]}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2 text-xs text-ink-3">
      <span className={cx("w-2 h-2 rounded-full", ok ? "bg-ok" : "bg-warn")} aria-hidden="true" />
      {label}
      <span className="sr-only">{ok ? "ready" : "not configured"}</span>
    </span>
  );
}

export function AppShell({
  role,
  onRoleChange,
  roleLabels,
  nav,
  activeNav,
  onNavigate,
  lang,
  onToggleLang,
  integrations,
  topbarActions,
  skipLabel,
  navLabel,
  children,
}: {
  role: DemoRole;
  onRoleChange: (r: DemoRole) => void;
  roleLabels: Record<DemoRole, string>;
  nav: NavItem[];
  activeNav: string;
  onNavigate: (id: string) => void;
  lang: Lang;
  onToggleLang: () => void;
  integrations: IntegrationStatus | null;
  topbarActions?: React.ReactNode;
  skipLabel: string;
  navLabel: string;
  children: React.ReactNode;
}) {
  const langBtn = (
    <button
      type="button"
      data-testid="lang-toggle"
      onClick={onToggleLang}
      className="inline-flex items-center gap-1.5 min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3 rounded-lg text-xs sm:text-[13px] font-medium text-ink-2 hover:text-ink hover:bg-surface-2 border border-line"
      aria-label={lang === "en" ? "ES — Cambiar a español" : "EN — Switch to English"}
    >
      <Globe className="w-4 h-4" aria-hidden="true" />
      {lang === "en" ? "ES" : "EN"}
    </button>
  );

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-lime focus:text-lime-ink focus:font-semibold"
      >
        {skipLabel}
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[264px] flex-col bg-canvas-2 border-r border-line z-30 no-print">
        <div className="px-5 pt-6 pb-5">
          <Logo />
        </div>
        <div className="px-4">
          <RoleSwitcher role={role} onChange={onRoleChange} lang={lang} roleLabels={roleLabels} id="role-switcher-desktop" />
        </div>
        <nav aria-label={navLabel} className="flex-1 overflow-y-auto px-3 py-5">
          <ul className="space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeNav;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    data-testid={`nav-item-${item.id}`}
                    onClick={() => onNavigate(item.id)}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "w-full flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors relative",
                      active ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink hover:bg-surface/70"
                    )}
                  >
                    {active && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r bg-lime" aria-hidden="true" />}
                    <Icon className={cx("w-[18px] h-[18px] shrink-0", active ? "text-lime" : "text-ink-3")} aria-hidden="true" />
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    {item.badge ? (
                      <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-warn/15 text-warn text-xs font-semibold flex items-center justify-center tabular">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="px-5 py-4 border-t border-line space-y-3">
          <div className="space-y-1.5">
            <StatusDot ok={Boolean(integrations?.paypalReady)} label="PayPal Sandbox" />
            <StatusDot ok={Boolean(integrations?.geminiReady)} label={`Gemini${integrations?.geminiModel ? ` · ${integrations.geminiModel}` : ""}`} />
          </div>
          {langBtn}
        </div>
      </aside>

      <div className="lg:pl-[264px] flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-canvas/85 backdrop-blur-md border-b border-line no-print">
          <div className="h-14 lg:h-16 max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-10 flex items-center justify-between gap-3">
            <div className="lg:hidden min-w-0">
              <Logo compact />
            </div>
            <div className="hidden lg:flex items-center gap-2 text-[13px] text-ink-3 min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-prov-real/35 bg-prov-real/10 text-prov-real px-2 py-0.5 text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                {lang === "es" ? "Entorno PayPal Sandbox · dinero de prueba" : "PayPal Sandbox environment · test money"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="lg:hidden">
                <RoleSwitcher role={role} onChange={onRoleChange} lang={lang} roleLabels={roleLabels} id="role-switcher-mobile" compact />
              </div>
              {topbarActions}
              <div className="lg:hidden">{langBtn}</div>
            </div>
          </div>
        </header>

        <main id="main-workspace" tabIndex={-1} className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 lg:pt-10 pb-28 lg:pb-16 outline-none">
          {children}
        </main>
      </div>

      {/* Mobile / tablet bottom navigation */}
      <ResponsiveNavigation items={nav} active={activeNav} onNavigate={onNavigate} label={navLabel} />
    </div>
  );
}

export function ResponsiveNavigation({
  items,
  active,
  onNavigate,
  label,
}: {
  items: NavItem[];
  active: string;
  onNavigate: (id: string) => void;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-canvas-2/95 backdrop-blur-md border-t border-line no-print"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex max-w-xl mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <li key={item.id} className="flex-1 min-w-0">
              <button
                type="button"
                data-testid={`nav-item-mobile-${item.id}`}
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={cx(
                  "w-full h-16 flex flex-col items-center justify-center gap-1 px-1 relative transition-colors",
                  isActive ? "text-ink" : "text-ink-3 hover:text-ink-2"
                )}
              >
                {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b bg-lime" aria-hidden="true" />}
                <span className="relative">
                  <Icon className={cx("w-5 h-5", isActive && "text-lime")} aria-hidden="true" />
                  {item.badge ? (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-warn text-canvas text-xs font-bold flex items-center justify-center">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs font-medium truncate max-w-full">{item.shortLabel ?? item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

