export default function ScheduleCard({ schedule }) {
  function formatDate(date) {
    if (!date) {
      return "-";
    }

    return new Date(date).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:border-slate-300 hover:shadow-md sm:p-6">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
            Sesi belajar
          </p>
          <h3 className="mt-2 break-words text-lg font-bold leading-6 text-slate-900">
            {schedule.title}
          </h3>
          {schedule.course && (
            <p className="mt-1 break-words text-sm leading-5 text-slate-500">
              {schedule.course}
            </p>
          )}
        </div>

        <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
          <p className="text-xs font-medium text-slate-500">Durasi</p>
          <p className="mt-1 whitespace-nowrap text-lg font-bold tabular-nums text-slate-900">
            {schedule.duration ? `${schedule.duration} jam` : "-"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <div className="min-w-0 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Tanggal
          </p>
          <p className="mt-1 break-words text-sm font-medium leading-6 text-slate-700">
            {formatDate(schedule.date)}
          </p>
        </div>

        <div className="min-w-0 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Waktu belajar
          </p>
          <p className="mt-1 break-words text-sm font-semibold tabular-nums leading-6 text-slate-800">
            {schedule.startTime || "-"} - {schedule.endTime || "-"}
          </p>
        </div>
      </div>
    </article>
  );
}
