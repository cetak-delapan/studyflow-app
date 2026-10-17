import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import MobileNavbar from "../components/MobileNavbar";
import { useSidebar } from "../context/SidebarContext";

export default function Analytics() {
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <main
        className={`min-w-0 flex-1 p-4 transition-all duration-300 sm:p-6 lg:p-8 ${
          collapsed ? "lg:ml-20" : "lg:ml-64"
        }`}
      >
        <MobileNavbar />
        <Navbar />

        <section className="mx-auto mt-8 w-full max-w-5xl">
          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Analitik
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Pantau progres dan kebiasaan belajarmu di StudyFlow.
            </p>
          </header>

          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm sm:px-8">
            <div className="max-w-md">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                Halaman sedang dalam tahap pengembangan.
              </h2>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
