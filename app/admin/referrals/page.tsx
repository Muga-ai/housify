"use client";

/**
 * app/admin/referrals/page.tsx
 *
 * FIXED version — key changes from previous:
 *
 * 1. STATUS LIFECYCLE updated:
 *    submitted → invited → unit_filled → paid
 *    "invited" is the new state meaning admin has sent the invite link.
 *
 * 2. "Invite as Tenant" button replaces "Mark unit filled" on submitted referrals.
 *    It calls the EXACT same flow as admin/tenants/invite:
 *      - addDoc to "tenants" collection (status: "pending")
 *      - createTenantInvite(tenantRef.id, email, orgId)
 *      - Shows the invite link + WhatsApp / copy share options
 *    This means the referee goes through the normal onboarding flow.
 *
 * 3. Once invited, admin sees the invite link in-line on the referral row
 *    and can copy or re-share it if needed.
 *
 * 4. "Mark unit filled" only appears AFTER status is "invited" — meaning
 *    the person has had a chance to accept the invite and move in.
 *
 * 5. "Confirm payout" (paid) works same as before.
 */

import { useEffect, useState } from "react";
import {
  collection, query, where, getDocs,
  doc, updateDoc, addDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createTenantInvite } from "@/lib/invite";
import { useOrgContext } from "@/lib/org-context";
import {
  Gift, BadgeCheck, Clock, Home, Loader2,
  CheckCircle, AlertTriangle, UserPlus,
  ClipboardCopy, MessageCircle, Mail,
} from "lucide-react";

/* ── Types ────────────────────────────────────────────────────────────── */

type ReferralStatus = "submitted" | "invited" | "unit_filled" | "paid";

interface Referral {
  id: string;
  referrerTenantId: string;
  referrerName?: string;
  referredName: string;
  referredEmail: string;
  orgId: string;
  status: ReferralStatus;
  commissionAmount?: number | null;
  unitId?: string | null;
  unitNumber?: string | null;
  inviteLink?: string | null;   // stored after invite is created
  createdAt?: { seconds: number };
}

