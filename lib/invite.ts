/**
 * lib/invite.ts  (UPDATED)
 *
 * Invite tokens now carry orgId so tenants are scoped
 * to the correct company when they sign up.
 */

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { nanoid } from "nanoid"; // npm install nanoid

export interface InviteData {
  code: string;
  tenantId: string;
  email: string;
  orgId: string;          // ← NEW
  used: boolean;
  expiresAt: Date;
}

/**
 * Creates an invite document and returns the invite code.
 * Called by admin when inviting a tenant.
 */
export async function createTenantInvite(
  tenantId: string,
  email: string,
  orgId: string           
): Promise<string> {
  const code = nanoid(32);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

  await addDoc(collection(db, "invites"), {
    code,
    tenantId,
    email,
    orgId,                 // ← stored on invite
    used: false,
    createdAt: serverTimestamp(),
    expiresAt,
  });

  return code;
}

/**
 * Verifies an invite code is valid, unused, and not expired.
 */
export async function verifyInvite(code: string): Promise<InviteData | null> {
  const q = query(collection(db, "invites"), where("code", "==", code));
  const snap = await getDocs(q);

  if (snap.empty) return null;

  const data = snap.docs[0].data();

  if (data.used) return null;

  const expiresAt =
    data.expiresAt instanceof Timestamp
      ? data.expiresAt.toDate()
      : new Date(data.expiresAt);

  if (expiresAt < new Date()) return null;

  return {
    code,
    tenantId: data.tenantId,
    email: data.email,
    orgId: data.orgId,    // ← returned to signup page
    used: data.used,
    expiresAt,
  };
}

/**
 * Marks an invite as used after tenant completes signup.
 */
export async function markInviteUsed(code: string): Promise<void> {
  const q = query(collection(db, "invites"), where("code", "==", code));
  const snap = await getDocs(q);

  if (!snap.empty) {
    await updateDoc(doc(db, "invites", snap.docs[0].id), { used: true });
  }
}