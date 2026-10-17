
import { NavLink } from "react-router-dom";
import { signOut } from "firebase/auth";

import { auth } from "../services/firebase";
import { useSidebar } from "../context/SidebarContext";

function SidebarIcon({ name, className = "h-5 w-5" }) {
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (name) {
    case "home":
      return (
        <svg {...props}>
          <path d="m3 10 9-7 9 7" />
          <path d="M5 9v12h14V9" />
          <path d="M9 21v-7h6v7" />
        </svg>
      );

    case "tasks":
      return (
        <svg {...props}>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V3h6v1" />
          <path d="M8 10h8M8 14h8M8 18h5" />
        </svg>
      );

    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
        </svg>
      );

    case "analytics":
      return (
        <svg {...props}>
          <path d="M4 20V4M4 20h17" />
          <rect x="7" y="12" width="3" height="5" rx="1" />
          <rect x="12" y="8" width="3" height="9" rx="1" />
          <rect x="17" y="5" width="3" height="12" rx="1" />
        </svg>
      );

    case "assistant":
      return (
        <svg {...props}>
          <rect x="4" y="7" width="16" height="13" rx="3" />
          <path d="M12 3v4M9 12h.01M15 12h.01M9 16h6" />
          <path d="M2 12h2M20 12h2" />
        </svg>
      );

    case "logout":
      return (
        <svg {...props}>
          <path d="M10 17l5-5-5-5M15 12H3" />
          <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
        </svg>
      );

    default:
      return null;
  }
}

function ChevronIcon({ collapsed }) {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {collapsed ? (
        <path d="m9 18 6-6-6-6" />
      ) : (
        <path d="m15 18-6-6 6-6" />
      )}
    </svg>
  );
}

export default function Sidebar() {
  const {
    open,
    setOpen,
    collapsed,
    setCollapsed,
  } = useSidebar();

  const menu = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: "home",
    },
    {
      name: "Tugas",
      path: "/tasks",
      icon: "tasks",
    },
    {
      name: "Planner",
      path: "/planner",
      icon: "calendar",
    },
    {
      name: "Analitik",
      path: "/analytics",
      icon: "analytics",
    },
    {
      name: "Asisten AI",
      path: "/ai",
      icon: "assistant",
    },
  ];

  async function logout() {
    try {
      await signOut(auth);
      window.location.href = "/";
    } catch (error) {
      console.error("Gagal keluar:", error);
      alert("Gagal keluar dari akun. Silakan coba lagi.");
    }
  }

  function toggleSidebar() {
    setCollapsed((previous) => !previous);
  }

  return (
    <>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex h-screen flex-col
          overflow-x-hidden
          border-r border-white/5
          bg-slate-950 py-5 text-white
          shadow-xl md:shadow-none
          transition-all duration-300 ease-in-out
          ${collapsed ? "w-20 px-3" : "w-64 px-4"}
          ${
            open
              ? "translate-x-0"
              : "-translate-x-full md:translate-x-0"
          }
        `}
      >
        {/* Header dan tombol collapse */}
        <div
          className={`
            mb-8 flex h-12 shrink-0 items-center
            ${collapsed ? "justify-between gap-1" : "justify-between gap-3"}
          `}
        >
          {collapsed ? (
            <span
              className="
                grid h-6 w-6 shrink-0 place-items-center
                rounded-md bg-blue-600/15
                text-[10px] font-extrabold tracking-tight
                text-blue-300
              "
              aria-label="StudyFlow"
              title="StudyFlow"
            >
              SF
            </span>
          ) : (
            <div className="min-w-0 whitespace-nowrap text-2xl font-extrabold tracking-tight">
              Study
              <span className="text-blue-400">Flow</span>
            </div>
          )}

          <button
            type="button"
            onClick={toggleSidebar}
            className={`
              grid shrink-0 place-items-center
              rounded-xl border border-white/10
              bg-white/5 text-slate-300
              transition-colors duration-200
              hover:bg-white/10 hover:text-white
              focus:outline-none focus:ring-2
              focus:ring-blue-400/60
              ${collapsed ? "h-7 w-7" : "h-9 w-9"}
            `}
            aria-label={
              collapsed ? "Perlebar sidebar" : "Ciutkan sidebar"
            }
            aria-expanded={!collapsed}
            title={
              collapsed ? "Perlebar sidebar" : "Ciutkan sidebar"
            }
          >
            <ChevronIcon collapsed={collapsed} />
          </button>
        </div>

        {/* Navigasi */}
        <nav className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden pb-4">
          {menu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              title={collapsed ? item.name : undefined}
              className={({ isActive }) =>
                [
                  "group flex min-h-12 items-center rounded-xl p-3",
                  "transition-colors duration-200",
                  collapsed ? "justify-center" : "gap-3",
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                    : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`
                      grid h-8 w-8 shrink-0 place-items-center
                      rounded-lg transition-colors
                      ${
                        isActive
                          ? "bg-white/15 text-white"
                          : "bg-white/[0.04] text-slate-300 group-hover:bg-white/10 group-hover:text-white"
                      }
                    `}
                  >
                    <SidebarIcon name={item.icon} />
                  </span>

                  {!collapsed && (
                    <span className="truncate text-sm font-medium">
                      {item.name}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          title={collapsed ? "Keluar" : undefined}
          className={`
            mt-auto flex min-h-12 w-full shrink-0
            items-center rounded-xl p-3
            text-rose-300
            ring-1 ring-inset ring-rose-400/15
            transition-colors duration-200
            hover:bg-rose-500/10 hover:text-rose-200
            ${collapsed ? "justify-center" : "gap-3"}
          `}
        >
          <SidebarIcon name="logout" />

          {!collapsed && (
            <span className="text-sm font-medium">
              Keluar
            </span>
          )}
        </button>
      </aside>
    </>
  );
}
