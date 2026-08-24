import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/accounts", label: "Accounts" },
  { to: "/transactions", label: "Transactions" },
  { to: "/budgets", label: "Budgets" },
  { to: "/analytics", label: "Analytics" },
  { to: "/advisor", label: "Advisor" },
  { to: "/settings", label: "Settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white">
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
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
