import React from "react";

/* The application's own icon set, lifted verbatim from
   dtc-app/dare-to-care-forms/src/components/fields.jsx and src/app/AppShell.tsx.
   24x24 viewBox, 2px round-capped stroke, currentColor. No icon library is used —
   this set IS the brand's iconography. */
const PATHS = {
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  pill: <><path d="M10.5 20.5L3.5 13.5a5 5 0 017-7l7 7a5 5 0 01-7 7z" /><path d="M8.5 8.5l7 7" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>,
  home: <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M9 22V12h6v10" /></>,
  file: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></>,
  fileText: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h6" /></>,
  users: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /></>,
  clients: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></>,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></>,
  chevron: <path d="M9 18l6-6-6-6" />,
  chevDown: <path d="M6 9l6 6 6-6" />,
  arrowLeft: <><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></>,
  x: <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>,
  check: <path d="M20 6L9 17l-5-5" />,
  checkCircle: <><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" /></>,
  sparkle: <path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2-6.3-4.6L5.7 21 8 14 2 9.6h7.6z" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  trash: <><path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></>,
  edit: <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>,
  wifi: <><path d="M5 12.55a11 11 0 0114 0" /><path d="M8.5 16.1a6 6 0 017 0" /><path d="M12 20h.01" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
  layers: <><path d="M12 2L2 7l10 5 10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></>,
  upload: <><path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M4 21h16" /></>,
  download: <><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M4 21h16" /></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  alert: <><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
  refresh: <><path d="M21 12a9 9 0 11-3-6.7L21 8" /><path d="M21 3v5h-5" /></>,
  send: <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></>,
  video: <><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></>,
  logout: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
  leaf: <><path d="M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></>,
  hands: <path d="M12 21C9 19 4 15 4 10.5 4 8 5.8 6 8 6c1.6 0 3 1 4 2.5C13 7 14.4 6 16 6c2.2 0 4 2 4 4.5C20 15 15 19 12 21z" />,
  cross: <><rect x="9" y="3" width="6" height="18" rx="1.5" /><rect x="3" y="9" width="18" height="6" rx="1.5" /></>,
  drop: <><path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z" /><path d="M9.5 14.5a2.5 2.5 0 002.5 2.5" /></>,
  scale: <><path d="M12 3v18" /><path d="M7 6h10" /><path d="M5 21h14" /><path d="M7 6l-3 6h6z" /><path d="M17 6l-3 6h6z" /></>,
  award: <><circle cx="12" cy="8" r="6" /><path d="M8.2 13.5L7 22l5-3 5 3-1.2-8.5" /></>,
  briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M2 13h20" /></>,
  signature: <><path d="M3 17c3 0 4-9 7-9s3 7 5 7 2-3 4-3" /><path d="M3 21h18" /></>,
  play: <path d="M7 4l12 8-12 8z" />,
  idCard: <><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8.5" cy="11" r="2.5" /><path d="M14 10h5M14 14h5M4.5 16.5c.6-1.5 2.1-2.3 4-2.3s3.4.8 4 2.3" /></>,
};

export function Icon({ name, size = 18, strokeWidth = 2, style, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ flex: "0 0 auto", display: "block", ...style }} {...rest}>
      {PATHS[name] || null}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(PATHS);
