import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface UserRecord {
  role: "admin" | "tenant";
  orgId: string;
}

export async function getUserRole(uid: string): Promise<UserRecord> {
  const snap = await getDoc(doc(db, "users", uid));

  if (!snap.exists()) {
    throw new Error("User role not found");
  }

  const data = snap.data();

  if (!data.orgId) {
    throw new Error("User has no org assigned. Contact support.");
  }

  return {
    role: data.role as "admin" | "tenant",
    orgId: data.orgId as string,
  };
}