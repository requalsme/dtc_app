// Firebase admin access, from a service-account key in an environment variable
// rather than the ambient credentials a Cloud Function would have had.
//
// This is what makes the ingestion pipeline portable. It runs anywhere that can
// hold a secret and run Node — Netlify, GitHub Actions, a laptop — instead of
// requiring the project to be on a paid Firebase plan just to run a cron.

import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let cached = null;

function readServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is not set. Generate a key at Firebase console → " +
        "Project settings → Service accounts, and store the JSON in that variable.",
    );
  }
  // Accept base64 as well as raw JSON: some dashboards mangle multi-line values,
  // and a key that silently arrives corrupted is a bad afternoon.
  const text = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON (or base64-encoded JSON).");
  }
}

/** Lazily initialise, and reuse across warm invocations. */
export function firebase() {
  if (cached) return cached;

  const app = getApps().length
    ? getApp()
    : initializeApp({
        credential: cert(readServiceAccount()),
        storageBucket:
          process.env.FIREBASE_STORAGE_BUCKET || "dtcapp-24504.firebasestorage.app",
      });

  cached = { app, db: getFirestore(app), bucket: getStorage(app).bucket() };
  return cached;
}
