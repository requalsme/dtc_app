// Client directory and client file, rebuilt from the design kit's ClientFile.
//
// The kit screen was one hardcoded client with an invented checklist. The real
// value here is that the store already computes the checklist: fileChecklistFor
// walks what a complete file must contain and returns each line as complete,
// expired or missing. That maps straight onto DocumentSlot, which has states
// for exactly those cases — so the file view shows what is genuinely in the
// folder rather than a designed impression of one.
//
// The expired/missing distinction is carried through deliberately. A lapsed
// annual recert is a person to chase; a never-filed one is an onboarding gap.
// Collapsing them into "incomplete" would hide which problem you have.

import React from "react";
import { Icon, Button, Stamp, MonoLabel, Avatar, Tabs, Input, DocumentSlot, RecordRow, Chip, EmptyState } from "../design/index.js";
import { SheetHeader } from "./Chrome.jsx";
import { useStore } from "./useStore.js";
// The single most useful thing on a client's file: allergies, DNR, emergency
// contact and the rest, read out of whatever forms have actually been filed
// rather than duplicated into the client record. Kept exactly as it was — this
// redesign has no business inventing a second source of truth for a DNR.
import { ClientKeyFacts } from "../components/ClientKeyFacts";

const STATUS_STAMP = {
  submitted: ["info", "Submitted"],
  reviewed: ["ok", "Reviewed"],
  needsCorrection: ["warn", "Needs correction"],
};

// The store's checklist vocabulary, in DocumentSlot's terms.
const SLOT_STATE = { complete: "filed", expired: "expired", missing: "missing" };

const fmtDate = (v) => {
  if (!v) return null;
  const d = new Date(v.length === 10 ? v + "T00:00:00" : v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

function ClientRecord({ client, onBack }) {
  const Store = useStore();
  const [tab, setTab] = React.useState("summary");

  const submissions = Store.submissionsForSubject("client", client.id);
  const checklist = Store.fileChecklistFor("client", client.id, null);
  const documents = Store.documentsForSubject("client", client.id);

  // Only facts the record actually carries — an empty "DOB —" line tells the
  // reader nothing except that the app has a field for it.
  const facts = [
    client.city && { icon: "home", text: client.city },
    client.phone && { icon: "phone", text: client.phone },
    client.dob && { icon: "clock", text: "DOB " + (fmtDate(client.dob) || client.dob) },
    client.physician && { icon: "activity", text: client.physician },
    client.payerType && { icon: "shield", text: client.payerType },
  ].filter(Boolean);

  const lead = [
    client.status ? client.status[0].toUpperCase() + client.status.slice(1) : null,
    client.address || null,
    client.county ? client.county + " County" : null,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <SheetHeader
        eyebrow={"Clients / " + client.name}
        title={client.name}
        lead={lead || "No contact details recorded yet."}
        actions={<Button variant="outline" iconLeft={<Icon name="arrowLeft" size={16} />} onClick={onBack}>All clients</Button>}
      />

      {facts.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
          {facts.map((f) => <Chip key={f.text} icon={<Icon name={f.icon} size={14} />}>{f.text}</Chip>)}
        </div>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "summary", label: "Summary" },
          { value: "forms", label: "Forms", count: submissions.length },
          { value: "documents", label: "Documents", count: documents.length },
        ]}
        style={{ marginBottom: 32 }}
      />

      <div className="split" style={{ alignItems: "start" }}>
        <section>
          <MonoLabel rule count={submissions.length} style={{ marginBottom: 14 }}>
            {tab === "documents" ? "Uploaded documents" : "Forms on file"}
          </MonoLabel>

          {tab === "documents" ? (
            documents.length === 0 ? (
              <EmptyState
                title="Nothing uploaded yet"
                description={"Scans and photos filed against " + client.name + " will appear here."}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {documents.map((d) => (
                  <RecordRow
                    key={d.id}
                    icon={<Icon name="file" size={17} />}
                    title={d.fileName}
                    subtitle={d.uploadedBy || "—"}
                    meta={fmtDate(d.documentDate || d.uploadedAt) || ""}
                    onClick={d.url ? () => window.open(d.url, "_blank", "noopener") : undefined}
                  />
                ))}
              </div>
            )
          ) : submissions.length === 0 ? (
            <EmptyState
              title="No forms filed yet"
              description={"Anything completed about " + client.name + " will be listed here."}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {submissions.map((s) => {
                const stamp = STATUS_STAMP[s.status] || ["info", s.status || "—"];
                return (
                  <RecordRow
                    key={s.id}
                    icon={<Icon name="fileText" size={17} />}
                    title={s.templateName || s.schemaKey}
                    subtitle={s.caregiverName || "—"}
                    meta={fmtDate(s.submittedAt) || ""}
                    stamp={<Stamp tone={stamp[0]}>{stamp[1]}</Stamp>}
                    accentEdge={s.status === "submitted"}
                    onClick={s.pdfUrl ? () => window.open(s.pdfUrl, "_blank", "noopener") : undefined}
                  />
                );
              })}
            </div>
          )}
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <section>
            <MonoLabel rule style={{ marginBottom: 14 }}>Key facts</MonoLabel>
            <ClientKeyFacts clientId={client.id} />
          </section>

          <section>
            <MonoLabel rule count={checklist.counts.required} style={{ marginBottom: 6 }}>File checklist</MonoLabel>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 14px" }}>
              {checklist.counts.complete + " of " + checklist.counts.required + " required"}
              {checklist.counts.expired ? " · " + checklist.counts.expired + " expired" : ""}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {checklist.rows.map((row, i) => (
                <DocumentSlot
                  key={row.id}
                  index={i + 1}
                  name={row.label || row.id}
                  state={SLOT_STATE[row.status] || "missing"}
                  meta={row.satisfiedAt ? fmtDate(row.satisfiedAt) : undefined}
                />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export function ClientsScreen() {
  const Store = useStore();
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(null);

  const all = Store.clients;
  const clients = all
    .filter((c) => !search.trim() || String(c.name || "").toLowerCase().includes(search.trim().toLowerCase()))
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  // Re-read from the store rather than holding the row that was clicked, so an
  // edit elsewhere is reflected without having to close and reopen the file.
  const openClient = open ? all.find((c) => c.id === open) : null;
  if (open && openClient) return <ClientRecord client={openClient} onBack={() => setOpen(null)} />;

  return (
    <>
      <SheetHeader
        eyebrow="Office manager / Clients"
        title="Clients"
        lead="Everyone currently on the roster. Open a file to see every form and document held about that person."
      />

      <div style={{ display: "flex", gap: 12, margin: "0 0 26px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ width: 320 }}>
          <Input
            placeholder="Search clients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            iconLeft={<Icon name="search" size={17} />}
          />
        </div>
        <MonoLabel count={clients.length}>{clients.length === all.length ? "On the roster" : "Matching"}</MonoLabel>
      </div>

      {clients.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? "No clients yet" : "Nobody matches that search"}
          description={all.length === 0 ? "Clients imported or added will appear here." : "Try part of a surname."}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
          {clients.map((c) => (
            <RecordRow
              key={c.id}
              icon={<Avatar name={c.name} size={30} />}
              title={c.name}
              subtitle={[c.city, c.phone].filter(Boolean).join(" · ") || "No contact details"}
              onClick={() => setOpen(c.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
