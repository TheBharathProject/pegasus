"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import {
  LogOutIcon,
  BellIcon,
  BriefcaseIcon,
  ChatIcon,
  ChevronLeft,
  ChevronRight,
  CloseIcon,
  ContactIcon,
  DashboardIcon,
  FileIcon,
  FolderIcon,
  HelpIcon,
  MenuIcon,
  NotebookIcon,
  SettingsIcon,
  UserPlusIcon
} from "./icons";
import { useAuth, signOut } from "@/lib/auth";
import { useBillingMe } from "@/lib/billing";
import { useUnreadCount } from "@/lib/notifications";

type MarketingFrameProps = {
  children: ReactNode;
  current?: "home" | "blog" | "community" | "privacy" | "terms";
  hideAuthCta?: boolean;
};

type ProductNavKey =
  | "dashboard"
  | "applications"
  | "notes"
  | "profile"
  | "resume"
  | "resumes"
  | "notifications"
  | "settings"
  | "community"
  | "recruiters";

type ProductFrameProps = {
  children: ReactNode;
  active: ProductNavKey;
  title?: string;
  intro?: string;
  kicker?: ReactNode;
  actions?: ReactNode;
  currentPath?: string;
  noPadding?: boolean;
};

const marketingLinks = [
  { href: "/blog", label: "Blog", key: "blog" as const },
  { href: "/community", label: "Community", key: "community" as const }
];

type IconCmp = (props: { width?: number; height?: number; className?: string }) => JSX.Element;

type NavLink = {
  href: string;
  label: string;
  key: ProductNavKey;
  Icon: IconCmp;
};

const productNavGroups: Array<{ label?: string; links: NavLink[] }> = [
  {
    links: [
      { href: "/dashboard", label: "Dashboard", key: "dashboard", Icon: DashboardIcon },
      { href: "/applications", label: "Applications", key: "applications", Icon: BriefcaseIcon },
      { href: "/notes", label: "Notes", key: "notes", Icon: NotebookIcon }
    ]
  },
  {
    label: "You",
    links: [
      { href: "/resume", label: "Resume AI", key: "resume", Icon: FileIcon },
      { href: "/resumes", label: "Vault", key: "resumes", Icon: FolderIcon },
      { href: "/recruiters", label: "Recruiters", key: "recruiters", Icon: ContactIcon },
      { href: "/notifications", label: "Notifications", key: "notifications", Icon: BellIcon },
      { href: "/settings", label: "Settings", key: "settings", Icon: SettingsIcon }
    ]
  },
  {
    label: "Community",
    links: [
      { href: "/community/reviews", label: "Reviews", key: "community", Icon: ChatIcon },
      { href: "/community/experiences", label: "Experiences", key: "community", Icon: BriefcaseIcon },
      { href: "/community/referrals", label: "Referrals", key: "community", Icon: UserPlusIcon },
      { href: "/community/ask", label: "Ask", key: "community", Icon: HelpIcon },
      { href: "/community/recruiters", label: "Recruiters", key: "community", Icon: ContactIcon }
    ]
  }
];

const SIDEBAR_KEY = "nc.sidebar-collapsed";

function readSidebarState(): "collapsed" | "expanded" {
  if (typeof document === "undefined") return "collapsed";
  return (document.documentElement.dataset.sb as "collapsed" | "expanded") || "collapsed";
}

function useSidebarState(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    setCollapsed(readSidebarState() === "collapsed");
    const onChange = () => setCollapsed(readSidebarState() === "collapsed");
    window.addEventListener("nc:sidebar-changed", onChange);
    return () => window.removeEventListener("nc:sidebar-changed", onChange);
  }, []);

  const toggle = () => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    const next = html.dataset.sb === "expanded" ? "collapsed" : "expanded";
    html.dataset.sb = next;
    try {
      window.localStorage.setItem(SIDEBAR_KEY, next === "collapsed" ? "1" : "0");
    } catch {}
    window.dispatchEvent(new Event("nc:sidebar-changed"));
  };

  return [collapsed, toggle];
}

function MarketingAuthCta() {
  const { authed, loading } = useAuth();
  // Render nothing while the hook is determining auth state. Avoids the
  // "Sign in" → "Dashboard" flicker on hydration.
  if (loading) return null;
  if (authed) {
    return (
      <>
        <Link className="primary-button" href="/dashboard">
          Dashboard
        </Link>
        <button
          className="ghost-button"
          type="button"
          onClick={() => {
            void signOut("/");
          }}
        >
          Sign out
        </button>
      </>
    );
  }
  return (
    <Link className="ghost-button" href="/login">
      Sign in
    </Link>
  );
}

