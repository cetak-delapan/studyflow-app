import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";
import Sidebar from "../components/Sidebar";
import MobileNavbar from "../components/MobileNavbar";

const WELCOME = {
  id: "welcome",
  role: "assistant",
  content:
    "Hai! Aku StudyFlow Assistant. Aku bisa membantu membaca tugas dan jadwal belajarmu, menentukan prioritas berdasarkan deadline, serta merangkum progres yang tersimpan.",
};

const QUICK_PROMPTS = [
  "Tugas apa yang harus aku prioritaskan sekarang?",
  "Tampilkan jadwal belajarku yang akan datang.",
  "Tugas mana yang deadline-nya paling dekat atau sudah lewat?",
  "Bagaimana ringkasan progres tugas-tugasku?",
];

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [y, m, d] = String(value).split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value, options = {}) {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return "Tanggal belum tersedia";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  });
}

function daysUntil(value) {
  const target = parseDate(value);
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function deadlineLabel(task) {
  const days = daysUntil(task.deadline);
  if (days === null) return "deadline belum tersedia";
  if (days < 0) return `terlambat ${Math.abs(days)} hari`;
  if (days === 0) return "deadline hari ini";
  if (days === 1) return "deadline besok";
  return `${days} hari lagi`;
}

function sortByDeadline(a, b) {
  const aTime = parseDate(a.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bTime = parseDate(b.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
}

function taskList(items) {
  if (!items.length) return "Belum ada tugas yang cocok dengan kriteria tersebut.";
  return items.slice(0, 5).map((task, index) => {
    const progress = Math.max(0, Math.min(100, Number(task.progress) || 0));
    return `${index + 1}. ${task.title || "Tugas tanpa judul"}\n   Deadline: ${formatDate(task.deadline)} (${deadlineLabel(task)})\n   Progres: ${progress}% · Estimasi: ${Number(task.duration || 0)} jam`;
  }).join("\n\n");
}

function localReply(message, tasks, schedules) {
  const text = message.toLowerCase();
  const active = tasks.filter((task) => task.status === "pending").sort(sortByDeadline);
  const completed = tasks.filter((task) => task.status === "completed");
  const overdue = active.filter((task) => {
    const days = daysUntil(task.deadline);
    return days !== null && days < 0;
  });

  if (["jadwal", "sesi belajar", "waktu belajar"].some((word) => text.includes(word))) {
    const upcoming = schedules
      .filter((item) => item.date && item.date >= dateKey())
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) ||
        String(a.startTime || "").localeCompare(String(b.startTime || "")))
      .slice(0, 6);

    if (!upcoming.length) {
      return "Aku belum menemukan jadwal belajar mendatang yang tersimpan. Buka Study Planner, atur waktu belajar, lalu buat jadwal otomatis.";
    }

    return "Jadwal belajar mendatang yang tersimpan:\n\n" + upcoming.map((item, i) =>
      `${i + 1}. ${item.title || "Sesi belajar"}\n   ${formatDate(item.date, { weekday: "long" })} · ${item.startTime || "--:--"}–${item.endTime || "--:--"} · ${Number(item.duration || 0)} jam`
    ).join("\n\n") + "\n\nCatatan: ini jadwal yang direncanakan, bukan durasi belajar aktual.";
  }

  if (["progres", "progress", "perkembangan"].some((word) => text.includes(word))) {
    const average = tasks.length
      ? Math.round(tasks.reduce((sum, task) =>
          sum + Math.max(0, Math.min(100, Number(task.progress) || 0)), 0) / tasks.length)
      : 0;
    return `Ringkasan progres tugas:\n\nTotal tugas: ${tasks.length}\nBelum selesai: ${active.length}\nSelesai: ${completed.length}\nTerlambat: ${overdue.length}\nRata-rata progres: ${average}%\n\nRata-rata dihitung dari progres terakhir yang tersimpan pada setiap tugas, bukan dari jam belajar aktual.`;
  }

  if (["deadline", "terlambat", "prioritas", "harus aku kerjakan", "mulai dari mana", "tugas apa"].some((word) => text.includes(word))) {
    if (!active.length) return "Saat ini tidak ada tugas berstatus pending. Ringkasan ini mengikuti status tugas yang tersimpan di Firebase.";
    const upcoming = active.filter((task) => {
      const days = daysUntil(task.deadline);
      return days !== null && days >= 0;
    });
    let response = "";
    if (overdue.length) response += `Perlu perhatian: ${overdue.length} tugas sudah melewati deadline.\n\n${taskList(overdue)}\n\n`;
    response += `Prioritas berdasarkan deadline terdekat:\n\n${taskList(upcoming.length ? upcoming : active)}\n\nUrutan ini memakai deadline sebagai acuan utama. Periksa juga progres dan estimasi durasi sebelum menentukan rencana akhir.`;
    return response;
  }

  if (["bantu", "saran", "belajar", "rencana"].some((word) => text.includes(word))) {
    if (!active.length) return "Belum ada tugas aktif yang perlu dijadwalkan. Tambahkan tugas di halaman Tugas Saya, lalu atur waktu belajar di Study Planner.";
    const first = active[0];
    return `Langkah awal yang bisa kamu cek adalah "${first.title || "tugas dengan deadline terdekat"}" karena ${deadlineLabel(first)}.\n\n1. Pastikan estimasi durasinya realistis.\n2. Periksa progres terakhir yang tercatat.\n3. Cocokkan sisa pekerjaan dengan waktu yang tersedia di Planner.\n\nSaran ini berdasarkan data tugas yang tersimpan.`;
  }

  return "Aku bisa membantu membaca data tugas dan jadwal yang tersimpan. Coba tanyakan tentang prioritas tugas, deadline, jadwal belajar, atau progres tugas.\n\nPercakapan generatif dengan model AI sungguhan memerlukan endpoint backend AI yang belum tersedia di file proyek yang kamu kirim.";
}

function MetricCard({ label, value, alert = false }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
      <p className="text-xs font-medium leading-5 text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight ${alert ? "text-red-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

export default function AI() {
  const { user } = useAuth();
  const { collapsed } = useSidebar();
  const [tasks, setTasks] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [aiEndpointConnected, setAiEndpointConnected] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const activeTasks = useMemo(() => tasks.filter((task) => task.status === "pending"), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.status === "completed"), [tasks]);
  const overdueTasks = useMemo(() => activeTasks.filter((task) => {
    const days = daysUntil(task.deadline);
    return days !== null && days < 0;
  }), [activeTasks]);
  const nextDeadline = useMemo(() => [...activeTasks].sort(sortByDeadline)[0] || null, [activeTasks]);

  const loadContext = useCallback(async () => {
    if (!user) {
      setTasks([]);
      setSchedules([]);
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    setDataError("");
    try {
      const tasksQuery = query(collection(db, "tasks"), where("userId", "==", user.uid));
      const schedulesQuery = query(collection(db, "studySchedules"), where("userId", "==", user.uid));
      const [taskSnapshot, scheduleSnapshot] = await Promise.all([getDocs(tasksQuery), getDocs(schedulesQuery)]);
      setTasks(taskSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setSchedules(scheduleSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch (error) {
      console.error("Gagal memuat konteks StudyFlow Assistant:", error);
      setDataError("Data tugas atau jadwal gagal dimuat. Periksa koneksi lalu coba muat ulang.");
    } finally {
      setIsLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isSending]);

  async function sendMessage(value = input) {
    const message = String(value || "").trim();
    if (!message || isSending) return;

    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", content: message }]);
    setInput("");
    setIsSending(true);

    try {
      let reply = "";
      let connected = false;

      if (!user) {
        throw new Error("Sesi login tidak tersedia. Silakan login kembali.");
      }

      const idToken = await user.getIdToken();
      const history = messages
        .filter((item) => item.id !== "welcome" && (item.role === "user" || item.role === "assistant"))
        .slice(-10)
        .map((item) => ({ role: item.role, content: item.content }));

      // API key Gemini berada di backend Vercel. Frontend hanya mengirim token Firebase.
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          message,
          history,
          context: {
            tasks: tasks.slice(0, 30).map((task) => ({
              title: task.title || "",
              course: task.course || "",
              deadline: task.deadline || "",
              duration: Number(task.duration || 0),
              status: task.status || "",
              progress: Number(task.progress || 0),
              priority: task.priority || "",
            })),
            schedules: schedules.slice(0, 40).map((item) => ({
              title: item.title || "",
              taskId: item.taskId || "",
              date: item.date || "",
              startTime: item.startTime || "",
              endTime: item.endTime || "",
              duration: Number(item.duration || 0),
              status: item.status || "",
            })),
          },
        }),
      });

      const result = await response.json().catch(() => ({}));

      // npm run dev hanya menjalankan Vite, bukan Vercel Function.
      // Dalam kondisi lokal itu, tampilkan bantuan lokal sampai dijalankan dengan `npx vercel dev`.
      if (response.status === 404 && window.location.hostname === "localhost") {
        reply = localReply(message, tasks, schedules);
      } else if (!response.ok) {
        throw new Error(result.error || `Endpoint AI gagal (${response.status}).`);
      } else {
        reply = result.reply || result.response || result.message || "";
        if (!reply) throw new Error("Gemini mengembalikan jawaban kosong. Coba kirim ulang.");
        connected = true;
      }

      setAiEndpointConnected(connected);
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: "assistant", content: reply },
      ]);
    } catch (error) {
      console.error("Gagal memproses pesan StudyFlow AI:", error);
      setAiEndpointConnected(false);
      const isLocalNetworkIssue =
        error instanceof TypeError && window.location.hostname === "localhost";
      const errorMessage = isLocalNetworkIssue
        ? localReply(message, tasks, schedules)
        : `AI belum dapat menjawab: ${error.message || "terjadi kesalahan yang tidak diketahui"}`;
      setMessages((current) => [
        ...current,
        { id: `error-${Date.now()}`, role: "assistant", content: errorMessage },
      ]);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function submitMessage(event) {
    event.preventDefault();
    sendMessage();
  }

  function resetChat() {
    setMessages([WELCOME]);
    setInput("");
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-slate-50 text-slate-800">
      <Sidebar />
      <main className={`min-w-0 flex-1 px-4 pb-8 pt-5 transition-all duration-300 sm:px-6 lg:px-8 ${collapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        <MobileNavbar />

        <div className="mx-auto w-full max-w-7xl">
          <header className="mb-6 mt-5 flex flex-col gap-4 sm:mt-7 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Pendamping akademik</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">AI Assistant</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                Pahami prioritas tugas, deadline, dan rencana belajar dari data StudyFlow milikmu.
              </p>
            </div>
            <div className="flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-600 shadow-sm">
              <span className={`h-2 w-2 rounded-full ${aiEndpointConnected ? "bg-emerald-500" : "bg-blue-600"}`} />
              {aiEndpointConnected ? "Model AI terhubung" : "Konteks belajar aktif"}
            </div>
          </header>

          {dataError && (
            <div className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-amber-900">{dataError}</p>
              <button type="button" onClick={loadContext} className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">
                Muat ulang
              </button>
            </div>
          )}

          <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">SF</div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-slate-900">StudyFlow Assistant</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {isLoadingData ? "Memuat data belajarmu..." : `${activeTasks.length} tugas aktif · ${schedules.length} sesi tersimpan`}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={resetChat} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
                  Chat baru
                </button>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6" aria-live="polite">
                {messages.map((item) => (
                  <div key={item.id} className={`flex min-w-0 ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                    {item.role === "assistant" && (
                      <div className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600">SF</div>
                    )}
                    <div className={`min-w-0 max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[82%] ${item.role === "user" ? "rounded-br-md bg-blue-700 text-white" : "rounded-bl-md border border-slate-200 bg-slate-50 text-slate-700"}`}>
                      {item.content}
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600">SF</div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Sedang menyiapkan jawaban...</div>
                  </div>
                )}
              </div>

              {messages.length === 1 && (
                <div className="border-t border-slate-100 px-4 py-4 sm:px-6">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Coba tanyakan</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button key={prompt} type="button" disabled={isLoadingData || isSending} onClick={() => sendMessage(prompt)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm">
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={submitMessage} className="border-t border-slate-100 p-3 sm:p-4">
                <div className="flex min-w-0 items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        submitMessage(event);
                      }
                    }}
                    placeholder="Tanyakan tentang tugas atau jadwal belajarmu..."
                    rows={1}
                    maxLength={1500}
                    className="max-h-32 min-h-11 min-w-0 flex-1 resize-y border-0 bg-transparent px-2 py-3 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
                    aria-label="Tulis pesan untuk StudyFlow Assistant"
                  />
                  <button type="submit" disabled={!input.trim() || isSending || isLoadingData} className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                    Kirim
                  </button>
                </div>
                <p className="mt-2 px-1 text-[11px] leading-5 text-slate-400">Enter untuk mengirim · Shift + Enter untuk baris baru</p>
              </form>
            </section>

            <aside className="min-w-0 space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Ringkasan belajar</h2>
                    <p className="mt-1 text-sm text-slate-500">Berdasarkan data tersimpan.</p>
                  </div>
                  <button type="button" onClick={loadContext} disabled={isLoadingData} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
                    {isLoadingData ? "Memuat" : "Segarkan"}
                  </button>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <MetricCard label="Tugas aktif" value={activeTasks.length} />
                  <MetricCard label="Tugas selesai" value={completedTasks.length} />
                  <MetricCard label="Terlambat" value={overdueTasks.length} alert={overdueTasks.length > 0} />
                  <MetricCard label="Sesi tersimpan" value={schedules.length} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Deadline terdekat</h2>
                {isLoadingData ? (
                  <p className="mt-3 text-sm text-slate-500">Memuat tugas...</p>
                ) : nextDeadline ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="break-words text-sm font-semibold leading-5 text-slate-900">{nextDeadline.title || "Tugas tanpa judul"}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatDate(nextDeadline.deadline)}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${daysUntil(nextDeadline.deadline) < 0 ? "bg-red-50 text-red-700" : daysUntil(nextDeadline.deadline) === 0 ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-700"}`}>
                        {deadlineLabel(nextDeadline)}
                      </span>
                      <span className="text-xs text-slate-500">{Math.max(0, Math.min(100, Number(nextDeadline.progress) || 0))}% progres</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm leading-6 text-slate-500">Belum ada tugas aktif. Tugas baru akan muncul di sini setelah ditambahkan.</p>
                )}
                {nextDeadline && (
                  <button type="button" onClick={() => sendMessage("Tugas apa yang harus aku prioritaskan sekarang?")} disabled={isSending || isLoadingData} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50">
                    Bantu tentukan prioritas
                  </button>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Hal yang bisa dibantu</h2>
                <div className="mt-3 space-y-3">
                  <HelpItem title="Menentukan prioritas" description="Urutkan tugas berdasarkan deadline yang tersimpan." />
                  <HelpItem title="Memeriksa jadwal" description="Lihat sesi belajar yang sudah dibuat di Planner." />
                  <HelpItem title="Meringkas progres" description="Baca status dan progres tugas yang tercatat." />
                </div>
              </section>

              <p className="px-1 text-xs leading-5 text-slate-400">
                Saran lokal menggunakan data tugas dan jadwal tersimpan. Durasi belajar aktual tidak dapat disimpulkan jika belum dicatat.
              </p>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

function HelpItem({ title, description }) {
  return (
    <div className="border-l-2 border-blue-200 pl-3">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}
