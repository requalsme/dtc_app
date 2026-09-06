// The Dare to Care helper — a small character that explains the screen it is on.
//
// WHY THIS EXISTS
// Some screens in this app are genuinely hard to read the first time. The
// templates library is the clearest case: it lists forms, but what a "template"
// is, why a form sits in draft, and what publishing actually does to it are all
// invisible. That is knowledge somebody currently has to be told out loud.
//
// WHAT THIS IS, AND WHAT IT IS NOT
// It is a help affordance with a character attached: a button that opens a
// short, written-in-advance explanation of the screen you are looking at. It is
// not a chatbot, it does not call a model, and it never guesses — every word it
// says was written for that specific screen, so it cannot be confidently wrong.
//
// THE ARTWORK IS A SLOT
// The avatar is deliberately not drawn here. Pass `avatar` — an <img>, a Lottie
// player, a sprite, whatever the finished character turns out to be — and it is
// rendered inside the button and the panel header. With nothing passed it falls
// back to the leaf mark, so the feature works fully before the character exists
// and nothing has to be rewired when it arrives.

import React from "react";
import { Icon } from "../core/Icon.jsx";
import { IconButton } from "../core/IconButton.jsx";
import { MonoLabel } from "../core/MonoLabel.jsx";

/**
 * @param {string}   title    what this screen is, in a few words
 * @param {Array}    tips     [{ heading, body }] — written per screen
 * @param {React.ReactNode} avatar  the character; falls back to the leaf mark
 * @param {string}   name     what the character is called
 * @param {string}   storageKey  remembers dismissal per screen, per browser
 */
export function HelpBot({
  title,
  tips = [],
  avatar,
  name = "Dot",
  storageKey,
  basePath = "",
  style,
  ...rest
}) {
  const [open, setOpen] = React.useState(false);
  const [nudge, setNudge] = React.useState(false);

  // A first-time nudge, once per screen per browser. Anyone who has already
  // seen this screen's help is not shown the dot again — a permanent "unread"
  // badge is noise, and noise is what people learn to ignore.
  React.useEffect(() => {
    if (!storageKey) return;
    try {
      if (!window.localStorage.getItem("dtc.help." + storageKey)) setNudge(true);
    } catch { /* private window, or site data blocked — just skip the nudge */ }
  }, [storageKey]);

  const markSeen = () => {
    setNudge(false);
    if (!storageKey) return;
    try { window.localStorage.setItem("dtc.help." + storageKey, "1"); } catch { /* not essential */ }
  };

  const toggle = () => {
    setOpen((v) => !v);
    markSeen();
  };

  const face = avatar || (
    <img
      src={(basePath ? basePath.replace(/\/$/, "") + "/" : "") + "assets/mark-leaf.png"}
      alt=""
      style={{ width: "68%", height: "68%", objectFit: "contain", display: "block" }}
    />
  );

  return (
    <div
      style={{
        position: "fixed", right: 26, bottom: 26, zIndex: 60,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12,
        ...style,
      }}
      {...rest}
    >
      {open && (
        <div
          role="dialog"
          aria-label={`${name} — help for this screen`}
          style={{
            width: "min(360px, calc(100vw - 52px))",
            maxHeight: "min(520px, calc(100vh - 140px))",
            overflowY: "auto",
            background: "var(--surface-raised)",
            borderRadius: "var(--radius-modal)",
            boxShadow: "var(--shadow-overlay)",
            border: "1px solid var(--border-subtle)",
            padding: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
            <span style={{
              display: "grid", placeItems: "center", width: 34, height: 34, flex: "0 0 auto",
              borderRadius: "var(--radius-pill)", background: "var(--surface-accent)", overflow: "hidden",
            }}>
              {face}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-body)" }}>{title}</div>
              <div style={{ fontSize: 12, color: "var(--text-quiet)" }}>{name} can help with this screen</div>
            </div>
            <IconButton icon={<Icon name="x" size={15} />} label="Close help" size="sm" onClick={() => setOpen(false)} />
          </div>

          {tips.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>
              There is no written help for this screen yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {tips.map((tip, i) => (
                <div key={i}>
                  <MonoLabel rule style={{ marginBottom: 7 }}>{tip.heading}</MonoLabel>
                  <div style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--text-secondary)" }}>{tip.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-label={open ? "Close help" : `Ask ${name} about this screen`}
        aria-expanded={open}
        style={{
          position: "relative",
          width: 54, height: 54, padding: 0,
          display: "grid", placeItems: "center",
          borderRadius: "var(--radius-pill)",
          background: "var(--surface-accent)",
          border: "1px solid var(--border-brand)",
          boxShadow: "var(--shadow-lift)",
          cursor: "pointer",
          overflow: "hidden",
          transition: "transform var(--duration-fast) var(--ease-standard)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; }}
      >
        {face}
        {nudge && !open && (
          <span
            aria-hidden
            style={{
              position: "absolute", top: 4, right: 4, width: 11, height: 11,
              borderRadius: "var(--radius-pill)",
              background: "var(--brand-primary)",
              boxShadow: "0 0 0 2px var(--surface-raised)",
            }}
          />
        )}
      </button>
    </div>
  );
}
