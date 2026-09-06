// Subscribe a component to the data layer.
//
// Replaces the `const [, force] = useState(0); useEffect(() => Store.subscribe(
// () => force(v => v + 1)), [])` pair that was repeated at five call sites in
// admin.jsx. useSyncExternalStore is the purpose-built hook for this: it
// subscribes, re-renders on change, and avoids the tearing that a manual
// force-update can produce when a render is interrupted.

import { useSyncExternalStore } from "react";
import { DTCStore } from "../components/store.js";

// The store notifies without describing what changed, so any change bumps this
// counter and every subscriber re-reads. That is what the previous pattern did
// too; it is fine at this data volume and keeps the store dumb.
let version = 0;
const listeners = new Set();

let started = false;
function start() {
  if (started) return;
  started = true;
  DTCStore.subscribe(() => {
    version += 1;
    listeners.forEach((l) => l());
  });
}

function subscribe(onChange) {
  start();
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

const snapshot = () => version;

/**
 * Re-renders the calling component whenever the store emits.
 * Returns the store itself, so a caller reads with the same methods as before.
 */
export function useStore() {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return DTCStore;
}
