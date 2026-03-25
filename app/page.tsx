"use client";

import Link from "next/link";
import { useCounter } from "@/hooks/useCounter";
import { useInView } from "@/hooks/useInView";
import { useState, useEffect } from "react";
import {
  Building2, Users, Wrench, BarChart3, ArrowRight,
  CheckCircle, TrendingUp, Shield, FileText, Bell,
  ChevronRight, Star, MapPin, Phone, Mail, Globe,
  Receipt, PieChart, Hammer, House,
} from "lucide-react";

export default function Home() {
  const propertiesCount = useCounter(2400, 60);
  const tenantsCount    = useCounter(18500, 60);
  const rentCount       = useCounter(94, 60);
  const kshCount        = useCounter(480, 60);

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { ref: statsRef,        inView: statsInView        } = useInView<HTMLDivElement>();
  const { ref: featuresRef,     inView: featuresInView     } = useInView<HTMLDivElement>();
  const { ref: howRef,          inView: howInView          } = useInView<HTMLDivElement>();
  const { ref: testimonialsRef, inView: testimonialsInView } = useInView<HTMLDivElement>();

  // ─── All styles are now in globals.css — NO <style> tag needed here ───

  return (
   <div className="hfy-dark-page" style={{ minHeight: "100vh", width: "100%" }}>
    
      {/* ── NAV ── */}
      <nav className={`nav ${scrolled ? "scrolled" : ""}`}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "var(--amber)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={18} color="#000" />
            </div>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: "0.02em", textTransform: "uppercase", color: "#fff" }}>
              Housify KE
            </span>
          </div>

          {/* Desktop links */}
          <div className="hide-mobile" style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {["Features", "How It Works", "Pricing"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                style={{ color: "var(--text2)", textDecoration: "none", fontSize: 14, fontWeight: 500, transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text2)")}
              >{item}</a>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/login" className="btn-ghost hide-mobile" style={{ padding: "10px 20px" }}>Sign In</Link>
            <Link href="/register" className="btn-primary" style={{ padding: "10px 20px" }}>Get Started</Link>
            {/* Mobile burger */}
            <button
              className="hide-desktop"
              onClick={() => setMenuOpen(true)}
              style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", padding: 4, display: "none" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 22, height: 2, background: "currentColor", borderRadius: 2 }} />)}
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile nav overlay */}
      {menuOpen && (
        <div className="mobile-nav open">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, textTransform: "uppercase" }}>Housify KE</span>
            <button onClick={() => setMenuOpen(false)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 24 }}>✕</button>
          </div>
          {["Features", "How It Works", "Pricing"].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`}
              onClick={() => setMenuOpen(false)}
              style={{ color: "var(--text)", textDecoration: "none", fontSize: 24, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: "uppercase", padding: "12px 0", borderBottom: "1px solid var(--border)" }}
            >{item}</a>
          ))}
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <Link href="/login" className="btn-ghost" style={{ justifyContent: "center" }}>Sign In</Link>
            <Link href="/register" className="btn-primary" style={{ justifyContent: "center" }}>Get Started Free</Link>
          </div>
        </div>
      )}

      <main>
        {/* ── HERO ── */}
        <section className="grid-bg" style={{ position: "relative", overflow: "hidden", paddingTop: 140, paddingBottom: 100 }}>
          <div className="glow-amber" style={{ width: 600, height: 600, top: -200, left: -100 }} />
          <div className="glow-amber" style={{ width: 400, height: 400, bottom: -100, right: -50 }} />

          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", position: "relative" }}>
            <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>

              {/* Left */}
              <div>
                <div className="pill" style={{ marginBottom: 24 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)", display: "inline-block" }} />
                  Built for Kenyan Property Managers
                </div>

                <h1 className="display" style={{ fontSize: "clamp(52px, 7vw, 88px)", color: "#fff", marginBottom: 24 }}>
                  Manage Every<br />
                  <span style={{ color: "var(--amber)" }}>Property.</span><br />
                  Every Tenant.<br />
                  <span style={{ color: "var(--text2)", fontWeight: 600 }}>One Dashboard.</span>
                </h1>

                <p style={{ fontSize: 17, color: "var(--text2)", lineHeight: 1.7, maxWidth: 460, marginBottom: 36, fontWeight: 300 }}>
                  Housify KE gives Nairobi landlords and property agents a single command centre for rent collection, tenant management, maintenance tracking, and financial reporting.
                </p>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Link href="/register" className="btn-primary">
                    Start Free Trial <ArrowRight size={16} />
                  </Link>
                  <a href="#how-it-works" className="btn-ghost">
                    See How It Works
                  </a>
                </div>

                <div style={{ marginTop: 36, display: "flex", gap: 24, flexWrap: "wrap" }}>
                  {["14-day free trial", "No credit card needed", "Setup in 5 minutes"].map((t) => (
                    <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)", fontWeight: 500 }}>
                      <CheckCircle size={14} style={{ color: "var(--amber)", flexShrink: 0 }} />
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — dashboard preview card */}
              <div style={{ position: "relative" }}>
                <div style={{
                  background: "linear-gradient(145deg, #1e2535, #161d2e)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 20,
                  padding: 28,
                  boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
                }}>
                  {/* Mock top bar */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {["#ef4444","#f59e0b","#22c55e"].map(c => (
                        <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 500 }}>Admin Dashboard</div>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                  </div>

                  {/* Mock stat row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                    {[
                      { label: "Collected", value: "KES 284K", up: true },
                      { label: "Pending",   value: "3 payments", up: false },
                      { label: "Occupied",  value: "94%",        up: true },
                      { label: "Open Issues", value: "2",        up: false },
                    ].map((s) => (
                      <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 10, color: "var(--text2)", marginBottom: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: s.up ? "#fff" : "var(--amber2)" }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Mock progress bar */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text2)", marginBottom: 6 }}>
                      <span>Rent collection progress</span><span style={{ color: "var(--amber)" }}>94%</span>
                    </div>
                    <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
                      <div style={{ width: "94%", height: "100%", background: "linear-gradient(90deg, var(--amber), var(--amber2))", borderRadius: 3 }} />
                    </div>
                  </div>

                  {/* Mock tenant list */}
                  {["James Kamau · Unit A2 · ✓ Verified", "Grace Wanjiku · Unit B1 · ⏳ Pending", "Peter Omondi · Unit C3 · ✓ Verified"].map((row) => (
                    <div key={row} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text2)" }}>
                      <span>{row.split(" · ")[0]}</span>
                      <span style={{ fontSize: 11 }}>{row.split(" · ").slice(1).join(" · ")}</span>
                    </div>
                  ))}
                </div>

                {/* Floating badge */}
                <div style={{
                  position: "absolute", bottom: -20, left: -20,
                  background: "var(--amber)", color: "#000",
                  borderRadius: 12, padding: "12px 16px",
                  boxShadow: "0 8px 24px rgba(245,158,11,0.4)",
                  fontWeight: 700, fontSize: 13,
                }}>
                  🏠 3 new tenants this week
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <section style={{ background: "var(--ink2)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "64px 24px" }}>
          <div ref={statsRef} style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
              {[
                { count: propertiesCount, suffix: "+",   label: "Properties managed",    icon: <Building2 size={20} /> },
                { count: tenantsCount,    suffix: "+",   label: "Active tenants",         icon: <Users size={20} /> },
                { count: rentCount,       suffix: "%",   label: "Collection rate",         icon: <TrendingUp size={20} /> },
                { count: kshCount,        suffix: "M+",  label: "KES tracked monthly",    icon: <Receipt size={20} /> },
              ].map((s, i) => (
                <div key={i} className={`stat-card fade-up d${i + 1} ${statsInView ? "visible" : ""}`}>
                  <div style={{ color: "var(--amber)", marginBottom: 12 }}>{s.icon}</div>
                  <div className="display" style={{ fontSize: 44, color: "#fff" }}>
                    {s.count.toLocaleString()}{s.suffix}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" style={{ padding: "100px 24px" }}>
          <div ref={featuresRef} style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ marginBottom: 60 }}>
              <div className={`pill fade-up ${featuresInView ? "visible" : ""}`} style={{ marginBottom: 16 }}>
                Platform Features
              </div>
              <h2 className={`display accent-line fade-up d1 ${featuresInView ? "visible" : ""}`} style={{ fontSize: "clamp(36px, 5vw, 56px)", color: "#fff" }}>
                Everything a Kenyan<br />Landlord Needs
              </h2>
            </div>

            <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                { icon: <Building2 size={20} />, title: "Property & Unit Management",  desc: "Add unlimited properties and units. Track occupancy, assign tenants, and set individual rent amounts per unit." },
                { icon: <Users size={20} />,     title: "Tenant Portal",                desc: "Tenants get their own dashboard. View rent due dates, submit maintenance requests, and report payment wellness." },
                { icon: <Receipt size={20} />,   title: "Rent Collection",              desc: "Tenants log M-Pesa codes, bank refs, or cash payments. You verify in one click and generate instant invoices." },
                { icon: <Wrench size={20} />,    title: "Maintenance Tracking",         desc: "Track every reported issue from open to resolved. No more WhatsApp threads — everything in one place." },
                { icon: <TrendingUp size={20} />,title: "Expenses & Net Yield",         desc: "Log garbage, security, insurance, caretaker costs per property. See real net income and annualised yield %." },
                { icon: <FileText size={20} />,  title: "Reports & Invoices",           desc: "Generate a monthly portfolio PDF showing rent collected, expenses, net income, and every tenant's status." },
                { icon: <Bell size={20} />,      title: "Wellness Monitoring",          desc: "Tenants self-report payment health (green/yellow/red). Get early warning before arrears become a problem." },
                { icon: <Shield size={20} />,    title: "Multi-org & Secure",           desc: "Each property company is fully isolated. Role-based access keeps admin and tenant data separate." },
                { icon: <Hammer size={20} />,    title: "FundiPlus Integration",        desc: "Hire vetted Nairobi fundis directly from your dashboard. Transparent pricing, no phone tag." },
              ].map((f, i) => (
                <div key={i} className={`card fade-up d${(i % 3) + 1} ${featuresInView ? "visible" : ""}`} style={{ padding: 24 }}>
                  <div className="feat-icon" style={{ marginBottom: 16 }}>{f.icon}</div>
                  <h3 style={{ fontWeight: 600, fontSize: 15, color: "#fff", marginBottom: 8, lineHeight: 1.3 }}>{f.title}</h3>
                  <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, fontWeight: 300 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" style={{ background: "var(--ink2)", padding: "100px 24px", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <div ref={howRef} style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ marginBottom: 60 }}>
              <div className={`pill fade-up ${howInView ? "visible" : ""}`} style={{ marginBottom: 16 }}>Getting Started</div>
              <h2 className={`display fade-up d1 ${howInView ? "visible" : ""}`} style={{ fontSize: "clamp(36px, 5vw, 56px)", color: "#fff" }}>
                Up and Running<br />in 15 Minutes
              </h2>
            </div>

            <div className="steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
              {[
                { n: "01", title: "Create your account",    desc: "Sign up with your company name and choose a plan. 14-day trial, no card required." },
                { n: "02", title: "Add properties & units", desc: "Register your buildings and individual units with rent amounts and due dates." },
                { n: "03", title: "Invite your tenants",    desc: "Generate an invite link per tenant. They set up their portal in under 2 minutes." },
                { n: "04", title: "Collect & report",       desc: "Verify payments, track expenses, download monthly PDF reports for your accountant." },
              ].map((s, i) => (
                <div key={i} className={`fade-up d${i + 1} ${howInView ? "visible" : ""}`} style={{ position: "relative" }}>
                  {i < 3 && (
                    <div className="hide-mobile" style={{ position: "absolute", top: 19, left: "calc(100% - 12px)", width: "calc(100% - 28px)", height: 1, background: "linear-gradient(90deg, var(--amber), transparent)", zIndex: 0 }} />
                  )}
                  <div className="step-num" style={{ marginBottom: 20, position: "relative", zIndex: 1 }}>{s.n}</div>
                  <h3 style={{ fontWeight: 600, fontSize: 16, color: "#fff", marginBottom: 10 }}>{s.title}</h3>
                  <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, fontWeight: 300 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" style={{ padding: "100px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 60 }}>
              <div className="pill" style={{ marginBottom: 16 }}>Transparent Pricing</div>
              <h2 className="display" style={{ fontSize: "clamp(36px, 5vw, 56px)", color: "#fff" }}>
                Plans for Every<br />Portfolio Size
              </h2>
              <p style={{ fontSize: 15, color: "var(--text2)", marginTop: 16, fontWeight: 300 }}>
                All plans include the tenant portal, maintenance tracking, and payment verification.
              </p>
            </div>

            <div className="pricing-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, maxWidth: 900, margin: "0 auto" }}>
              {[
                {
                  name: "Starter", price: "KES 1,500", period: "/mo · billed yearly",
                  units: "Up to 20 units", featured: false,
                  features: ["1 property", "Tenant portal", "Maintenance tracking", "Payment verification", "PDF invoices"],
                },
                {
                  name: "Growth", price: "KES 3,500", period: "/mo · billed yearly",
                  units: "Up to 100 units", featured: true,
                  features: ["Up to 10 properties", "Tenant portal", "Maintenance tracking", "Payment verification", "PDF invoices", "Expense tracking", "Monthly PDF reports", "Net yield analytics"],
                },
                {
                  name: "Pro", price: "KES 7,000", period: "/mo · billed yearly",
                  units: "Unlimited units", featured: false,
                  features: ["Unlimited properties", "Tenant portal", "Maintenance tracking", "Payment verification", "PDF invoices", "Expense tracking", "Monthly PDF reports", "Net yield analytics", "Priority support"],
                },
              ].map((plan) => (
                <div key={plan.name} className={`price-card ${plan.featured ? "featured" : ""}`}>
                  <div style={{ marginBottom: 4 }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase", letterSpacing: "0.05em", color: plan.featured ? "var(--amber)" : "var(--text2)" }}>
                      {plan.name}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>{plan.units}</p>
                  </div>
                  <div style={{ padding: "20px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", margin: "16px 0" }}>
                    <span className="display" style={{ fontSize: 36, color: "#fff" }}>{plan.price}</span>
                    <span style={{ fontSize: 12, color: "var(--text2)", display: "block", marginTop: 4 }}>{plan.period}</span>
                  </div>
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                    {plan.features.map((f) => (
                      <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text2)" }}>
                        <CheckCircle size={14} style={{ color: "var(--amber)", flexShrink: 0 }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" className={plan.featured ? "btn-primary" : "btn-ghost"} style={{ marginTop: 24, justifyContent: "center", textAlign: "center" }}>
                    Start free trial
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section style={{ background: "var(--ink2)", padding: "100px 24px", borderTop: "1px solid var(--border)" }}>
          <div ref={testimonialsRef} style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ marginBottom: 56 }}>
              <div className={`pill fade-up ${testimonialsInView ? "visible" : ""}`} style={{ marginBottom: 16 }}>From Our Users</div>
              <h2 className={`display fade-up d1 ${testimonialsInView ? "visible" : ""}`} style={{ fontSize: "clamp(32px, 4vw, 48px)", color: "#fff" }}>
                Landlords Love Housify
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {[
                { name: "Margaret W.", location: "Kilimani, Nairobi",   units: "34 units", quote: "I used to chase M-Pesa confirmations on WhatsApp. Now tenants log payments themselves and I verify in seconds. Game changer." },
                { name: "David M.",    location: "Westlands, Nairobi",  units: "12 units", quote: "The monthly PDF report is what sold me. I send it to my accountant and she has everything she needs — rent, expenses, net income." },
                { name: "Esther K.",   location: "Langata, Nairobi",    units: "8 units",  quote: "My tenants love their portal. They submit maintenance requests properly and I actually know what's broken before it gets expensive." },
              ].map((t, i) => (
                <div key={i} className={`testimonial fade-up d${i + 1} ${testimonialsInView ? "visible" : ""}`}>
                  <div style={{ display: "flex", gap: 3, marginBottom: 16 }}>
                    {[0,1,2,3,4].map((j) => <Star key={j} size={13} style={{ fill: "var(--amber)", color: "var(--amber)" }} />)}
                  </div>
                  <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7, fontWeight: 300, marginBottom: 20, fontStyle: "italic" }}>
                    {t.quote}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--amber)", fontSize: 14, fontWeight: 700 }}>
                      {t.name[0]}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{t.name}</p>
                      <p style={{ fontSize: 12, color: "var(--text2)" }}>{t.location} · {t.units}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="grid-bg" style={{ position: "relative", overflow: "hidden", padding: "100px 24px", textAlign: "center" }}>
          <div className="glow-amber" style={{ width: 500, height: 500, top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
          <div style={{ maxWidth: 640, margin: "0 auto", position: "relative" }}>
            <div className="pill" style={{ marginBottom: 24, justifyContent: "center" }}>Start Today</div>
            <h2 className="display" style={{ fontSize: "clamp(40px, 6vw, 72px)", color: "#fff", marginBottom: 20 }}>
              Your Properties.<br />
              <span style={{ color: "var(--amber)" }}>Under Control.</span>
            </h2>
            <p style={{ fontSize: 16, color: "var(--text2)", marginBottom: 36, lineHeight: 1.7, fontWeight: 300 }}>
              Join property managers across Nairobi who have replaced spreadsheets and WhatsApp with Housify KE.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/register" className="btn-primary" style={{ fontSize: 16, padding: "16px 36px" }}>
                Start Free Trial <ArrowRight size={18} />
              </Link>
              <Link href="/login" className="btn-ghost" style={{ fontSize: 16, padding: "16px 28px" }}>
                Sign In
              </Link>
            </div>
            <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 20 }}>
              14-day free trial · No credit card required · Cancel anytime
            </p>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#080c16", borderTop: "1px solid var(--border)", padding: "64px 24px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40, marginBottom: 48 }}>

            {/* Brand */}
            <div className="footer-brand">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, background: "var(--amber)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Building2 size={18} color="#000" />
                </div>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, textTransform: "uppercase", color: "#fff" }}>Housify KE</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, maxWidth: 300, fontWeight: 300, marginBottom: 20 }}>
                Smart property management software built for Kenyan landlords, property managers, and housing agents.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text2)" }}>
                  <MapPin size={14} style={{ color: "var(--amber)", flexShrink: 0 }} /> Nairobi, Kenya
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text2)" }}>
                  <Mail size={14} style={{ color: "var(--amber)", flexShrink: 0 }} />
                  <a href="mailto:hello@housify.co.ke" className="footer-link">hello@housify.co.ke</a>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text2)" }}>
                  <Globe size={14} style={{ color: "var(--amber)", flexShrink: 0 }} />
                  <a href="https://housify-chi.vercel.app" className="footer-link" target="_blank" rel="noopener noreferrer">housify-chi.vercel.app</a>
                </div>
              </div>
            </div>

            {/* Product */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text2)", marginBottom: 16 }}>Product</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Features",        href: "#features" },
                  { label: "Pricing",         href: "#pricing" },
                  { label: "How It Works",    href: "#how-it-works" },
                  { label: "Admin Dashboard", href: "/login" },
                  { label: "Tenant Portal",   href: "/login" },
                ].map((l) => <a key={l.label} href={l.href} className="footer-link">{l.label}</a>)}
              </div>
            </div>

            {/* For Landlords */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text2)", marginBottom: 16 }}>For Landlords</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Register Company", href: "/register" },
                  { label: "Sign In",          href: "/login" },
                  { label: "Invite Tenants",   href: "/login" },
                  { label: "Run Reports",      href: "/login" },
                  { label: "Track Expenses",   href: "/login" },
                ].map((l) => <a key={l.label} href={l.href} className="footer-link">{l.label}</a>)}
              </div>
            </div>

            {/* Legal */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text2)", marginBottom: 16 }}>Company</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "About",            href: "#" },
                  { label: "Privacy Policy",   href: "#" },
                  { label: "Terms of Service", href: "#" },
                  { label: "Cookie Policy",    href: "#" },
                  { label: "Contact Us",       href: "tel:0711378910" },
                ].map((l) => <a key={l.label} href={l.href} className="footer-link">{l.label}</a>)}
              </div>
            </div>
          </div>

          <hr className="divider" />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 24, flexWrap: "wrap", gap: 12 }}>
            <p style={{ fontSize: 12, color: "var(--text2)" }}>© {new Date().getFullYear()} Housify KE. All rights reserved.</p>
            <div style={{ display: "flex", gap: 20 }}>
              <a href="#" className="footer-link" style={{ fontSize: 12 }}>Privacy</a>
              <a href="#" className="footer-link" style={{ fontSize: 12 }}>Terms</a>
              <a href="tel:0711378910" className="footer-link" style={{ fontSize: 12 }}>Contact</a>
            </div>
            <p style={{ fontSize: 12, color: "var(--text2)" }}>Built with ❤️ for Kenyan property managers</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
