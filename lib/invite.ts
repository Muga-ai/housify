import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, setDoc } from "firebase/firestore";
import { nanoid } from "nanoid";

/* ---------------- CREATE INVITE ---------------- */

export async function createTenantInvite(tenantId: string, email: string) {
  // Generate a short unique code
  const code = nanoid(10); // e.g., "aB12cD34Ef"

  // Save invite in Firestore
  await setDoc(doc(db, "tenantInvites", code), {
    tenantId,
    email,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // optional: 7 days expiration
    used: false,
  });

  return code;
}

/* ---------------- VERIFY INVITE ---------------- */

export async function verifyInvite(code: string) {
  const inviteRef = doc(db, "tenantInvites", code);
  const snap = await getDoc(inviteRef);

  if (!snap.exists()) return null;

  const inviteData = snap.data();

  // Check expiration
  if (inviteData.expiresAt.toDate() < new Date()) return null;

  // Check if already used
  if (inviteData.used) return null;

  return { code, ...inviteData };
}

/* ---------------- MARK INVITE USED ---------------- */

export async function markInviteUsed(code: string) {
  const inviteRef = doc(db, "tenantInvites", code);
  await setDoc(
    inviteRef,
    { used: true, usedAt: new Date() },
    { merge: true }
  );
}
