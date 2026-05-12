"use client";

import { useEffect, useState } from "react";
import { ProductFrame } from "@/components/frames";
import { ModalShell } from "@/components/ui";
import { ContactIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { api, type ApiRecruiter } from "@/lib/api-client";
import { isAuthed } from "@/lib/auth";
import { goTo } from "@/lib/paths";

const EMPTY_DRAFT = {
  name: "",
  email: "",
  company: "",
  linkedinUrl: "",
  notes: ""
};

export default function RecruitersPage() {
  const [items, setItems] = useState<ApiRecruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !isAuthed()) {
      goTo("/login");
      return;
    }
    void refresh();
  }, []);

  const refresh = async () => {
    try {
      setLoading(true);
      const data = await api.get<ApiRecruiter[]>("/job-tracker/recruiters");
      setItems(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = search.trim()
    ? items.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.email.toLowerCase().includes(search.toLowerCase()) ||
          (r.company ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : items;

  const openNew = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (r: ApiRecruiter) => {
    setEditingId(r.id);
    setDraft({
      name: r.name,
      email: r.email,
      company: r.company ?? "",
      linkedinUrl: r.linkedinUrl ?? "",
      notes: r.notes ?? ""
    });
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!draft.email.trim()) {
      setFormError("Email is required.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const body = {
        name: draft.name.trim(),
        email: draft.email.trim(),
        company: draft.company.trim() || undefined,
        linkedinUrl: draft.linkedinUrl.trim() || undefined,
        notes: draft.notes.trim() || undefined
      };
      if (editingId) {
        await api.patch(`/job-tracker/recruiters/${editingId}`, body);
      } else {
        await api.post("/job-tracker/recruiters", body);
      }
      closeModal();
      void refresh();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (r: ApiRecruiter) => {
    if (!confirm(`Delete ${r.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/job-tracker/recruiters/${r.id}`);
      void refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <ProductFrame
      active="recruiters"
      title="Recruiters"
      intro="Your private recruiter contacts — separate from the community directory."
      actions={
        !loading && items.length > 0 ? (
          <button className="primary-button" type="button" onClick={openNew}>
            <PlusIcon width={14} height={14} /> Add recruiter
          </button>
        ) : undefined
      }
    >
      <section>
        <div className="community-search">
          <span className="community-search-icon">
            <SearchIcon width={14} height={14} />
          </span>
          <input
            type="text"
            placeholder="Search by name, email or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error ? (
          <section className="notice" style={{ marginTop: 12 }}>
            <em>{error}</em>
          </section>
        ) : null}

        {loading ? (
          <p className="muted small" style={{ marginTop: 24 }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="community-empty">
            <span className="community-empty-icon">
              <ContactIcon width={22} height={22} />
            </span>
            <h3>{search ? "No results" : "No recruiters yet"}</h3>
            <p>
              {search
                ? "No recruiters match your search."
                : "Save the recruiters you've connected with to keep track of your network."}
            </p>
            {!search ? (
              <button className="primary-button" type="button" onClick={openNew}>
                <PlusIcon width={14} height={14} /> Add your first recruiter
              </button>
            ) : null}
          </div>
        ) : (
          <div className="recruiter-table">
            <table>
              <thead>
                <tr>
                  <th>Recruiter</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>LinkedIn</th>
                  <th>Notes</th>
                  <th style={{ width: 72 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.company || "—"}</td>
                    <td>
                      <a href={`mailto:${r.email}`} style={{ color: "var(--accent)" }}>
                        {r.email}
                      </a>
                    </td>
                    <td>
                      {r.linkedinUrl ? (
                        <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                          View
                        </a>
                      ) : "—"}
                    </td>
                    <td className="num">{r.notes || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={`Edit ${r.name}`}
                          title="Edit"
                          onClick={() => openEdit(r)}
                        >
                          <PencilIcon width={14} height={14} />
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={`Delete ${r.name}`}
                          title="Delete"
                          onClick={() => void handleDelete(r)}
                        >
                          <TrashIcon width={14} height={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ModalShell
        open={showModal}
        onClose={closeModal}
        title={editingId ? "Edit recruiter" : "Add recruiter"}
        titleId="recruiter-modal-title"
      >
        <div className="form-grid">
          <div className="field">
            <label>Name *</label>
            <input
              autoFocus
              placeholder="Jane Doe"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Email *</label>
            <input
              type="email"
              placeholder="jane@company.com"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Company</label>
            <input
              placeholder="Acme Corp"
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
            />
          </div>
          <div className="field">
            <label>LinkedIn URL</label>
            <input
              type="url"
              placeholder="https://linkedin.com/in/jane"
              value={draft.linkedinUrl}
              onChange={(e) => setDraft({ ...draft, linkedinUrl: e.target.value })}
            />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Notes</label>
            <textarea
              className="feedback-box"
              placeholder="Context about this recruiter…"
              rows={3}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
          {formError ? (
            <p className="muted small" style={{ color: "var(--danger)", gridColumn: "1 / -1" }}>
              {formError}
            </p>
          ) : null}
        </div>
        <div className="ai-modal-foot">
          <button className="ghost-button" type="button" onClick={closeModal}>
            Cancel
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={busy}
            onClick={() => void handleSave()}
          >
            {busy ? "Saving…" : editingId ? "Save changes" : "Add recruiter"}
          </button>
        </div>
      </ModalShell>
    </ProductFrame>
  );
}
