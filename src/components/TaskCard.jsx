import { getDeadlinePriority, getPriorityMeta } from "../utils/taskPriority";

function formatDeadline(dateValue) {
  if (!dateValue) return "Belum ditentukan";

  const parts = String(dateValue).split("-").map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const [year, month, day] = parts;
    return new Date(year, month - 1, day).toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak valid";

  return date.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function TaskCard({ task, onComplete, onDelete, onEdit, onProgress }) {
  const progress = Math.max(0, Math.min(100, Number(task.progress) || 0));
  const duration = Math.max(0, Number(task.duration) || 0);
  const remainingHours = Math.max(0, duration * (1 - progress / 100));
  const isCompleted = task.status === "completed";
  const isOverdue = !isCompleted && task.deadline && task.deadline < getLocalDateString();

  // Prioritas selalu dihitung dari deadline, bukan dari pilihan manual.
  const priority = getDeadlinePriority(task.deadline) || task.priority || "Medium";
  const priorityMeta = getPriorityMeta(priority) || getPriorityMeta("Medium");

  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 transition duration-200 hover:border-slate-300 hover:shadow-sm sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-base font-semibold leading-6 text-slate-900 sm:text-lg">
              {task.title || "Tugas tanpa judul"}
            </h3>
            {isCompleted && (
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                Selesai
              </span>
            )}
            {isOverdue && (
              <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                Terlambat
              </span>
            )}
          </div>
          <p className="mt-1 break-words text-sm text-slate-500">
            {task.course?.trim() || "Mata kuliah belum diisi"}
          </p>
        </div>

        <span className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${priorityMeta.className}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${priorityMeta.dotClassName}`} />
          Prioritas {priorityMeta.label.toLowerCase()}
        </span>
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-lg bg-slate-50 px-3.5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Deadline</p>
          <p className={`mt-1 break-words text-sm font-semibold ${isOverdue ? "text-red-700" : "text-slate-800"}`}>
            {formatDeadline(task.deadline)}
          </p>
        </div>
        <div className="min-w-0 rounded-lg bg-slate-50 px-3.5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Estimasi pengerjaan</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {duration.toLocaleString("id-ID", { maximumFractionDigits: 2 })} jam
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700">Progress penyelesaian</p>
          <p className="shrink-0 text-sm font-semibold tabular-nums text-blue-700">{progress}%</p>
        </div>

        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label={`Progress ${task.title || "tugas"}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${isCompleted ? "bg-emerald-600" : "bg-blue-700"}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>{isCompleted ? "Tugas sudah dituntaskan" : "Geser untuk memperbarui progress"}</span>
          <span className="font-medium text-slate-600">
            Sisa {remainingHours.toLocaleString("id-ID", { maximumFractionDigits: 2 })} jam
          </span>
        </div>
      </div>

      {!isCompleted && (
        <div className="mt-3">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={progress}
            onChange={(event) => onProgress(task.id, Number(event.target.value))}
            aria-label={`Ubah progress ${task.title || "tugas"}`}
            className="w-full cursor-pointer accent-blue-700"
          />
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200"
        >
          Edit tugas
        </button>

        {!isCompleted && (
          <button
            type="button"
            onClick={() => onComplete(task.id)}
            className="rounded-lg bg-blue-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-700/15"
          >
            Tandai selesai
          </button>
        )}

        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-100"
        >
          Hapus tugas
        </button>
      </div>
    </article>
  );
}
