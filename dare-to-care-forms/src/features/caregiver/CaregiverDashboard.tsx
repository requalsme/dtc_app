import { useEffect, useState, useCallback } from "react";
// @ts-ignore
import { Icon } from "../../components/fields";
// @ts-ignore
import { DTCStore as Store } from "../../components/store";
// @ts-ignore
import { DTC as D } from "../../components/schemas";
import { FormWizard, RecordViewer, getSchema } from "../../components/forms/FormWizard";
import { fmtDate, todayLong } from "../../utils/format";

// ── Helpers ────────────────────────────────────────────────────────────────

function isLate(dueDateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr); due.setHours(0, 0, 0, 0);
  return due < today;
}

function isDueToday(dueDateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr); due.setHours(0, 0, 0, 0);
  return due.getTime() === today.getTime();
}

function priorityColor(p: string) {
  if (p === "urgent") return "var(--red)";
  if (p === "low") return "var(--ink-3)";
  return "var(--accent)";
}

// ── Sub-components ─────────────────────────────────────────────────────────


function FormCard({ schemaKey, onStart }: { schemaKey: string; onStart: () => void }) {
  const schema = getSchema(schemaKey);
  if (!schema) return null;
  const policy = schema.category === "Policy";
  return (
    <button className={`card formcard${policy ? " policy" : ""}`} onClick={onStart} style={{ marginTop: 10 }}>
      <span className="ic"><Icon n={schema.icon} s={20} /></span>
      <span className="meta">
        <span className="nm">{schema.name}</span>
        <span className="sub">
          <span className="chip">{schema.category}</span>
          <span> · {schema.estMin} min · {schema.sections.length} steps</span>
        </span>
      </span>
      <Icon n="chevron" s={18} style={{ color: "var(--ink-4)" }} />
    </button>
  );
}

// ── Today Tab ──────────────────────────────────────────────────────────────

