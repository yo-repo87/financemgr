import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/accounts", label: "Accounts" },
  { to: "/transactions", label: "Transactions" },
  { to: "/bills", label: "Bills" },
  { to: "/budgets", label: "Budgets" },
  { to: "/analytics", label: "Analytics" },
  { to: "/cashflow", label: "Cash Flow" },
  { to: "/goals", label: "Goals" },
  { to: "/advisor", label: "Advisor" },
  { to: "/settings", label: "Settings" },
];

// The 4 most-used sections get a bottom tab on phone; everything else lives
// behind "More" so tap targets stay comfortably above the ~44px minimum. Bills
// takes a primary slot (due-date tracking is exactly the kind of thing checked
// often on a phone) and Budgets moves into "More" to keep the tab bar at 5.
const tabLinks = [
  { to: "/", label: "Dashboard", icon: HomeIcon },
  { to: "/accounts", label: "Accounts", icon: BankIcon },
  { to: "/transactions", label: "Transactions", icon: ListIcon },
  { to: "/bills", label: "Bills", icon: TargetIcon },
];

const moreLinks = [
  { to: "/budgets", label: "Budgets" },
  { to: "/analytics", label: "Analytics" },
  { to: "/cashflow", label: "Cash Flow" },
  { to: "/goals", label: "Goals" },
  { to: "/advisor", label: "Advisor" },
  { to: "/settings", label: "Settings" },
];

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BankIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M3 10 12 4l9 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 10h16v2H4z" />
      <path d="M5 12v7M9.5 12v7M14.5 12v7M19 12v7" strokeLinecap="round" />
      <path d="M3 21h18" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </svg>
  );
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Desktop / tablet nav */}
      <header className="hidden lg:block border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-lg text-slate-900">FinanceMgr</span>
            <nav className="flex gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium ${
                      isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{user?.email}</span>
            <button onClick={() => logout()} className="text-slate-500 hover:text-slate-900">
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Phone header - status bar/notch aware, no nav (bottom tab bar owns that) */}
      <header className="lg:hidden border-b bg-white pt-[env(safe-area-inset-top)]">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-lg text-slate-900">FinanceMgr</span>
          <span className="text-xs text-slate-500 truncate max-w-[45%]">{user?.email}</span>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto max-w-6xl px-4 py-6 pb-24 lg:pb-6">
        <Outlet />
      </main>

      {/* Phone bottom tab bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t pb-[env(safe-area-inset-bottom)] z-20"
        aria-label="Primary"
      >
        <div className="grid grid-cols-5">
          {tabLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] text-[11px] font-medium ${
                  isActive ? "text-slate-900" : "text-slate-400"
                }`
              }
            >
              <l.icon className="w-6 h-6" />
              {l.label}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] text-[11px] font-medium text-slate-400"
          >
            <MoreIcon className="w-6 h-6" />
            More
          </button>
        </div>
      </nav>

      {/* "More" sheet - the rest of the nav plus account actions */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-30" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-xl border-t pb-[env(safe-area-inset-bottom)]">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b">
              <span className="text-sm text-slate-500">{user?.email}</span>
              <button onClick={() => setMoreOpen(false)} className="text-sm font-medium text-slate-900">
                Close
              </button>
            </div>
            <div className="py-2">
              {moreLinks.map((l) => (
                <button
                  key={l.to}
                  onClick={() => {
                    setMoreOpen(false);
                    navigate(l.to);
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 min-h-[44px]"
                >
                  {l.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setMoreOpen(false);
                  logout();
                }}
                className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-slate-50 min-h-[44px]"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
