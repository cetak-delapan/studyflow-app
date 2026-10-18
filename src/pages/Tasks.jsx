import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import MobileNavbar from "../components/MobileNavbar";
import TaskCard from "../components/TaskCard";

import {
  getDeadlinePriority,
  getPriorityMeta,
} from "../utils/taskPriority";

const EMPTY_TASK = {
  title: "",
  course: "",
  deadline: "",
  duration: "",
};

const inputClass =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

const labelClass = "mb-2 block text-sm font-medium text-slate-700";

function formatDate(dateValue) {
  if (!dateValue) return "-";

  const parts = String(dateValue).split("-").map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const [year, month, day] = parts;
    return new Date(year, month - 1, day).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Tasks() {
  const { collapsed } = useSidebar();
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const [editingTask, setEditingTask] = useState(null);
  const [task, setTask] = useState(EMPTY_TASK);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const newPriority = getDeadlinePriority(task.deadline);
  const newPriorityMeta = getPriorityMeta(newPriority);
  const editPriority = editingTask
    ? getDeadlinePriority(editingTask.deadline) || editingTask.priority || "Medium"
    : null;
  const editPriorityMeta = getPriorityMeta(editPriority);

  function showToast(type, message) {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToast({ type, message, id: Date.now() });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3500);
  }

  function closeAddModal() {
    if (isSaving) return;
    setIsAddModalOpen(false);
    setTask({ ...EMPTY_TASK });
  }

  useEffect(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!isAddModalOpen && !editingTask) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event) {
      if (event.key !== "Escape") return;
      if (isAddModalOpen && !isSaving) {
        setIsAddModalOpen(false);
        setTask({ ...EMPTY_TASK });
      }
      if (editingTask && !isUpdating) setEditingTask(null);
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isAddModalOpen, editingTask, isSaving, isUpdating]);

  async function fetchTasks(showLoading = true) {
    if (!user) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    if (showLoading) setIsLoading(true);

    try {
      const tasksQuery = query(
        collection(db, "tasks"),
        where("userId", "==", user.uid)
      );

      const snapshot = await getDocs(tasksQuery);
      const priorityUpdates = [];

      const data = snapshot.docs.map((item) => {
        const taskData = item.data();
        const priority = getDeadlinePriority(taskData.deadline) || "Medium";

        // Perbarui prioritas lama satu kali agar Smart Planner memakai nilai otomatis.
        if (taskData.priority !== priority) {
          priorityUpdates.push(
            updateDoc(doc(db, "tasks", item.id), { priority }).catch((error) => {
              console.warn(`Prioritas tugas ${item.id} belum dapat diperbarui:`, error);
            })
          );
        }

        return {
          id: item.id,
          ...taskData,
          priority,
        };
      });

      await Promise.all(priorityUpdates);

      data.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "pending" ? -1 : 1;
        }
        return String(a.deadline || "").localeCompare(String(b.deadline || ""));
      });

      setTasks(data);
    } catch (error) {
      console.error("Gagal memuat tugas:", error);
      showToast("error", "Tugas gagal dimuat. Periksa koneksi lalu coba lagi.");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      setTasks([]);
      fetchTasks();
    } else {
      setTasks([]);
      setIsLoading(false);
    }
    // fetchTasks sengaja dipanggil saat pengguna berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function handleChange(event) {
    const { name, value } = event.target;
    setTask((current) => ({ ...current, [name]: value }));
  }

  async function addTask(event) {
    event.preventDefault();

    if (!user) {
      showToast("error", "Silakan masuk terlebih dahulu untuk menyimpan tugas.");
      return;
    }

    const duration = Number(task.duration);
    const priority = getDeadlinePriority(task.deadline);

    if (
      !task.title.trim() ||
      !task.deadline ||
      !priority ||
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      showToast("warning", "Isi nama tugas, deadline yang valid, dan estimasi durasi lebih dari 0 jam.");
      return;
    }

    setIsSaving(true);

    try {
      await addDoc(collection(db, "tasks"), {
        title: task.title.trim(),
        course: task.course.trim(),
        deadline: task.deadline,
        duration,
        priority,
        userId: user.uid,
        status: "pending",
        progress: 0,
        createdAt: new Date(),
      });

      setTask({ ...EMPTY_TASK });
      setIsAddModalOpen(false);
      await fetchTasks(false);
      showToast("success", "Tugas berhasil disimpan.");
    } catch (error) {
      console.error("Gagal menambahkan tugas:", error);
      showToast("error", "Tugas gagal disimpan. Silakan coba lagi.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateProgress(id, value) {
    const progress = Math.max(0, Math.min(100, Number(value) || 0));

    try {
      await updateDoc(doc(db, "tasks", id), { progress });
      setTasks((current) =>
        current.map((item) => (item.id === id ? { ...item, progress } : item))
      );
    } catch (error) {
      console.error("Gagal memperbarui progress:", error);
      showToast("error", "Progress gagal diperbarui. Silakan coba lagi.");
    }
  }

  async function deleteTask(id) {
    const confirmed = window.confirm(
      "Hapus tugas ini? Tindakan ini tidak dapat dibatalkan."
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "tasks", id));
      setTasks((current) => current.filter((item) => item.id !== id));
      showToast("success", "Tugas berhasil dihapus.");
    } catch (error) {
      console.error("Gagal menghapus tugas:", error);
      showToast("error", "Tugas gagal dihapus. Silakan coba lagi.");
    }
  }

  async function completeTask(id) {
    try {
      await updateDoc(doc(db, "tasks", id), {
        status: "completed",
        progress: 100,
      });

      setTasks((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status: "completed", progress: 100 } : item
        )
      );
      showToast("success", "Tugas ditandai selesai.");
    } catch (error) {
      console.error("Gagal menyelesaikan tugas:", error);
      showToast("error", "Status tugas gagal diperbarui. Silakan coba lagi.");
    }
  }

  function editTask(selectedTask) {
    setEditingTask({
      ...selectedTask,
      title: selectedTask.title || "",
      course: selectedTask.course || "",
      deadline: selectedTask.deadline || "",
      duration: String(selectedTask.duration ?? ""),
      progress: Number(selectedTask.progress || 0),
    });
  }

  async function updateTask(event) {
    event.preventDefault();
    if (!editingTask) return;

    const duration = Number(editingTask.duration);
    const progress = Math.max(0, Math.min(100, Number(editingTask.progress) || 0));
    const priority = getDeadlinePriority(editingTask.deadline);

    if (
      !editingTask.title.trim() ||
      !editingTask.deadline ||
      !priority ||
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      showToast("warning", "Isi nama tugas, deadline yang valid, dan estimasi durasi lebih dari 0 jam.");
      return;
    }

    setIsUpdating(true);

    try {
      const updatedFields = {
        title: editingTask.title.trim(),
        course: (editingTask.course || "").trim(),
        deadline: editingTask.deadline,
        duration,
        priority,
        progress,
      };

      await updateDoc(doc(db, "tasks", editingTask.id), updatedFields);

      setTasks((current) =>
        current.map((item) =>
          item.id === editingTask.id ? { ...item, ...updatedFields } : item
        )
      );

      setEditingTask(null);
      showToast("success", "Perubahan tugas berhasil disimpan.");
    } catch (error) {
      console.error("Gagal memperbarui tugas:", error);
      showToast("error", "Perubahan tugas gagal disimpan. Silakan coba lagi.");
    } finally {
      setIsUpdating(false);
    }
  }

  const pendingTasks = tasks.filter((item) => item.status === "pending");
  const completedTasks = tasks.filter((item) => item.status === "completed");
  const filteredTasks = tasks.filter((item) => item.status === filter);

  return (
    <div className="min-h-screen overflow-x-clip bg-slate-50 text-slate-800">
      <Sidebar />

      <main
        className={`min-w-0 flex-1 px-4 py-5 transition-all duration-300 sm:px-6 sm:py-6 lg:px-8 lg:py-8 ${
          collapsed ? "md:ml-20" : "md:ml-64"
        }`}
      >
        <MobileNavbar />

        <section className="mx-auto w-full max-w-[1600px]">
          {/* Header halaman */}
          <header className="mb-7 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-blue-700">
                Manajemen akademik
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Tugas Saya
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                Atur tugas, pantau progres, dan pastikan setiap deadline tetap terkontrol.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <div className="inline-flex w-fit items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
                {tasks.length} tugas tersimpan
              </div>
              <button
                type="button"
                onClick={() => {
                  setTask({ ...EMPTY_TASK });
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-700/15"
              >
                <span aria-hidden="true" className="text-lg leading-none">+</span>
                Tambah tugas
              </button>
            </div>
          </header>

          {/* Ringkasan */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="Total tugas" value={tasks.length} detail="Semua tugas" />
            <SummaryCard label="Belum selesai" value={pendingTasks.length} detail="Masih perlu dikerjakan" />
            <SummaryCard label="Selesai" value={completedTasks.length} detail="Sudah dituntaskan" />
          </div>

          {/* Daftar tugas menggunakan lebar penuh */}
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
            <div className="mb-5 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Daftar tugas</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filter === "pending"
                    ? "Tugas yang masih perlu dikerjakan, diurutkan berdasarkan deadline."
                    : "Tugas yang sudah kamu selesaikan."}
                </p>
              </div>

              <div className="grid w-full grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1 lg:w-auto">
                <button
                  type="button"
                  onClick={() => setFilter("pending")}
                  aria-pressed={filter === "pending"}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition sm:px-5 ${
                    filter === "pending"
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Belum selesai <span className="ml-1 text-xs">{pendingTasks.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("completed")}
                  aria-pressed={filter === "completed"}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition sm:px-5 ${
                    filter === "completed"
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Selesai <span className="ml-1 text-xs">{completedTasks.length}</span>
                </button>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              {isLoading ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center">
                  <p className="text-sm font-medium text-slate-600">Memuat tugas...</p>
                  <p className="mt-1 text-sm text-slate-400">Sebentar, data sedang disiapkan.</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    {filter === "pending" ? "Belum ada tugas aktif" : "Belum ada tugas selesai"}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    {filter === "pending"
                      ? "Tambahkan tugas menggunakan tombol “Tambah tugas”."
                      : "Tugas yang kamu tandai selesai akan muncul di sini."}
                  </p>
                </div>
              ) : (
                filteredTasks.map((item) => (
                  <TaskCard
                    key={item.id}
                    task={item}
                    onDelete={deleteTask}
                    onComplete={completeTask}
                    onEdit={editTask}
                    onProgress={updateProgress}
                  />
                ))
              )}
            </div>
          </section>
        </section>
      </main>

      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAddModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-task-modal-title"
            className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Manajemen akademik</p>
                <h2 id="add-task-modal-title" className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">Tambah tugas</h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">Isi detail tugas. Prioritas dihitung otomatis dari deadline.</p>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                disabled={isSaving}
                aria-label="Tutup formulir tambah tugas"
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={addTask} className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0 sm:col-span-2">
                  <label htmlFor="task-title" className={labelClass}>
                    Nama tugas <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="task-title"
                    name="title"
                    value={task.title}
                    onChange={handleChange}
                    placeholder="Contoh: Laporan Basis Data"
                    className={inputClass}
                    maxLength={120}
                    autoFocus
                    required
                  />
                </div>

                <div className="min-w-0">
                  <label htmlFor="task-course" className={labelClass}>Mata kuliah</label>
                  <input
                    id="task-course"
                    name="course"
                    value={task.course}
                    onChange={handleChange}
                    placeholder="Contoh: Sistem Informasi"
                    className={inputClass}
                    maxLength={100}
                  />
                </div>

                <div className="min-w-0">
                  <label htmlFor="task-deadline" className={labelClass}>
                    Deadline <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="task-deadline"
                    type="date"
                    name="deadline"
                    value={task.deadline}
                    onChange={handleChange}
                    className={inputClass}
                    required
                  />
                </div>

                <div className="min-w-0 sm:col-span-2">
                  <label htmlFor="task-duration" className={labelClass}>
                    Estimasi pengerjaan (jam) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="task-duration"
                    type="number"
                    name="duration"
                    value={task.duration}
                    onChange={handleChange}
                    placeholder="Contoh: 3.5"
                    min="0.25"
                    step="0.25"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prioritas otomatis</p>
                {newPriorityMeta ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${newPriorityMeta.className}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${newPriorityMeta.dotClassName}`} />
                      {newPriorityMeta.label}
                    </span>
                    <span className="text-xs leading-5 text-slate-500">{newPriorityMeta.description}</span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Pilih tanggal deadline untuk melihat prioritas tugas.</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-700/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Menyimpan..." : "Simpan tugas"}
                </button>
                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={isSaving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Batal
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isUpdating) setEditingTask(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-task-title"
            className="my-auto max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 id="edit-task-title" className="text-xl font-semibold text-slate-900">Edit tugas</h2>
                <p className="mt-1 text-sm text-slate-500">Perbarui detail tugas. Prioritas mengikuti deadline.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                disabled={isUpdating}
                aria-label="Tutup formulir edit"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={updateTask} className="space-y-4">
              <div>
                <label htmlFor="edit-task-title-input" className={labelClass}>
                  Nama tugas <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-task-title-input"
                  value={editingTask.title}
                  onChange={(event) => setEditingTask({ ...editingTask, title: event.target.value })}
                  className={inputClass}
                  maxLength={120}
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-task-course" className={labelClass}>Mata kuliah</label>
                <input
                  id="edit-task-course"
                  value={editingTask.course}
                  onChange={(event) => setEditingTask({ ...editingTask, course: event.target.value })}
                  className={inputClass}
                  maxLength={100}
                />
              </div>

              <div>
                <label htmlFor="edit-task-deadline" className={labelClass}>
                  Deadline <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-task-deadline"
                  type="date"
                  value={editingTask.deadline}
                  onChange={(event) => setEditingTask({ ...editingTask, deadline: event.target.value })}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-task-duration" className={labelClass}>
                  Estimasi pengerjaan (jam) <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-task-duration"
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={editingTask.duration}
                  onChange={(event) => setEditingTask({ ...editingTask, duration: event.target.value })}
                  className={inputClass}
                  required
                />
              </div>

              {editPriorityMeta && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prioritas otomatis</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${editPriorityMeta.className}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${editPriorityMeta.dotClassName}`} />
                      {editPriorityMeta.label}
                    </span>
                    <span className="text-xs text-slate-500">{editPriorityMeta.description}</span>
                  </div>
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="edit-task-progress" className={`${labelClass} mb-0`}>Progress</label>
                  <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-700">
                    {Math.max(0, Math.min(100, Number(editingTask.progress) || 0))}%
                  </span>
                </div>
                <input
                  id="edit-task-progress"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.max(0, Math.min(100, Number(editingTask.progress) || 0))}
                  onChange={(event) => setEditingTask({ ...editingTask, progress: Number(event.target.value) })}
                  className="w-full cursor-pointer accent-blue-700"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-700/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUpdating ? "Menyimpan..." : "Simpan perubahan"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  disabled={isUpdating}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Batal
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none fixed right-4 top-4 z-[70] w-[calc(100%-2rem)] max-w-sm sm:right-6 sm:top-6">
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-4 shadow-lg ${
              toast.type === "success"
                ? "border-emerald-200"
                : toast.type === "warning"
                  ? "border-amber-200"
                  : "border-red-200"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                toast.type === "success"
                  ? "bg-emerald-100 text-emerald-700"
                  : toast.type === "warning"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {toast.type === "success" ? "✓" : toast.type === "warning" ? "!" : "×"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                {toast.type === "success" ? "Berhasil" : toast.type === "warning" ? "Periksa kembali" : "Gagal"}
              </p>
              <p className="mt-0.5 break-words text-sm leading-5 text-slate-600">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Tutup notifikasi"
              className="-mr-1 -mt-1 rounded-md px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, detail }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}
