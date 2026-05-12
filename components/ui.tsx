"use client";

import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FocusScope } from "@radix-ui/react-focus-scope";

export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export function SectionHeading({
  label,
  title,
  body
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{label}</p>
      <h2>{title}</h2>
      <p className="section-copy">{body}</p>
    </div>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return <section className="panel">{children}</section>;
}

export function MetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <h3 style={{ fontFamily: 'var(--font-mono)' }}>{value}</h3>
      <p className="muted small">{detail}</p>
    </div>
  );
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: string }) {
  return <span className={`pill tone-${tone}`}>{children}</span>;
}

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId?: string;
  children: ReactNode;
  width?: string;
}

export function ModalShell({
  open,
  onClose,
  title,
  titleId = "modal-title",
  children,
  width = "480px"
}: ModalShellProps) {
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      document.body.classList.add("overflow-hidden");
      const main = document.querySelector("main");
      if (main) (main as HTMLElement).setAttribute("inert", "");
    } else {
      document.body.classList.remove("overflow-hidden");
      const main = document.querySelector("main");
      if (main) (main as HTMLElement).removeAttribute("inert");
      requestAnimationFrame(() => {
        if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
      });
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
      const main = document.querySelector("main");
      if (main) (main as HTMLElement).removeAttribute("inert");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <FocusScope trapped loop>
        <div
          className="modal-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          style={{ width, maxWidth: "calc(100vw - 2rem)" }}
        >
          <div className="modal-head">
            <h2 id={titleId}>{title}</h2>
            <button
              className="modal-close"
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          {children}
        </div>
      </FocusScope>
    </div>,
    document.body
  );
}
