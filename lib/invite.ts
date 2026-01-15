import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { nanoid } from "nanoid";

/* ====== TYPES ====== */
export interface InviteData {
  code: string;
  tenantId: string;
  email: string;
  used: boolean;
}

/* ====== FUNCTIONS ====== */

// Create a tenant invite
export async function createTenantInvite(tenantId: string, email: string): Promise<string> {
  const code = nanoid(10); // e.g., "aB12cD34Ef"

  await setDoc(doc(db, "tenant_invites", code), {
    tenantId,
    email,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // optional: 7 days expiration
    used: false,
  });

  return code;
}

// Verify invite code exists and is unused
export async function verifyInvite(code: string): Promise<InviteData | null> {
  const ref = doc(db, "invites", code);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data();
  if (data.used) return null;

  return {
    code,
    tenantId: data.tenantId,
    email: data.email,
    used: data.used,
  };
}

// Mark invite as used
export async function markInviteUsed(code: string) {
  const ref = doc(db, "tenant_invites", code);
  await updateDoc(ref, { used: true });
}
