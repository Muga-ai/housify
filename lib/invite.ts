import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { nanoid } from "nanoid";

export interface InviteData {
  code: string;
  tenantId: string;
  email: string;
  used: boolean;
}

export async function createTenantInvite(
  tenantId: string,
  email: string
): Promise<string> {
  const code = nanoid(10);

  await setDoc(doc(db, "invites", code), {
    tenantId,
    email,
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    used: false,
  });

  return code;
}

export async function verifyInvite(
  code: string
): Promise<InviteData | null> {
  const ref = doc(db, "invites", code);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data();

  if (data.used) return null;

  if (data.expiresAt && data.expiresAt.toDate() < new Date())
    return null;

  return {
    code,
    tenantId: data.tenantId,
    email: data.email,
    used: data.used,
  };
}

export async function markInviteUsed(code: string) {
  const ref = doc(db, "invites", code);
  await updateDoc(ref, { used: true });
}
