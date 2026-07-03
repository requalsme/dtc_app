import { useEffect, useState } from "react";
import { useAuth } from "../../app/AuthContext";
// @ts-ignore - JS module without types
import { DTCStore as Store } from "../../components/store";
// @ts-ignore - JS module without types
import { Icon } from "../../components/fields";
import { FormWizard, RecordViewer, getSchema } from "../../components/forms/FormWizard";
import { fmtDate } from "../../utils/format";

// Client-facing forms. These render directly (no admin publish needed) so the
// portal is always usable. More Admission Packet documents will be added here.
const CLIENT_FORM_KEYS = ["clientCarePreferences", "clientEmergencyContacts", "clientSatisfaction"];

export default function ClientPortal() {
  const { user } = useAuth();
  const [wizardKey, setWizardKey] = useState<string | null>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [done, setDone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);

  useEffect(() => {
    void Store.refresh().catch(() => {});
    const update = () => {
      const uid = user?.id;
      setSubmissions(Store.getSubmissions().filter((s: any) => s.caregiverId === uid));
    };
    update();
    return Store.subscribe(update);
  }, [user?.id]);

  const submit = async ({ schema, values, score }: any) => {
    setSubmitting(true);
    try {
      await Store.addSubmission({
        schemaKey: schema.key,
        clientId: null,
        clientName: user?.name || null,
        values,
        score,
      });
      setWizardKey(null);
      setDone(schema.name);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="client-portal">
      {/* Hero */}
      <div className="client-hero">
        <div className="client-hero-eyebrow">Client Portal</div>
        <h1>Hello, {user?.name?.split(" ")[0] || "there"}</h1>
        <p>Access your forms and documents, or reach out to your care team anytime.</p>
      </div>

      {/* Forms */}
      <div className="newhire-section-title" style={{ marginTop: 0 }}>Your forms</div>
      <div className="client-forms-grid">
        {CLIENT_FORM_KEYS.map((key) => {
          const schema = getSchema(key);
          if (!schema) return null;
          return (
            <button key={key} className="client-form-card" onClick={() => setWizardKey(key)}>
              <div className="client-form-icon">
                <Icon n={schema.icon || "file"} s={22} />
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <strong>{schema.name}</strong>
                <span>{schema.description}</span>
              </div>
              <Icon n="chevron" s={16} style={{ color: "var(--ink-4)", flexShrink: 0 }} />
            </button>
          );
        })}
      </div>

      {/* Submitted records */}
      {submissions.length > 0 && (
        <>
          <div className="newhire-section-title">Your submitted forms</div>
          <div className="card" style={{ padding: "4px 16px" }}>
            {submissions.map((sub: any) => {
              const schema = getSchema(sub.schemaKey);
              return (
                <button className="subrow" key={sub.id} onClick={() => setViewing(sub)}>
                  <span className="si"><Icon n={schema?.icon || "file"} s={18} /></span>
                  <span className="sinfo">
                    <span className="nm">{schema?.name || sub.schemaKey}</span>
                    <span className="meta">{sub.submittedAt ? fmtDate(sub.submittedAt.slice(0, 10)) : "—"}</span>
                  </span>
                  <span className="stat">Filed</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Contact card */}
      <div className="client-contact-card">
        <div className="client-contact-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
          </svg>
        </div>
        <div>
          <strong>Need help?</strong>
          <span>
            Contact the DARE to Care office to speak with your care coordinator, update your schedule, or ask any questions about your care plan.
          </span>
        </div>
      </div>

      {/* Form wizard */}
      {wizardKey && (
        <FormWizard
          schemaKey={wizardKey}
          autoApply
          onClose={() => setWizardKey(null)}
          onSubmit={submit}
          submitLabel={submitting ? "Filing..." : "Submit & file"}
          isSubmitting={submitting}
        />
      )}

      {/* Done confirmation */}
      {done && (
        <div className="done">
          <div className="badge-ok"><Icon n="check" s={38} sw={2.6} /></div>
          <h3>Form submitted</h3>
          <p>{done} has been submitted to your care team.</p>
          <div className="acts">
            <button className="btn btn-primary btn-block" onClick={() => setDone(null)}>Done</button>
          </div>
        </div>
      )}

      {/* Record viewer (with Download PDF) */}
      {viewing && <RecordViewer sub={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