/* ── Status config ────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<ReferralStatus, {
  label: string;
  badge: string;
  icon: React.ReactNode;
  desc: string;
}> = {
  submitted: {
    label: "Submitted",
    badge: "bg-yellow-100 text-yellow-700",
    icon:  <Clock      className="h-3.5 w-3.5" />,
    desc:  "Referee expressed interest — review and invite them if suitable",
  },
  invited: {
    label: "Invited",
    badge: "bg-blue-100 text-blue-700",
    icon:  <UserPlus   className="h-3.5 w-3.5" />,
    desc:  "Invite link sent — waiting for referee to accept and move in",
  },
  unit_filled: {
    label: "Unit filled",
    badge: "bg-indigo-100 text-indigo-700",
    icon:  <Home       className="h-3.5 w-3.5" />,
    desc:  "Referee has moved in — set commission and confirm payout",
  },
  paid: {
    label: "Paid",
    badge: "bg-green-100 text-green-700",
    icon:  <BadgeCheck className="h-3.5 w-3.5" />,
    desc:  "Commission paid to referring tenant",
  },
};

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function AdminReferralsPage() {
  const { orgId } = useOrgContext();

  const [loading,   setLoading]   = useState(true);
  const [referrals, setReferrals] = useState<Referral[]>([]);

  /* Per-referral UI state */
  const [inviting,         setInviting]         = useState<string | null>(null); // referralId being invited
  const [saving,           setSaving]           = useState<string | null>(null); // referralId being status-saved
  const [inviteResults,    setInviteResults]     = useState<Record<string, string>>({}); // referralId → invite link
  const [copiedId,         setCopiedId]         = useState<string | null>(null);
  const [commissionInputs, setCommissionInputs] = useState<Record<string, string>>({});

  /* ── Fetch ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!orgId) return;
    fetchReferrals();
  }, [orgId]);

  const fetchReferrals = async () => {
    setLoading(true);
    try {
      const [refSnap, tenantSnap] = await Promise.all([
        getDocs(query(collection(db, "referrals"), where("orgId", "==", orgId))),
        getDocs(query(collection(db, "tenants"),   where("orgId", "==", orgId))),
      ]);

      const tenantMap: Record<string, string> = {};
      tenantSnap.docs.forEach((d) => {
        tenantMap[d.id] = d.data().name as string;
      });

      const statusOrder: Record<ReferralStatus, number> = {
        submitted: 0, invited: 1, unit_filled: 2, paid: 3,
      };

      const refs: Referral[] = refSnap.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
          referrerName: tenantMap[d.data().referrerTenantId] ?? "Unknown tenant",
        } as Referral))
        .sort((a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4));

      setReferrals(refs);

      const inputs: Record<string, string> = {};
      refs.forEach((r) => {
        inputs[r.id] = r.commissionAmount != null ? String(r.commissionAmount) : "";
      });
      setCommissionInputs(inputs);
    } catch (err) {
      console.error("Referrals load error:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Invite as Tenant ─────────────────────────────────────────────── */
  /*
   * This mirrors EXACTLY what admin/tenants/invite/page.tsx does:
   *  1. Check for duplicate email in tenants collection
   *  2. addDoc to "tenants" (status: "pending") — same as invite page
   *  3. createTenantInvite(tenantRef.id, email, orgId) — same lib call
   *  4. Store invite link on referral doc + update status to "invited"
   */
  const handleInviteAsTenant = async (ref: Referral) => {
    setInviting(ref.id);
    try {
      /* 1. Duplicate check */
      const existing = await getDocs(
        query(
          collection(db, "tenants"),
          where("email", "==", ref.referredEmail),
          where("orgId", "==", orgId)
        )
      );
      if (!existing.empty) {
        alert(`A tenant with email ${ref.referredEmail} already exists in your organisation.`);
        return;
      }

      /* 2. Create tenant doc (pending) — identical to invite page */
      const tenantRef = await addDoc(collection(db, "tenants"), {
        name:       ref.referredName,
        email:      ref.referredEmail,
        propertyId: null,
        unitId:     null,
        status:     "pending",
        orgId,
        createdAt:  serverTimestamp(),
      });

      /* 3. Create invite — same createTenantInvite call */
      const code       = await createTenantInvite(tenantRef.id, ref.referredEmail, orgId);
      const inviteLink = `${window.location.origin}/signup/${code}`;

      /* 4. Update referral: status → invited, store invite link */
      await updateDoc(doc(db, "referrals", ref.id), {
        status:     "invited",
        inviteLink,
        invitedAt:  serverTimestamp(),
        updatedAt:  serverTimestamp(),
      });

      /* Show invite link in UI */
      setInviteResults((prev) => ({ ...prev, [ref.id]: inviteLink }));
      await fetchReferrals();
    } catch (err) {
      console.error(err);
      alert("Failed to create invite. Please try again.");
    } finally {
      setInviting(null);
    }
  };

  /* ── Status update (unit_filled / paid) ──────────────────────────── */
  const handleStatusChange = async (referralId: string, newStatus: ReferralStatus) => {
    setSaving(referralId);
    try {
      const commission = parseFloat(commissionInputs[referralId] ?? "");
      await updateDoc(doc(db, "referrals", referralId), {
        status:           newStatus,
        commissionAmount: isNaN(commission) ? null : commission,
        updatedAt:        serverTimestamp(),
        ...(newStatus === "paid" ? { paidAt: serverTimestamp() } : {}),
      });
      await fetchReferrals();
    } catch (err) {
      console.error(err);
      alert("Failed to update referral. Please try again.");
    } finally {
      setSaving(null);
    }
  };

  /* ── Copy invite link ─────────────────────────────────────────────── */
  const handleCopy = async (referralId: string, link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(referralId);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      prompt("Copy this link:", link);
    }
  };

  /* ── WhatsApp share ───────────────────────────────────────────────── */
  const handleWhatsApp = (ref: Referral, link: string) => {
    const msg = encodeURIComponent(
      `Hi ${ref.referredName},\n\n` +
      `You've been invited to join Tunzaprop as a tenant.\n\n` +
      `Create your account here:\n${link}\n\n` +
      `This link expires in 7 days.`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  /* ── Email share ──────────────────────────────────────────────────── */
  const handleEmail = (ref: Referral, link: string) => {
    const subject = encodeURIComponent("You're invited to join Tunzaprop");
    const body    = encodeURIComponent(
      `Hi ${ref.referredName},\n\n` +
      `You've been invited to join Tunzaprop.\n\n` +
      `Create your account here:\n${link}\n\n` +
      `This link expires in 7 days.\n\n— Tunzaprop`
    );
    window.location.href = `mailto:${ref.referredEmail}?subject=${subject}&body=${body}`;
  };

  /* ── Summary stats ────────────────────────────────────────────────── */
  const totalPaid    = referrals.filter((r) => r.status === "paid").reduce((s, r) => s + (r.commissionAmount ?? 0), 0);
  const totalPending = referrals.filter((r) => r.status === "unit_filled").reduce((s, r) => s + (r.commissionAmount ?? 0), 0);
  const newCount     = referrals.filter((r) => r.status === "submitted").length;

  /* ── Render ────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <main className="space-y-8 max-w-5xl">

      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Gift className="h-6 w-6 text-indigo-600" />
          Tenant Referrals
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Review referrals from your tenants. Invite suitable candidates — they go through
          your standard onboarding flow.
        </p>
      </header>

      {/* New referrals alert */}
      {newCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
          <p className="text-sm text-yellow-800 font-medium">
            {newCount} new referral{newCount !== 1 ? "s" : ""} waiting for your review
          </p>
        </div>
      )}

      {/* Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total referrals</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{referrals.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Commissions paid out</p>
          <p className="text-2xl font-bold text-green-600 mt-1">KES {totalPaid.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending payouts</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">KES {totalPending.toLocaleString()}</p>
        </div>
      </section>

      {/* Referrals list */}
      {referrals.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-gray-50 py-16 text-center">
          <Gift className="h-10 w-10 text-indigo-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No referrals yet</p>
          <p className="text-sm text-gray-400 mt-1">
            When tenants share their referral links and someone expresses interest, it appears here.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          {referrals.map((ref) => {
            const cfg      = STATUS_CONFIG[ref.status] ?? STATUS_CONFIG.submitted;
            const isSaving  = saving   === ref.id;
            const isInviting = inviting === ref.id;
            const freshLink = inviteResults[ref.id] ?? ref.inviteLink;
            const isCopied  = copiedId === ref.id;

            return (
              <div key={ref.id} className="rounded-xl border bg-white p-5 shadow-sm">

                {/* Top row: referee info + status badge */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{ref.referredName}</p>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${cfg.badge}`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{ref.referredEmail}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Referred by <span className="font-medium text-gray-600">{ref.referrerName}</span>
                      {ref.createdAt && (
                        <> · {new Date(ref.createdAt.seconds * 1000).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}</>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 italic">{cfg.desc}</p>
                  </div>
                </div>

                {/* ── SUBMITTED: show Invite as Tenant button ── */}
                {ref.status === "submitted" && (
                  <div className="flex items-center gap-3 pt-3 border-t">
                    <button
                      disabled={isInviting}
                      onClick={() => handleInviteAsTenant(ref)}
                      className="flex items-center gap-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-60"
                    >
                      {isInviting
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating invite…</>
                        : <><UserPlus className="h-4 w-4" /> Invite as Tenant</>
                      }
                    </button>
                    <p className="text-xs text-gray-400">
                      This creates a tenant record and sends them through your normal onboarding flow
                    </p>
                  </div>
                )}

                {/* ── INVITED: show invite link + share options ── */}
                {(ref.status === "invited" || freshLink) && (
                  <div className="pt-3 border-t space-y-3">
                    {freshLink && (
                      <>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Invite link
                        </p>
                        <div className="flex items-center gap-2 bg-gray-50 border rounded-lg px-3 py-2">
                          <span className="flex-1 text-xs font-mono text-gray-700 truncate">
                            {freshLink}
                          </span>
                          <button
                            onClick={() => handleCopy(ref.id, freshLink)}
                            className={`shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition ${
                              isCopied
                                ? "bg-green-100 text-green-700"
                                : "text-indigo-600 hover:bg-indigo-50"
                            }`}
                          >
                            {isCopied
                              ? <><CheckCircle className="h-3.5 w-3.5" /> Copied</>
                              : <><ClipboardCopy className="h-3.5 w-3.5" /> Copy</>
                            }
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleWhatsApp(ref, freshLink)}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WhatsApp
                          </button>
                          <button
                            onClick={() => handleEmail(ref, freshLink)}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-black text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            Email
                          </button>
                        </div>
                      </>
                    )}

                    {/* Mark unit filled — only after invited */}
                    {ref.status === "invited" && (
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          disabled={isSaving}
                          onClick={() => handleStatusChange(ref.id, "unit_filled")}
                          className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg transition disabled:opacity-60"
                        >
                          {isSaving
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Home className="h-3.5 w-3.5" />
                          }
                          Mark unit filled
                        </button>
                        <p className="text-xs text-gray-400">
                          Confirm once they have accepted the invite and moved in
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── UNIT FILLED: commission input + confirm payout ── */}
                {ref.status === "unit_filled" && (
                  <div className="pt-3 border-t space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-500 whitespace-nowrap font-medium">
                        Commission (KES)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={commissionInputs[ref.id] ?? ""}
                        onChange={(e) =>
                          setCommissionInputs((prev) => ({ ...prev, [ref.id]: e.target.value }))
                        }
                        placeholder="e.g. 1000"
                        className="w-32 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        disabled={isSaving}
                        onClick={() => handleStatusChange(ref.id, "paid")}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition disabled:opacity-60"
                      >
                        {isSaving
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <BadgeCheck className="h-3.5 w-3.5" />
                        }
                        Confirm payout
                      </button>
                      <p className="text-xs text-gray-400">
                        Confirm once you have paid the commission to {ref.referrerName}
                      </p>
                    </div>
                  </div>
                )}

                {/* ── PAID: final state ── */}
                {ref.status === "paid" && (
                  <div className="pt-3 border-t flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-600">
                      Commission paid · KES {(ref.commissionAmount ?? 0).toLocaleString()} to {ref.referrerName}
                    </span>
                  </div>
                )}

              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
