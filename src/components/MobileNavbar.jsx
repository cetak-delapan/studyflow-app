
import { useSidebar } from "../context/SidebarContext";

export default function MobileNavbar() {
  const { setOpen } = useSidebar();

  return (
    <div
      className="
        mb-5 flex items-center justify-between
        rounded-2xl border border-slate-200
        bg-white px-4 py-3
        text-slate-800 shadow-sm
        md:hidden
      "
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          grid h-10 w-10 place-items-center
          rounded-xl border border-slate-200
          text-slate-700 transition
          hover:bg-slate-50
          focus:outline-none focus:ring-2
          focus:ring-blue-500/40
        "
        aria-label="Buka menu navigasi"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="text-lg font-extrabold tracking-tight">
        Study<span className="text-blue-600">Flow</span>
      </div>

      <div
        className="
          grid h-10 w-10 place-items-center
          rounded-xl bg-slate-100 text-slate-600
        "
        aria-hidden="true"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      </div>
    </div>
  );
}
