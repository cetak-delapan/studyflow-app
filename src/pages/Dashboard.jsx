import { useState, useEffect } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import MobileNavbar from "../components/MobileNavbar";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";

// Mendukung deadline berbentuk string, Date, atau Firestore Timestamp.
function getDeadlineDate(deadline) {
  if (!deadline) return null;

  if (typeof deadline.toDate === "function") {
    return deadline.toDate();
  }

  if (deadline instanceof Date) {
    return Number.isNaN(deadline.getTime()) ? null : deadline;
  }

  const date =
    typeof deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(deadline)
      ? new Date(`${deadline}T00:00:00`)
      : new Date(deadline);

  return Number.isNaN(date.getTime()) ? null : date;
}

export default function Dashboard() {
  const { collapsed } = useSidebar();
  const { user } = useAuth();

  const [activeTasks, setActiveTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [nearestDeadline, setNearestDeadline] = useState(null);

  useEffect(() => {
    if (!user) {
      setActiveTasks(0);
      setCompletedTasks(0);
      setTotalHours(0);
      setNearestDeadline(null);
      return undefined;
    }

    const tasksQuery = query(
      collection(db, "tasks"),
      where("userId", "==", user.uid)
    );

    // Listener realtime supaya perubahan status tugas langsung diperbarui.
    const unsubscribe = onSnapshot(
      tasksQuery,
      (snapshot) => {
        const tasks = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        const pendingTasks = tasks.filter(
          (item) => item.status === "pending"
        );

        const completed = tasks.filter(
          (item) => item.status === "completed"
        ).length;

        const hours = tasks.reduce(
          (total, item) => total + Number(item.duration || 0),
          0
        );

        // Hanya tugas pending yang memiliki deadline valid yang ditampilkan.
        const sortedPendingTasks = pendingTasks
          .filter((item) => getDeadlineDate(item.deadline) !== null)
          .sort((a, b) => {
            return (
              getDeadlineDate(a.deadline).getTime() -
              getDeadlineDate(b.deadline).getTime()
            );
          });

        setActiveTasks(pendingTasks.length);
        setCompletedTasks(completed);
        setTotalHours(hours);
        setNearestDeadline(sortedPendingTasks[0] || null);
      },
      (error) => {
        console.error("Gagal memuat dashboard:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const deadlineDate = getDeadlineDate(nearestDeadline?.deadline);

  const formattedDeadline = deadlineDate
    ? deadlineDate.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar />

      <main
        className={`
          min-h-screen min-w-0
          px-4 py-5
          sm:px-6 sm:py-6
          lg:px-8 lg:py-8
          transition-all duration-300
          ${collapsed ? "md:ml-20" : "md:ml-64"}
        `}
      >
        <MobileNavbar />
        <Navbar />

        {/* Statistik */}
        <section
          aria-label="Statistik tugas"
          className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-5 h-1 w-10 rounded-full bg-blue-600" />
            <p className="text-sm font-medium text-slate-500">Tugas Aktif</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {activeTasks}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Tugas yang belum selesai
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-5 h-1 w-10 rounded-full bg-blue-600" />
            <p className="text-sm font-medium text-slate-500">Total Durasi</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {totalHours} Jam
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Akumulasi estimasi waktu tugas
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-5 h-1 w-10 rounded-full bg-blue-600" />
            <p className="text-sm font-medium text-slate-500">Tugas Selesai</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {completedTasks}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Tugas yang sudah diselesaikan
            </p>
          </div>
        </section>

        {/* Deadline dan AI */}
        <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
          {/* Deadline Terdekat */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                  Deadline Terdekat
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Tenggat terdekat dari tugas yang belum selesai
                </p>
              </div>

              <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                DEADLINE
              </span>
            </div>

            {nearestDeadline ? (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-lg font-bold text-slate-900">
                  {nearestDeadline.title || "Tanpa judul"}
                </p>

                <p className="mt-2 text-sm text-slate-500">Mata Kuliah</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {nearestDeadline.course || "-"}
                </p>

                <div className="mt-5 border-t border-slate-200 pt-4">
                  <p className="text-sm text-slate-500">
                    Tenggat pengumpulan
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formattedDeadline}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                <p className="font-semibold text-slate-700">
                  Tidak ada deadline tugas aktif
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Semua tugas sudah selesai, atau belum ada tugas yang memiliki
                  deadline valid.
                </p>
              </div>
            )}
          </div>

          {/* StudyFlow AI */}
          <div className="rounded-2xl border border-slate-200 border-l-4 border-l-blue-600 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50">
                <span className="text-sm font-bold tracking-tight text-blue-700">
                  AI
                </span>
              </div>

              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                  StudyFlow AI
                </h2>
                <p className="mt-1 text-sm text-slate-500">Asisten belajar</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="font-semibold text-slate-800">
                Rekomendasi belajar
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Belum ada rekomendasi. Tambahkan tugas untuk mendapatkan
                analisis dan saran pengelolaan waktu belajar.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
