"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/ui";
import { api } from "@/lib/api-client";

// Shared reminder modal — see ADR-0007 D6. Two consumers today:
//   - app/applications/page.tsx  (mode="create", POST /applications/{id}/reminders)
//   - components/activity/*      (mode="edit",   PATCH /reminders/{id} + delete)
// Form state lives inside this component so callers don't have to mirror it.

type ReminderModalCommon = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

type ReminderModalCreate = ReminderModalCommon & {
  mode: "create";
  applicationId: string;
  applicationLabel?: string;
};

type ReminderModalEdit = ReminderModalCommon & {
  mode: "edit";
  reminderId: string;
  initialTriggersAt: string;
  initialNote?: string;
  applicationLabel?: string;
  onDeleted?: () => void;
};

export type ReminderModalProps = ReminderModalCreate | ReminderModalEdit;

const QUICK_PICKS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "In 1 week", days: 7 },
  { label: "In 2 weeks", days: 14 }
];

const toDatetimeLocal = (iso: string): string => {
  // Strip timezone for <input type="datetime-local">. Returns the local-clock
  // equivalent of the UTC instant, formatted YYYY-MM-DDTHH:MM (the input
  // element's accepted shape).
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ReminderModal(props: ReminderModalProps) {
  const { open, onClose, onSaved } = props;
  const [triggersAt, setTriggersAt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed local state every time the modal opens so re-using the same
  // component for a different row doesn't carry stale form values.
  useEffect(() => {
    if (!open) return;
    if (props.mode === "edit") {
      setTriggersAt(toDatetimeLocal(props.initialTriggersAt));
      setNote(props.initialNote ?? "");
    } else {
      setTriggersAt("");
      setNote("");
    }
    setError(null);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, props.mode === "edit" ? props.reminderId : props.applicationId]);

  const title = (() => {
    const label = props.applicationLabel ? ` · ${props.applicationLabel}` : "";
    return props.mode === "create" ? `Set reminder${label}` : `Edit reminder${label}`;
  })();

  const handleSave = async () => {
    if (!triggersAt) return;
    setBusy(true);
    setError(null);
    try {
      const ts = new Date(triggersAt).toISOString();
      if (props.mode === "create") {
        await api.post(`/job-tracker/applications/${props.applicationId}/reminders`, {
          triggersAt: ts,
          note: note || undefined
        });
      } else {
        await api.patch(`/job-tracker/reminders/${props.reminderId}`, {
          triggersAt: ts,
          note: note || null
        });
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (props.mode !== "edit") return;
    if (!confirm("Delete this reminder?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/job-tracker/reminders/${props.reminderId}`);
      props.onDeleted?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title={title} titleId="reminder-modal-title">
      <div className="form-grid">
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Quick pick</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {QUICK_PICKS.map(({ label, days }) => {
              const ts = new Date(Date.now() + days * 86_400_000);
              ts.setHours(9, 0, 0, 0);
              const pad = (n: number) => String(n).padStart(2, "0");
              const iso = `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}T${pad(ts.getHours())}:${pad(ts.getMinutes())}`;
              return (
                <button
                  key={label}
                  type="button"
                  className={triggersAt === iso ? "primary-button" : "ghost-button"}
                  style={{ fontSize: 13 }}
                  onClick={() => setTriggersAt(iso)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Custom date &amp; time</label>
          <input
            type="datetime-local"
            value={triggersAt}
            onChange={(e) => setTriggersAt(e.target.value)}
          />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Note (optional)</label>
          <input
            type="text"
            placeholder="e.g. Follow up on interview feedback"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error ? (
          <p className="muted small" style={{ color: "var(--danger)", gridColumn: "1 / -1" }}>
            {error}
          </p>
        ) : null}
      </div>
      <div className="ai-modal-foot">
        {props.mode === "edit" ? (
          <button
            className="ghost-button"
            type="button"
            style={{ color: "var(--danger)", marginRight: "auto" }}
            disabled={busy}
            onClick={() => void handleDelete()}
          >
            Delete
          </button>
        ) : null}
        <button className="ghost-button" type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={!triggersAt || busy}
          onClick={() => void handleSave()}
        >
          {busy ? "Saving…" : props.mode === "create" ? "Set reminder" : "Save changes"}
        </button>
      </div>
    </ModalShell>
  );
}