function TodayTab({ tasks, onStartTask, submissions }: any) {
  const currentUser = Store.currentUser;
  const clients = Store.clients; // full list for lookups by id
  const activeClients = Store.activeClients;

  // Filter to pending/late tasks for this caregiver's day
  const dueTasks = tasks.filter((t: any) =>
    (t.status === "pending" || t.status === "in_progress") &&
    (isDueToday(t.dueDate) || isLate(t.dueDate))
  );

  const corrections = submissions.filter((s: any) => s.status === "needsCorrection");

  const totalDue = dueTasks.length + corrections.length;

  return (
    <div className="view">
      <div className="appbar">
        <div className="greet">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}</div>
        <div className="title-row">
          <h2>{currentUser ? currentUser.name.split(" ")[0] : "Caregiver"}</h2>
          <div className="avatar">{currentUser ? currentUser.initials : "CG"}</div>
        </div>
        <div className="datestrip"><span className="dot" />{todayLong}</div>
      </div>

      <div className="pad" style={{ paddingTop: 0 }}>
        <div className="statrow">
          <div className="statbox">
            <div className="n" style={{ color: totalDue > 0 ? "var(--red)" : "var(--accent)" }}>{totalDue}</div>
            <div className="l">Due today</div>
          </div>
          <div className="statbox">
            <div className="n">{activeClients.length}</div>
            <div className="l">My clients</div>
          </div>
          <div className="statbox">
            <div className="n">{submissions.length}</div>
            <div className="l">Filed</div>
          </div>
        </div>

        {/* Corrections needing attention */}
        {corrections.length > 0 && (
          <>
            <div className="section-label" style={{ color: "var(--amber)" }}>
              <Icon n="alert" s={14} style={{ marginRight: 5, verticalAlign: "-2px" }} />
              Corrections needed
            </div>
            <div className="card" style={{ padding: "4px 16px", borderLeft: "3px solid var(--amber)" }}>
              {corrections.map((sub: any) => {
                const schema = getSchema(sub.schemaKey);
                return (
                  <button className="task" key={sub.id} onClick={() => onStartTask("resubmit", sub)}>
                    <span className="ci" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>
                      <Icon n="alert" s={16} />
                    </span>
                    <span className="tinfo">
                      <span className="who">{sub.clientName || "Employee form"}</span>
                      <span className="what">{schema?.name || sub.schemaKey}</span>
                      {sub.correctionNote && (
                        <span className="what" style={{ color: "var(--amber)", fontSize: 11 }}>
                          "{sub.correctionNote}"
                        </span>
                      )}
                    </span>
                    <span className="due">Fix & resubmit</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Real due tasks */}
        {dueTasks.length > 0 && (
          <>
            <div className="section-label">Due today</div>
            <div className="card" style={{ padding: "4px 16px" }}>
              {dueTasks.map((task: any) => {
                const late = isLate(task.dueDate);
                const client = task.clientId ? clients.find((c: any) => c.id === task.clientId) : null;
                return (
                  <button className="task" key={task.id} onClick={() => onStartTask("task", task)}>
                    <span className="ci">
                      {client ? client.initials : <Icon n="shield" s={16} />}
                    </span>
                    <span className="tinfo">
                      <span className="who">{task.clientName || "All caregivers"}</span>
                      <span className="what">{task.title}</span>
                      {task.recurrence && (
                        <span className="chip" style={{ marginTop: 2, fontSize: 10 }}>{task.recurrence}</span>
                      )}
                    </span>
                    <span className={`due${late ? "" : " ok"}`} style={{ color: priorityColor(task.priority) }}>
                      {late ? "Late" : "Today"}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {totalDue === 0 && (
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <strong>All caught up!</strong>
            <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>No tasks due today.</p>
          </div>
        )}

        {/* Upcoming tasks */}
        {(() => {
          const upcoming = tasks.filter((t: any) =>
            (t.status === "pending") && !isDueToday(t.dueDate) && !isLate(t.dueDate)
          );
          if (upcoming.length === 0) return null;
          return (
            <>
              <div className="section-label">Coming up</div>
              <div className="card" style={{ padding: "4px 16px" }}>
                {upcoming.slice(0, 4).map((task: any) => (
                  <button className="task" key={task.id} onClick={() => onStartTask("task", task)}>
                    <span className="ci" style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}>
                      <Icon n="clock" s={16} />
                    </span>
                    <span className="tinfo">
                      <span className="who">{task.clientName || "All caregivers"}</span>
                      <span className="what">{task.title}</span>
                    </span>
                    <span className="due ok">{fmtDate(task.dueDate)}</span>
                  </button>
                ))}
              </div>
            </>
          );
        })()}

        <div className="section-label">Start a form</div>
        {Store.publishedKeysFor("caregiver").length === 0 ? (
          <div className="card" style={{ padding: 16, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
            No forms published yet.
          </div>
        ) : (
          Store.publishedKeysFor("caregiver").map((key: string) => (
            <FormCard key={key} schemaKey={key} onStart={() => onStartTask("schema", { schemaKey: key })} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Forms Tab ──────────────────────────────────────────────────────────────

function FormsTab({ onStart }: any) {
  const published = Store.publishedKeysFor("caregiver");
  return (
    <div className="view">
      <div className="appbar">
        <div className="title-row"><h2>Forms</h2></div>
        <div className="datestrip">
          <span className="dot" />{published.length} published templates available
        </div>
      </div>
      <div className="pad" style={{ paddingTop: 4 }}>
        {published.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <p style={{ color: "var(--ink-3)", fontSize: 13 }}>No forms have been published for you yet.</p>
          </div>
        ) : (
          published.map((key: string) => (
            <FormCard key={key} schemaKey={key} onStart={() => onStart(key, null)} />
          ))
        )}
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", textAlign: "center", marginTop: 22, lineHeight: 1.5 }}>
          Published by Admin from imported PDFs.<br />
          Caregivers only see templates meant for their role.
        </p>
      </div>
    </div>
  );
}

// ── Records Tab ────────────────────────────────────────────────────────────

function RecordsTab({ submissions, onOpen }: any) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const queued = Store.getQueuedSubmissions ? Store.getQueuedSubmissions() : [];

  const filtered = submissions.filter((sub: any) => {
    if (filter === "corrections" && sub.status !== "needsCorrection") return false;
    if (filter === "reviewed" && sub.status !== "reviewed") return false;
    if (filter === "filed" && sub.status === "needsCorrection") return false;
    if (search) {
      const q = search.toLowerCase();
      const schema = getSchema(sub.schemaKey);
      const name = schema?.name || sub.schemaKey;
      if (!name.toLowerCase().includes(q) && !sub.clientName?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalCount = queued.length + submissions.length;

  return (
    <div className="view">
      <div className="appbar">
        <div className="title-row"><h2>My records</h2></div>
        <div className="datestrip"><span className="dot" />{totalCount} total</div>
      </div>
      <div className="pad" style={{ paddingTop: 4 }}>
        {/* Search + filter bar */}
        {totalCount > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Icon n="search" s={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)", pointerEvents: "none" }} />
              <input
                className="rec-search"
                placeholder="Search forms or clients…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 32 }}
              />
            </div>
            <select className="rec-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="corrections">Corrections</option>
              <option value="reviewed">Reviewed</option>
              <option value="filed">Filed</option>
            </select>
          </div>
        )}

        {/* Offline queued items */}
        {queued.length > 0 && (
          <>
            <div className="section-label" style={{ color: "var(--warn)" }}>
              <Icon n="wifi" s={13} style={{ marginRight: 5, verticalAlign: "-1px" }} />
              Pending upload ({queued.length})
            </div>
            <div className="card" style={{ padding: "4px 16px", borderLeft: "3px solid var(--warn)", marginBottom: 8 }}>
              {queued.map((item: any) => {
                const schema = getSchema(item.schemaKey);
                return (
                  <div className="subrow" key={item.id} style={{ opacity: 0.82 }}>
                    <span className="si" style={{ color: "var(--warn)" }}>
                      <Icon n={schema?.icon || "file"} s={18} />
                    </span>
                    <span className="sinfo">
                      <span className="nm">{schema?.name || item.schemaKey}</span>
                      <span className="meta">
                        {item.clientName ? `${item.clientName} · ` : ""}
                        Queued {fmtDate(item.queuedAt?.slice(0, 10))}
                      </span>
                    </span>
                    <span className="stat" style={{ color: "var(--warn)", background: "rgba(215,146,59,0.1)" }}>Pending</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {submissions.length === 0 && queued.length === 0 ? (
          <div className="empty">
            <div className="ei"><Icon n="inbox" s={24} /></div>
            <h4>No records yet</h4>
            <p>Forms you complete and submit will appear here, each with its signed PDF.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
            No records match your search.
          </div>
        ) : (
          <div className="card" style={{ padding: "4px 16px" }}>
            {filtered.map((sub: any) => {
              const schema = getSchema(sub.schemaKey);
              const needsCorrection = sub.status === "needsCorrection";
              return (
                <button className="subrow" key={sub.id} onClick={() => onOpen(sub)}>
                  <span className="si" style={{ color: needsCorrection ? "var(--amber)" : undefined }}>
                    <Icon n={schema ? schema.icon : "file"} s={18} />
                  </span>
                  <span className="sinfo">
                    <span className="nm">{schema ? schema.name : sub.schemaKey}</span>
                    <span className="meta">
                      {sub.clientName ? `${sub.clientName} · ` : ""}
                      {sub.submittedAt ? fmtDate(sub.submittedAt.slice(0, 10)) : "—"}
                    </span>
                    {needsCorrection && sub.correctionNote && (
                      <span className="meta" style={{ color: "var(--amber)", fontSize: 11 }}>
                        "{sub.correctionNote}"
                      </span>
                    )}
                  </span>
                  <span className={`stat${needsCorrection ? " warn" : sub.status === "reviewed" ? " ok" : ""}`}>
                    {needsCorrection ? "Correction" : sub.status === "reviewed" ? "Reviewed" : "Filed"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Clients Tab ────────────────────────────────────────────────────────────

function ClientsTab() {
  return (
    <div className="view">
      <div className="appbar">
        <div className="title-row"><h2>My clients</h2></div>
        <div className="datestrip"><span className="dot" />{Store.activeClients.length} active clients</div>
      </div>
      <div className="pad" style={{ paddingTop: 4 }}>
        {Store.activeClients.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <p style={{ color: "var(--ink-3)", fontSize: 13 }}>No clients have been assigned to you yet.</p>
          </div>
        ) : (
          Store.activeClients.map((client: any) => (
            <div className="card" key={client.id} style={{ marginTop: 10 }}>
              <div className="clientcard">
                <span className="ci">{client.initials}</span>
                <span className="cinfo">
                  <span className="nm">{client.name}</span>
                  <span className="meta">DOB {fmtDate(client.dob)} · MRN {client.mrn}</span>
                  <span className="meta">{client.physician} · {client.phone}</span>
                  {client.allergies && (
                    <span className="meta" style={{ color: "var(--amber)" }}>
                      ⚠ Allergies: {client.allergies}
                    </span>
                  )}
                  {client.notes && (
                    <span className="meta" style={{ color: "var(--ink-3)", fontSize: 11 }}>{client.notes}</span>
                  )}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Done Screen ────────────────────────────────────────────────────────────

function DoneScreen({ schema, client, onClose, onViewRecords }: any) {
  return (
    <div className="done">
      <div className="badge-ok"><Icon n="check" s={38} sw={2.6} /></div>
      <h3>Form submitted</h3>
      <p>
        {schema.name}{client ? ` for ${client.name}` : ""} has been filed with its signed PDF.
      </p>
      <div className="filed">
        <Icon n="lock" s={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />
        Audit event recorded · PDF generated
      </div>
      <div className="acts">
        <button className="btn btn-primary btn-block" onClick={onViewRecords}>View my records</button>
        <button className="btn btn-ghost btn-block" onClick={onClose} style={{ flex: 1 }}>Back to today</button>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export function CaregiverDashboard({ page = "today", onNav }: { page: string; onNav: (p: string) => void }) {
  const [wizard, setWizard] = useState<any>(null);
  const [resubmitting, setResubmitting] = useState<any>(null); // submission being corrected
  const [submissions, setSubmissions] = useState<any[]>(() =>
    Store.getSubmissions().filter((s: any) => s.caregiverId === D.currentUser?.id)
  );
  const [tasks, setTasks] = useState<any[]>(() =>
    Store.getTasks().filter((t: any) => t.assignedToId === D.currentUser?.id)
  );
  const [done, setDone] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTask, setActiveTask] = useState<any>(null); // task being fulfilled

  useEffect(() => {
    void Store.refresh().catch(() => {});
    return Store.subscribe(() => {
      const currentId = D.currentUser?.id;
      setSubmissions(Store.getSubmissions().filter((s: any) => s.caregiverId === currentId));
      setTasks(Store.getTasks().filter((t: any) => t.assignedToId === currentId));
    });
  }, []);

  // Start a form from a task, schema key, or resubmit
  const handleStartTask = useCallback((type: string, data: any) => {
    if (type === "resubmit") {
      // Open wizard pre-filled with previous values for correction
      setResubmitting(data);
      const client = data.clientId ? Store.clients.find((c: any) => c.id === data.clientId) : null;
      setWizard({ schemaKey: data.schemaKey, client, prefillValues: data.values, correctionSub: data });
    } else if (type === "task") {
      const client = data.clientId ? Store.clients.find((c: any) => c.id === data.clientId) : null;
      setActiveTask(data);
      setWizard({ schemaKey: data.schemaKey, client });
    } else {
      // Direct schema start
      setWizard({ schemaKey: data.schemaKey, client: null });
    }
  }, []);

  const startForm = (schemaKey: string, client: any) => setWizard({ schemaKey, client });

  const submit = async ({ schema, values, score, client }: any) => {
    setIsSubmitting(true);
    try {
      if (resubmitting) {
        // Resubmit corrected form
        await Store.resubmitSubmission(resubmitting.id, {
          schemaKey: schema.key,
          clientId: client ? client.id : null,
          clientName: client ? client.name : null,
          values, score,
        });
        setResubmitting(null);
      } else {
        await Store.addSubmission({
          schemaKey: schema.key,
          clientId: client ? client.id : null,
          clientName: client ? client.name : null,
          values, score,
        });
        // Mark task complete if started from a task
        if (activeTask) {
          await Store.updateTask(activeTask.id, { status: "completed", completedAt: new Date().toISOString() });
          setActiveTask(null);
        }
      }
      setWizard(null);
      setDone({ schema, client });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show correction resubmit view for a submission
  const openCorrectionView = (sub: any) => {
    setViewing(null);
    handleStartTask("resubmit", sub);
  };

  return (
    <div className="screen caregiver-screen">
      {page === "today" && <TodayTab onStart={startForm} onStartTask={handleStartTask} submissions={submissions} tasks={tasks} />}
      {page === "forms" && <FormsTab onStart={startForm} />}
      {page === "records" && <RecordsTab submissions={submissions} onOpen={(sub: any) => setViewing(sub)} />}
      {page === "clients" && <ClientsTab />}

      {wizard ? (
        <FormWizard
          schemaKey={wizard.schemaKey}
          initialClient={wizard.client}
          prefillValues={wizard.prefillValues}
          correctionNote={wizard.correctionSub?.correctionNote}
          autoApply
          onClose={() => { setWizard(null); setResubmitting(null); setActiveTask(null); }}
          onSubmit={submit}
          submitLabel={isSubmitting ? (resubmitting ? "Resubmitting..." : "Filing...") : (resubmitting ? "Resubmit corrected form" : "Submit & file")}
          isSubmitting={isSubmitting}
          isResubmit={!!resubmitting}
        />
      ) : null}

      {done ? (
        <DoneScreen
          schema={done.schema}
          client={done.client}
          onClose={() => { setDone(null); if (onNav) onNav("today"); }}
          onViewRecords={() => { setDone(null); if (onNav) onNav("records"); }}
        />
      ) : null}

      {viewing ? (
        <RecordViewer
          sub={viewing}
          onClose={() => setViewing(null)}
          onResubmit={viewing.status === "needsCorrection" ? openCorrectionView : undefined}
        />
      ) : null}
    </div>
  );
}