export function MarketingFrame({
  children,
  current = "home",
  hideAuthCta = false
}: MarketingFrameProps) {
  return (
    <div className="marketing-frame">
      <header className="topbar shell">
        <Link className="brand" href="/">
          <span className="brand-badge">P</span>
          <span>Pegasus</span>
        </Link>
        <nav className="topnav" aria-label="Pegasus navigation">
          {marketingLinks.map((link) => (
            <Link
              className={current === link.key ? "topnav-link active" : "topnav-link"}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
          {!hideAuthCta ? <MarketingAuthCta /> : null}
        </nav>
      </header>
      {children}
      <footer className="footer shell">
        <div className="footer-copy">
          <p className="footer-kicker">Pegasus</p>
          <p className="footer-title">A calmer system for a messy job search.</p>
          <p className="muted">
            Job tracking, public profiles, community advice, and a browser clipper in one calm
            surface.
          </p>
          <p className="muted small footer-credit">Built by Shubham.</p>
        </div>
        <div className="footer-links">
          <div className="footer-column">
            <p className="footer-label">Explore</p>
            <nav className="footer-nav" aria-label="Explore Pegasus">
              <Link href="/">Home</Link>
              {/* Plain <a> escapes basePath /pegasus and lands on the sypher.in apex. */}
              <a href="/blog">Blog</a>
              <Link href="/community">Community</Link>
            </nav>
          </div>
          <div className="footer-column">
            <p className="footer-label">Trust</p>
            <nav className="footer-nav" aria-label="Pegasus legal">
              <Link href="/privacy-policy">Privacy Policy</Link>
              <a href="/terms">Terms</a>
              <a href="mailto:buildwithshubham.dixit@gmail.com">Contact</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function ProductFrame({
  children,
  active,
  title,
  intro,
  kicker,
  actions,
  currentPath,
  noPadding
}: ProductFrameProps) {
  const [, toggle] = useSidebarState();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const showHeader = Boolean(title || intro || kicker || actions);
  // Polled (~60s) unread count drives the bell-badge dot. The hook itself
  // returns 0 when the user is signed-out, so this is safe to call here
  // even though ProductFrame renders for unauthed routes too (it bounces
  // them client-side; the hook already declines to poll).
  const unreadCount = useUnreadCount();

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  return (
    <div className={drawerOpen ? "product-frame is-drawer-open" : "product-frame"}>
      <header className="mobile-topbar">
        <button
          className="mobile-topbar-menu"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          type="button"
        >
          <MenuIcon width={20} height={20} />
        </button>
        <Link className="mobile-topbar-brand" href="/dashboard" aria-label="Pegasus">
          <span className="brand-badge">P</span>
          <span>Pegasus</span>
        </Link>
        <Link
          className="mobile-topbar-bell"
          href="/notifications"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        >
          <BellIcon width={16} height={16} />
          {unreadCount > 0 ? <span className="nav-icon-dot" aria-hidden="true" /> : null}
        </Link>
      </header>

      <button
        className="mobile-menu-backdrop"
        aria-label="Close menu"
        onClick={() => setDrawerOpen(false)}
        type="button"
        tabIndex={drawerOpen ? 0 : -1}
      />

      <button
        className="collapse-button"
        aria-label="Toggle sidebar"
        onClick={toggle}
        type="button"
      >
        <span className="collapse-when-collapsed" aria-hidden="true">
          <ChevronRight width={12} height={12} />
        </span>
        <span className="collapse-when-expanded" aria-hidden="true">
          <ChevronLeft width={12} height={12} />
        </span>
      </button>
      <aside className="sidebar">
        <button
          className="mobile-drawer-close"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
          type="button"
        >
          <CloseIcon width={16} height={16} />
        </button>
        <Link
          className="brand brand-sidebar"
          href="/dashboard"
          aria-label="Pegasus"
          onClick={() => setDrawerOpen(false)}
        >
          <span className="brand-badge">P</span>
          <span className="brand-text">Pegasus</span>
        </Link>
        <nav className="sidebar-nav">
          {productNavGroups.map((group, index) => (
            <div className="nav-group" key={group.label ?? `root-${index}`}>
              {group.label ? <div className="nav-group-label">{group.label}</div> : null}
              {group.links.map((link) => {
                const Icon = link.Icon;
                return (
                  <Link
                    className={
                      active === link.key && (!currentPath || currentPath === link.href)
                        ? "sidebar-link active"
                        : "sidebar-link"
                    }
                    href={link.href}
                    key={link.href}
                    aria-label={link.label}
                    title={link.label}
                    onClick={() => setDrawerOpen(false)}
                  >
                    <span className="nav-icon" aria-hidden="true">
                      <Icon />
                      {link.key === "notifications" && unreadCount > 0 ? (
                        <span
                          className="nav-icon-dot"
                          aria-label={`${unreadCount} unread`}
                        />
                      ) : null}
                    </span>
                    <span className="nav-label">
                      {link.label}
                      {link.key === "notifications" && unreadCount > 0 ? (
                        <span className="nav-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                      ) : null}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <SidebarBilling />
        <SidebarUser />
      </aside>
      <main className={noPadding ? "product-main is-flush" : "product-main"}>
        {showHeader ? (
          <header className="product-header">
            <div>
              {kicker
                ? typeof kicker === "string"
                  ? <p className="eyebrow">{kicker}</p>
                  : kicker
                : null}
              {title ? <h1>{title}</h1> : null}
              {intro ? <p className="muted">{intro}</p> : null}
            </div>
            {actions ? <div className="header-actions">{actions}</div> : null}
          </header>
        ) : null}
        {children}
      </main>
    </div>
  );
}

// SidebarBilling shows the credits balance + an upgrade nudge for free
// users, just above the user card at the bottom of the sidebar. Reads
// from the shared cache in lib/billing so this widget doesn't add a
// network call on top of whatever the Settings/Upgrade pages already did.
function SidebarBilling() {
  const { authed } = useAuth();
  const { billing } = useBillingMe();
  if (!authed || !billing) return null;
  const isPremium = !!billing.premium && billing.premium.status === "active";
  return (
    <Link
      className="sidebar-billing"
      href={isPremium ? "/upgrade#credits" : "/upgrade"}
      aria-label={isPremium ? "Top up credits" : "Upgrade to Premium"}
      title={isPremium ? "Top up credits" : "Upgrade to Premium"}
    >
      <span className="sidebar-billing-figure">
        {billing.creditsBalance.toLocaleString("en-IN")}
      </span>
      <span className="sidebar-billing-copy">
        <strong>credits</strong>
        <em>{isPremium ? "Top up →" : "Upgrade →"}</em>
      </span>
    </Link>
  );
}

function SidebarUser() {
  const { authed, loading, user } = useAuth();
  if (loading || !authed || !user) {
    return null;
  }
  // Avatar: use the Google profile photo when available, fall back to
  // the user's initials on a hairline-bordered tile when not. The dot
  // placeholder we used previously was a leftover from when the auth
  // payload didn't carry pictureUrl — it does now.
  const initials = user.name
    ? user.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? "")
        .join("")
    : (user.email?.[0]?.toUpperCase() ?? "·");

  // Split into a profile-link (avatar + name/email) and a real
  // sign-out button. The trailing icon was visually misleading before —
  // it implied "go to" but the whole row only ever opened /profile. The
  // spec calls for an explicit aria-labelled Sign out control.
  return (
    <div className="sidebar-user">
      <Link className="sidebar-user-link" href="/profile" aria-label="Open your profile">
        {user.pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="sidebar-user-avatar"
            src={user.pictureUrl}
            alt=""
            referrerPolicy="no-referrer"
            width={32}
            height={32}
          />
        ) : (
          <span className="sidebar-user-avatar sidebar-user-avatar--initials">{initials}</span>
        )}
        <div className="sidebar-user-copy">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>
      </Link>
      <button
        type="button"
        className="signout-icon sidebar-signout-btn"
        aria-label="Sign out"
        title="Sign out"
        onClick={() => {
          void signOut("/");
        }}
      >
        <LogOutIcon width={15} height={15} />
      </button>
    </div>
  );
}

export function CommunityTabs({ current }: { current: string }) {
  const tabs = [
    { href: "/community/reviews", label: "Reviews" },
    { href: "/community/experiences", label: "Experiences" },
    { href: "/community/referrals", label: "Referrals" },
    { href: "/community/ask", label: "Ask" },
    { href: "/community/recruiters", label: "Recruiters" }
  ];

  return (
    <nav className="community-tabs">
      {tabs.map((tab) => (
        <Link
          className={current === tab.href ? "community-tab active" : "community-tab"}
          href={tab.href}
          key={tab.href}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
