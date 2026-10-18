import { useCallback, useEffect, useMemo, useState } from "react";

import { collection, getDocs, query, where } from "firebase/firestore";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import MobileNavbar from "../components/MobileNavbar";

import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";

import { db } from "../services/firebase";

import { buildAnalytics } from "../utils/analyticsEngine";


// ==========================
// FORMAT
// ==========================

const numberFormat = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2
});

const fmt = value => numberFormat.format(value);

const fmtHours = value => `${fmt(value)} jam`;

const fmtPct = value =>
  value === null || value === undefined ? "–" : `${fmt(value)}%`;

function fmtDate(dateStr, options) {
  if (!dateStr) return "–";

  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(
    "id-ID",
    options || { day: "numeric", month: "short", year: "numeric" }
  );
}

function weekLabel(start, end) {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);

  const month = d => d.toLocaleDateString("id-ID", { month: "short" });

  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${month(b)}`
    : `${a.getDate()} ${month(a)}–${b.getDate()} ${month(b)}`;
}

// batas atas sumbu yang rapi (1, 2, 3, 4, 5, 6, 8, 10 × pangkat sepuluh)
function niceMax(value) {
  if (value <= 0) return 4;

  const pow = 10 ** Math.floor(Math.log10(value));

  const step = [1, 2, 3, 4, 5, 6, 8, 10].find(s => s * pow >= value - 1e-9);

  return step * pow;
}


// ==========================
// KOMPONEN DASAR
// ==========================

function Card({ eyebrow, title, description, children, className = "" }) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <header>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        )}
      </header>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function SubHeading({ children }) {
  return <h3 className="text-sm font-semibold text-slate-800">{children}</h3>;
}

function StatTile({ label, value, unit, note }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        {value}
        {unit && (
          <span className="ml-1 text-lg font-semibold text-slate-500">
            {unit}
          </span>
        )}
      </p>
      {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
    </div>
  );
}

function MiniStat({ label, value, note }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

function EmptyNote({ children }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm leading-6 text-slate-500">
      {children}
    </p>
  );
}

function Note({ children }) {
  return (
    <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
      {children}
    </p>
  );
}

const TONES = {
  blue: { fill: "bg-blue-600", track: "bg-blue-100" },
  amber: { fill: "bg-amber-500", track: "bg-amber-100" },
  red: { fill: "bg-red-500", track: "bg-red-100" }
};

// meter: isi membawa tingkat keparahan, trek memakai langkah lebih terang dari hue yang sama
function Meter({ value, label, tone = "blue" }) {
  const pct = Math.min(Math.max(Number(value) || 0, 0), 100);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={`h-2 w-full overflow-hidden rounded-full ${TONES[tone].track}`}
    >
      <div
        className={`h-full rounded-r ${TONES[tone].fill}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Badge({ tone, glyph, children }) {
  const styles = {
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    slate: "bg-slate-100 text-slate-600"
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${styles[tone]}`}
    >
      {glyph && <span aria-hidden="true">{glyph}</span>}
      {children}
    </span>
  );
}

function DataTable({ columns, rows }) {
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-xs font-semibold text-blue-700 hover:text-blue-800">
        Lihat sebagai tabel
      </summary>

      <div className="mt-2 min-w-0">
        <table className="w-full table-fixed text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">
              {columns.map(column => (
                <th key={column} className="break-words py-2 pr-2 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 text-slate-700">
                {row.map((cell, j) => (
                  <td key={j} className="break-words py-2 pr-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// daftar batang horizontal: nilai di ujung batang, tabel sebagai pasangan
function BarList({ items, valueHeader = "Nilai", max }) {
  const top = max ?? Math.max(1, ...items.map(item => item.value));

  return (
    <div>
      <ul className="space-y-3">
        {items.map(item => (
          <li
            key={item.key}
            title={`${item.label}: ${item.display}`}
            className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3.5rem] items-center gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_4rem]"
          >
            <span className="break-words text-sm leading-5 text-slate-700">
              {item.label}
            </span>

            <span className="h-3 rounded-r bg-slate-100">
              {item.value > 0 && (
                <span
                  className={`block h-full rounded-r ${item.fill || "bg-blue-600"}`}
                  style={{
                    width: `${Math.max(2, (item.value / top) * 100)}%`
                  }}
                />
              )}
            </span>

            <span className="text-right text-sm font-semibold text-slate-900">
              {item.display}
            </span>
          </li>
        ))}
      </ul>

      <DataTable
        columns={["Kategori", valueHeader]}
        rows={items.map(item => [item.label, item.display])}
      />
    </div>
  );
}

// kolom ringkas untuk hitungan per periode (mis. tugas selesai per minggu)
function CountColumns({ items, valueHeader, caption }) {
  const top = Math.max(1, ...items.map(item => item.value));

  return (
    <div>
      <div className="flex h-28 items-end gap-2 border-b border-slate-200">
        {items.map(item => (
          <div
            key={item.key}
            role="img"
            aria-label={`${item.label}: ${item.display}`}
            title={`${item.label}: ${item.display}`}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          >
            {item.value > 0 && (
              <>
                <span className="text-xs font-semibold text-slate-900">
                  {item.display}
                </span>
                <div
                  className="w-5 rounded-t bg-blue-600"
                  style={{
                    height: `calc((100% - 20px) * ${item.value / top})`
                  }}
                />
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2 text-center text-[10px] leading-4 text-slate-500">
        {items.map(item => (
          <span key={item.key} className="flex-1">
            {item.shortLabel}
          </span>
        ))}
      </div>

      {caption && <p className="mt-2 text-xs text-slate-500">{caption}</p>}

      <DataTable
        columns={["Minggu", valueHeader]}
        rows={items.map(item => [item.label, item.display])}
      />
    </div>
  );
}

// kolom 4 minggu: jam terjadwal (batang) vs kapasitas (garis), satu sumbu
function WeekChart({ weeks }) {
  const max = niceMax(
    Math.max(0, ...weeks.map(w => Math.max(w.plannedHours, w.capacityHours)))
  );

  const ticks = [max, max / 2, 0];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
          Jam terjadwal
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 bg-slate-500" />
          Waktu belajar tersedia
        </span>
      </div>

      <div className="mt-4 flex gap-3 pt-5">
        <div className="relative h-40 w-8 shrink-0 text-[11px] text-slate-400">
          {ticks.map(tick => (
            <span
              key={tick}
              className="absolute right-0 translate-y-1/2"
              style={{ bottom: `${(tick / max) * 100}%` }}
            >
              {fmt(tick)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-40">
            {ticks.map(tick => (
              <div
                key={tick}
                className="absolute inset-x-0 border-t border-slate-200"
                style={{ bottom: `${(tick / max) * 100}%` }}
              />
            ))}

            <div className="relative grid h-full grid-cols-4 gap-3">
              {weeks.map(week => {
                const label = weekLabel(week.start, week.end);

                const summary = `${label}: terjadwal ${fmtHours(week.plannedHours)}, tersedia ${fmtHours(week.capacityHours)}`;

                return (
                  <div
                    key={week.start}
                    role="img"
                    aria-label={summary}
                    title={summary}
                    className="relative h-full"
                  >
                    {week.plannedHours > 0 && (
                      <>
                        <div
                          className="absolute bottom-0 left-1/2 w-6 -translate-x-1/2 rounded-t bg-blue-600"
                          style={{
                            height: `${(week.plannedHours / max) * 100}%`
                          }}
                        />
                        <span
                          className="absolute left-1/2 -translate-x-1/2 bg-white px-0.5 text-xs font-semibold text-slate-900"
                          style={{
                            bottom: `calc(${(week.plannedHours / max) * 100}% + 4px)`
                          }}
                        >
                          {fmt(week.plannedHours)}
                        </span>
                      </>
                    )}

                    {week.capacityHours > 0 && (
                      <div
                        className="absolute inset-x-0 border-t-2 border-slate-500"
                        style={{
                          bottom: `${(week.capacityHours / max) * 100}%`
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 grid grid-cols-4 gap-3 text-center text-xs text-slate-500">
            {weeks.map(week => (
              <span key={week.start}>{weekLabel(week.start, week.end)}</span>
            ))}
          </div>
        </div>
      </div>

      <DataTable
        columns={["Minggu", "Terjadwal", "Tersedia", "Terpakai"]}
        rows={weeks.map(week => [
          weekLabel(week.start, week.end),
          fmtHours(week.plannedHours),
          fmtHours(week.capacityHours),
          fmtPct(week.utilization)
        ])}
      />
    </div>
  );
}

const LEVELS = {
  critical: {
    box: "border-red-200 bg-red-50",
    title: "text-red-900",
    tone: "red",
    glyph: "!",
    label: "Perlu tindakan"
  },
  warning: {
    box: "border-amber-200 bg-amber-50",
    title: "text-amber-900",
    tone: "amber",
    glyph: "!",
    label: "Perlu perhatian"
  },
  info: {
    box: "border-slate-200 bg-slate-50",
    title: "text-slate-900",
    tone: "blue",
    glyph: "i",
    label: "Info"
  },
  good: {
    box: "border-emerald-200 bg-emerald-50",
    title: "text-emerald-900",
    tone: "green",
    glyph: "✓",
    label: "Baik"
  }
};

function InsightCard({ insight }) {
  const level = LEVELS[insight.level];

  return (
    <article className={`min-w-0 rounded-xl border p-4 ${level.box}`}>
      <Badge tone={level.tone} glyph={level.glyph}>
        {level.label}
      </Badge>

      <h3 className={`mt-2 text-sm font-semibold leading-6 ${level.title}`}>
        {insight.title}
      </h3>

      <p className="mt-1 break-words text-sm leading-6 text-slate-600">
        {insight.detail}
      </p>
    </article>
  );
}


// ==========================
// BAGIAN-BAGIAN HALAMAN
// ==========================

const PROGRESS_FILLS = {
  belum: "bg-blue-300",
  awal: "bg-blue-400",
  lanjut: "bg-blue-600",
  siap: "bg-blue-800"
};

const DEADLINE_FILLS = {
  terlambat: "bg-red-500",
  d3: "bg-blue-800",
  d7: "bg-blue-600",
  d14: "bg-blue-400",
  d15: "bg-blue-300",
  none: "bg-slate-300"
};

function ProgressSection({ progress }) {
  const shown = progress.taskProgress.slice(0, 8);

  return (
    <Card
      eyebrow="Progress tracking"
      title="Progres tugas"
      description="Seberapa jauh tugas aktif sudah dikerjakan, berdasarkan progress terakhir yang kamu catat."
    >
      {progress.total === 0 ? (
        <EmptyNote>Belum ada tugas. Tambahkan tugas di halaman Tugas.</EmptyNote>
      ) : (
        <div className="space-y-6">
          <div>
            <SubHeading>Progres berbobot durasi</SubHeading>
            <div className="mt-3">
              <Meter value={progress.doneRate} label="Progres berbobot durasi" />
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Estimasi progres setara {fmtHours(progress.doneHours)} dari {fmtHours(progress.totalHours)}{" "}
              ({fmtPct(progress.doneRate)}), berdasarkan durasi dan progress terakhir. Ini bukan catatan jam belajar aktual.
            </p>
          </div>

          {progress.active > 0 ? (
            <>
              <div>
                <SubHeading>Sebaran progress tugas aktif</SubHeading>
                <div className="mt-3">
                  <BarList
                    valueHeader="Jumlah tugas"
                    items={progress.buckets.map(bucket => ({
                      key: bucket.key,
                      label: bucket.label,
                      value: bucket.count,
                      display: String(bucket.count),
                      fill: PROGRESS_FILLS[bucket.key]
                    }))}
                  />
                </div>
              </div>

              <div>
                <SubHeading>Progress per tugas aktif</SubHeading>
                <ul className="mt-3 space-y-4">
                  {shown.map(task => (
                    <li key={task.id} className="min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 break-words text-sm font-medium text-slate-800">
                          {task.title}
                          {task.course && (
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              {task.course}
                            </span>
                          )}
                        </p>
                        <span className="shrink-0 text-sm font-semibold text-slate-900">
                          {fmtPct(task.progress)}
                        </span>
                      </div>
                      <div className="mt-2">
                        <Meter value={task.progress} label={`Progress ${task.title}`} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Sisa {fmtHours(task.remainingHours)}
                        {task.deadline && ` · deadline ${fmtDate(task.deadline)}`}
                      </p>
                    </li>
                  ))}
                </ul>
                {progress.taskProgress.length > shown.length && (
                  <p className="mt-3 text-xs text-slate-500">
                    dan {progress.taskProgress.length - shown.length} tugas aktif lainnya
                  </p>
                )}
              </div>
            </>
          ) : (
            <EmptyNote>Tidak ada tugas aktif.</EmptyNote>
          )}
        </div>
      )}
    </Card>
  );
}

function DeadlineSection({ deadlines }) {
  const hasActive = deadlines.buckets.some(bucket => bucket.count > 0);

  const { completion } = deadlines;

  const weekItems = deadlines.completionByWeek.map(week => ({
    key: week.start,
    label: weekLabel(week.start, week.end),
    shortLabel: fmtDate(week.end, { day: "numeric", month: "short" }),
    value: week.count,
    display: String(week.count)
  }));

  const completedRecently = weekItems.some(item => item.value > 0);

  return (
    <Card
      eyebrow="Deadline analysis"
      title="Tenggat tugas"
      description="Sebaran tugas aktif menurut kedekatan deadline dan pola penyelesaian yang tercatat."
    >
      <div className="space-y-6">
        {hasActive ? (
          <div>
            <SubHeading>Tugas aktif menurut deadline</SubHeading>
            <div className="mt-3">
              <BarList
                valueHeader="Jumlah tugas"
                items={deadlines.buckets.map(bucket => ({
                  key: bucket.key,
                  label: bucket.label,
                  value: bucket.count,
                  display: String(bucket.count),
                  fill: DEADLINE_FILLS[bucket.key]
                }))}
              />
            </div>
          </div>
        ) : (
          <EmptyNote>Tidak ada tugas aktif untuk dianalisis.</EmptyNote>
        )}

        {deadlines.overdueList.length > 0 && (
          <div>
            <SubHeading>Sudah lewat deadline</SubHeading>
            <ul className="mt-3 space-y-2">
              {deadlines.overdueList.slice(0, 4).map(task => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-slate-900">
                      {task.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      Deadline {fmtDate(task.deadline)} · progress {fmtPct(task.progress)}
                    </p>
                  </div>
                  <Badge tone="red" glyph="!">
                    Terlambat {task.daysLate} hari
                  </Badge>
                </li>
              ))}
            </ul>
            {deadlines.overdueList.length > 4 && (
              <p className="mt-2 text-xs text-slate-500">
                dan {deadlines.overdueList.length - 4} tugas lainnya
              </p>
            )}
          </div>
        )}

        {deadlines.upcomingList.length > 0 && (
          <div>
            <SubHeading>Tenggat terdekat</SubHeading>
            <ul className="mt-3 divide-y divide-slate-100">
              {deadlines.upcomingList.slice(0, 5).map(task => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-slate-800">
                      {task.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {fmtDate(task.deadline)} · progress {fmtPct(task.progress)} ·
                      sisa {fmtHours(task.remainingHours)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-900">
                    {task.daysLeft === 0 ? "Hari ini" : `${task.daysLeft} hari lagi`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <SubHeading>Pola penyelesaian tugas</SubHeading>

          {completion.onTime + completion.late > 0 ? (
            <div className="mt-3 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MiniStat
                  label="Selesai tepat waktu"
                  value={completion.onTime}
                  note={`dari ${completion.onTime + completion.late} tugas dengan deadline`}
                />
                <MiniStat label="Selesai terlambat" value={completion.late} />
                <MiniStat
                  label="Ketepatan waktu"
                  value={fmtPct(completion.onTimeRate)}
                />
              </div>

              <div>
                <p className="mb-3 text-xs text-slate-500">
                  Tugas diselesaikan per minggu (8 minggu terakhir)
                </p>
                {completedRecently ? (
                  <CountColumns
                    valueHeader="Tugas selesai"
                    items={weekItems}
                    caption="Tanggal di bawah kolom adalah akhir tiap minggu."
                  />
                ) : (
                  <EmptyNote>
                    Belum ada tugas yang tercatat selesai dalam 8 minggu terakhir.
                  </EmptyNote>
                )}
              </div>

              {completion.unmeasured > 0 && (
                <Note>
                  {completion.unmeasured} tugas selesai belum memiliki catatan waktu selesai, jadi tidak ikut dihitung dalam ketepatan waktu.
                </Note>
              )}
              {completion.withoutDeadline > 0 && (
                <Note>
                  {completion.withoutDeadline} tugas memiliki waktu selesai, tetapi tidak memiliki deadline sehingga tidak dapat dinilai tepat waktu atau terlambat.
                </Note>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <EmptyNote>
                Ketepatan waktu penyelesaian belum bisa diukur. Perhitungan ini memerlukan tugas yang memiliki deadline dan catatan waktu selesai.
                {completion.completedTotal === 0
                  ? " Belum ada tugas yang ditandai selesai."
                  : completion.measured === 0
                    ? ` Ada ${completion.completedTotal} tugas selesai tanpa catatan waktu selesai.`
                    : " Tugas selesai yang tersedia belum memiliki pasangan deadline dan waktu selesai yang dapat dibandingkan."}
              </EmptyNote>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function ScheduleSection({ schedule, productivity }) {
  const empty = schedule.activeSessions === 0;

  return (
    <Card
      eyebrow="Schedule insights"
      title="Jadwal dan distribusi waktu"
      description="Evaluasi jadwal belajar yang sudah disusun dan seberapa banyak waktu tersedia yang terpakai."
    >
      {empty ? (
        <EmptyNote>
          Belum ada jadwal untuk tugas aktif. Buat jadwal lewat Generate Jadwal
          Otomatis di halaman Planner.
        </EmptyNote>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat
              label="Sesi mendatang"
              value={schedule.upcomingSessions}
              note={
                schedule.lastSessionDate
                  ? `sampai ${fmtDate(schedule.lastSessionDate)}`
                  : undefined
              }
            />
            <MiniStat
              label="Jam terjadwal"
              value={fmtHours(schedule.upcomingHours)}
              note={`kebutuhan ${fmtHours(productivity.neededHours)}`}
            />
            <MiniStat
              label="Sesi berikutnya"
              value={schedule.nextSession ? fmtDate(schedule.nextSession.date, { weekday: "short", day: "numeric", month: "short" }) : "–"}
              note={
                schedule.nextSession
                  ? `${schedule.nextSession.startTime}–${schedule.nextSession.endTime} · ${schedule.nextSession.title}`
                  : undefined
              }
            />
            <MiniStat
              label="Sesi sudah lewat tanggal"
              value={schedule.passedSessions}
              note={
                schedule.passedSessions > 0
                  ? `${fmtHours(schedule.passedHours)} · terlaksana atau tidaknya belum direkam`
                  : undefined
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <div>
              <SubHeading>Jam terjadwal vs waktu tersedia, 4 minggu ke depan</SubHeading>
              <div className="mt-3">
                <WeekChart weeks={schedule.weeks} />
              </div>
            </div>

            <div>
              <SubHeading>Jam terjadwal per hari</SubHeading>
              <div className="mt-3">
                <BarList
                  valueHeader="Jam terjadwal"
                  items={schedule.byWeekday.map(item => ({
                    key: item.day,
                    label: item.day,
                    value: item.hours,
                    display: fmt(item.hours)
                  }))}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function ProductivitySection({ productivity }) {
  const rows = productivity.perTask;

  return (
    <Card
      eyebrow="Productivity analysis"
      title="Rencana belajar vs progres tercatat"
      description="Membandingkan sisa kebutuhan, sesi yang terjadwal pada atau sebelum deadline, dan progress terakhir tiap tugas aktif."
    >
      {rows.length === 0 ? (
        <EmptyNote>Tidak ada tugas aktif untuk dibandingkan.</EmptyNote>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat
              label="Waktu belajar per minggu"
              value={fmtHours(productivity.weeklyCapacity)}
            />
            <MiniStat
              label="Sisa pengerjaan"
              value={fmtHours(productivity.remainingHours)}
              note={
                productivity.weeksNeeded !== null
                  ? `≈ ${fmt(productivity.weeksNeeded)} minggu jika semua waktu terpakai`
                  : "Atur waktu belajar untuk melihat perkiraan"
              }
            />
            <MiniStat
              label="Tercakup sampai deadline"
              value={fmtPct(productivity.coveragePct)}
              note={`${fmtHours(productivity.coveredHours)} dari ${fmtHours(productivity.neededHours)}`}
            />
            <MiniStat
              label="Belum tercakup sampai deadline"
              value={fmtHours(productivity.missingHours)}
              note={productivity.missingHours > 0 ? "Periksa rincian per tugas" : "Semua kebutuhan tercakup"}
            />
          </div>

          <div className="hidden xl:block">
            <table className="w-full table-fixed text-left text-xs">
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="whitespace-normal py-2 pr-2 font-medium">Tugas</th>
                  <th className="whitespace-normal py-2 pr-2 font-medium">Deadline</th>
                  <th className="whitespace-normal py-2 pr-2 font-medium">Progress</th>
                  <th className="whitespace-normal py-2 pr-2 font-medium">Dibutuhkan</th>
                  <th className="whitespace-normal py-2 pr-2 font-medium">Terjadwal sampai deadline</th>
                  <th className="whitespace-normal py-2 pr-2 font-medium">Cakupan</th>
                  <th className="whitespace-normal py-2 font-medium">Sesi lewat</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.taskId} className="border-b border-slate-100 align-top text-slate-700">
                    <td className="break-words py-3 pr-2 font-medium text-slate-900">
                      {row.title}
                    </td>
                    <td className="break-words py-3 pr-2">
                      {fmtDate(row.deadline)}
                      {row.overdue && (
                        <div className="mt-1">
                          <Badge tone="red" glyph="!">Terlambat</Badge>
                        </div>
                      )}
                    </td>
                    <td className="break-words py-3 pr-2">{fmtPct(row.progress)}</td>
                    <td className="break-words py-3 pr-2">{fmtHours(row.needed)}</td>
                    <td className="break-words py-3 pr-2">
                      {fmtHours(row.scheduled)}
                      {row.scheduledAfterDeadline > 0 && (
                        <p className="mt-1 text-[10px] leading-4 text-amber-700">
                          {fmtHours(row.scheduledAfterDeadline)} setelah deadline, tidak dihitung
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-2">
                      <div className="flex flex-col gap-1.5">
                        <Meter
                          value={row.coverage}
                          label={`Cakupan jadwal ${row.title}`}
                          tone={row.coverage >= 100 ? "blue" : row.coverage >= 50 ? "amber" : "red"}
                        />
                        <span className="text-xs font-semibold text-slate-900">
                          {fmtPct(row.coverage)}
                        </span>
                        {row.missing > 0 && (
                          <span className="text-[10px] leading-4 text-slate-500">
                            Kurang {fmtHours(row.missing)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="break-words py-3">
                      {row.passedHours > 0 ? fmtHours(row.passedHours) : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 xl:hidden">
            {rows.map(row => (
              <article key={row.taskId} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold text-slate-900">
                      {row.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Deadline {fmtDate(row.deadline)} · Progress {fmtPct(row.progress)}
                    </p>
                  </div>
                  {row.overdue && <Badge tone="red" glyph="!">Terlambat</Badge>}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MiniStat label="Sisa kebutuhan" value={fmtHours(row.needed)} />
                  <MiniStat
                    label="Terjadwal sampai deadline"
                    value={fmtHours(row.scheduled)}
                    note={row.scheduledAfterDeadline > 0
                      ? `${fmtHours(row.scheduledAfterDeadline)} setelah deadline`
                      : undefined}
                  />
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-600">Cakupan jadwal</span>
                    <span className="text-xs font-semibold text-slate-900">{fmtPct(row.coverage)}</span>
                  </div>
                  <Meter
                    value={row.coverage}
                    label={`Cakupan jadwal ${row.title}`}
                    tone={row.coverage >= 100 ? "blue" : row.coverage >= 50 ? "amber" : "red"}
                  />
                  {row.missing > 0 && (
                    <p className="mt-1 text-xs text-slate-500">Belum tercakup: {fmtHours(row.missing)}</p>
                  )}
                </div>

                {row.passedHours > 0 && (
                  <p className="mt-3 text-xs text-slate-500">
                    Sesi dengan tanggal lewat: {fmtHours(row.passedHours)}. Status pelaksanaannya belum direkam.
                  </p>
                )}
              </article>
            ))}
          </div>

          <Note>
            Perbandingan ini memakai rencana jadwal dan progress terakhir. Jam
            belajar yang benar-benar dijalankan belum direkam, jadi angka di
            sini bukan pengukuran kerja nyata. Sesi lewat adalah jam jadwal
            yang tanggalnya sudah terlewati; apakah dijalankan tidak diketahui.
          </Note>
        </div>
      )}
    </Card>
  );
}

function HabitSection({ habits }) {
  return (
    <Card
      eyebrow="Study habit"
      title="Pola waktu belajar yang diatur"
      description="Rutinitas mingguan yang kamu tetapkan di Planner. Ini rencana, bukan catatan belajar sebenarnya."
    >
      {habits.weeklyHours === 0 ? (
        <EmptyNote>
          Belum ada waktu belajar. Atur di halaman Planner untuk melihat pola
          mingguanmu.
        </EmptyNote>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Hari belajar" value={`${habits.daysUsed} hari/minggu`} />
            <MiniStat label="Total waktu" value={fmtHours(habits.weeklyHours)} />
            <MiniStat
              label="Rata-rata blok terjadwal"
              value={fmtHours(habits.averageSessionHours)}
              note={`terpanjang ${fmtHours(habits.longestSessionHours)}`}
            />
            <MiniStat
              label="Jeda terpanjang"
              value={habits.maxRestDays === null ? "–" : `${habits.maxRestDays} hari`}
              note="berturut-turut tanpa jadwal belajar"
            />
          </div>

          <div>
            <SubHeading>Waktu belajar per hari</SubHeading>
            <div className="mt-3">
              <BarList
                valueHeader="Jam"
                items={habits.byDay.map(item => ({
                  key: item.day,
                  label: item.day,
                  value: item.hours,
                  display: fmt(item.hours)
                }))}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

const GAP_STATES = {
  no: { tone: "slate", label: "Belum direkam", glyph: "–" },
  partial: { tone: "amber", label: "Sebagian", glyph: "~" },
  yes: { tone: "green", label: "Tersedia", glyph: "✓" }
};

function AvailabilitySection({ availability }) {
  return (
    <Card
      eyebrow="Transparansi data"
      title="Apa yang diukur dan belum"
      description="Analitik hanya menghitung dari data yang benar-benar tersimpan di StudyFlow."
    >
      <div className="space-y-6">
        <div>
          <SubHeading>Sudah tersedia</SubHeading>
          <ul className="mt-3 space-y-2">
            {availability.available.map(text => (
              <li key={text} className="flex gap-2 text-sm leading-6 text-slate-700">
                <span aria-hidden="true" className="mt-0.5 text-emerald-600">
                  ✓
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SubHeading>Belum direkam, jadi belum bisa diukur</SubHeading>
          <ul className="mt-3 space-y-3">
            {availability.gaps.map(gap => {
              const state = GAP_STATES[gap.state];

              return (
                <li key={gap.key} className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">{gap.label}</p>
                    <Badge tone={state.tone} glyph={state.glyph}>
                      {state.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{gap.note}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Card>
  );
}


// ==========================
// HALAMAN
// ==========================

async function fetchOwned(name, uid) {
  const snapshot = await getDocs(
    query(collection(db, name), where("userId", "==", uid))
  );

  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export default function Analytics() {
  const { user } = useAuth();

  const { collapsed } = useSidebar();

  const [data, setData] = useState(null);

  const [loadedAt, setLoadedAt] = useState(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("overview");

  // bergantung pada uid (string), bukan objek user, supaya data tidak
  // dimuat ulang tanpa henti kalau objek user dibuat ulang tiap render
  const uid = user?.uid;

  const load = useCallback(async () => {
    if (!uid) return;

    try {
      setLoading(true);
      setError("");

      const [tasks, schedules, slots] = await Promise.all([
        fetchOwned("tasks", uid),
        fetchOwned("studySchedules", uid),
        fetchOwned("studyPreferences", uid)
      ]);

      setData({ tasks, schedules, slots });
      setLoadedAt(new Date());
    } catch (err) {
      console.error("Gagal memuat data analitik:", err);
      setError("Data analitik gagal dimuat. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  const analytics = useMemo(
    () => (data ? buildAnalytics({ ...data, now: loadedAt }) : null),
    [data, loadedAt]
  );

  const tabs = [
    { id: "overview", label: "Ringkasan" },
    { id: "tasks", label: "Tugas" },
    { id: "schedule", label: "Jadwal" },
    { id: "habits", label: "Kebiasaan & data" }
  ];

  const focusTasks = analytics
    ? (analytics.deadlines.overdueList.length > 0
        ? analytics.deadlines.overdueList.slice(0, 3)
        : analytics.deadlines.upcomingList.slice(0, 3))
    : [];

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50">
      <Sidebar />

      <main
        className={`min-w-0 flex-1 px-4 pb-10 pt-5 transition-all duration-300 sm:px-6 lg:px-8 ${
          collapsed ? "lg:ml-20" : "lg:ml-64"
        }`}
      >
        <MobileNavbar />

        <div className="mx-auto w-full max-w-7xl">
          <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                Analitik belajar
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Study Analytics
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Pahami progres tugas, deadline, dan rencana belajar dari data yang tercatat di StudyFlow.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {loadedAt && (
                <span className="text-xs text-slate-500">
                  Diperbarui {loadedAt.toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
              )}
              <button
                type="button"
                onClick={load}
                disabled={loading || !uid}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Memuat..." : "Muat ulang"}
              </button>
            </div>
          </header>

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
            >
              {error}
            </div>
          )}

          {!analytics && !error && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
              {uid ? "Memuat data analitik..." : "Masuk untuk melihat analitik belajar."}
            </div>
          )}

          {analytics && (
            <div className={`mt-7 space-y-6 transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}>
              <div
                role="tablist"
                aria-label="Bagian analitik belajar"
                className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:grid-cols-4"
              >
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    id={`analytics-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`analytics-panel-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`min-w-0 rounded-xl px-3 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                      activeTab === tab.id
                        ? "bg-blue-600 text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && (
                <section
                  id="analytics-panel-overview"
                  role="tabpanel"
                  aria-labelledby="analytics-tab-overview"
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatTile
                      label="Tugas aktif"
                      value={analytics.progress.active}
                      note={`${analytics.progress.total} tugas tercatat`}
                    />
                    <StatTile
                      label="Tugas selesai"
                      value={analytics.progress.completed}
                      note={`Tingkat penyelesaian ${fmtPct(analytics.progress.completionRate)}`}
                    />
                    <StatTile
                      label="Rata-rata progres"
                      value={analytics.progress.averageProgressActive === null
                        ? "–"
                        : fmt(analytics.progress.averageProgressActive)}
                      unit={analytics.progress.averageProgressActive === null ? undefined : "%"}
                      note="Dari tugas aktif"
                    />
                    <StatTile
                      label="Estimasi sisa pengerjaan"
                      value={fmt(analytics.progress.remainingHours)}
                      unit="jam"
                      note={`${fmtHours(analytics.productivity.weeklyCapacity)} waktu belajar tersedia per minggu`}
                    />
                  </div>

                  <Card
                    eyebrow="Ringkasan"
                    title="Hal yang perlu kamu ketahui"
                    description="Temuan ini berasal dari data yang tersimpan. StudyFlow tidak menyimpulkan penyebab yang belum tercatat."
                  >
                    {analytics.insights.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {analytics.insights.map(insight => (
                          <InsightCard key={insight.id} insight={insight} />
                        ))}
                      </div>
                    ) : (
                      <EmptyNote>Belum ada temuan untuk ditampilkan.</EmptyNote>
                    )}
                  </Card>

                  <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
                    <Card
                      eyebrow="Fokus berikutnya"
                      title={analytics.deadlines.overdueList.length > 0 ? "Tugas yang terlambat" : "Deadline terdekat"}
                      description="Tinjau tenggat sebelum menentukan prioritas belajar berikutnya."
                    >
                      {focusTasks.length > 0 ? (
                        <ul className="divide-y divide-slate-100">
                          {focusTasks.map(task => (
                            <li key={task.id} className="flex min-w-0 items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                              <div className="min-w-0">
                                <p className="break-words text-sm font-semibold text-slate-900">{task.title}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Deadline {fmtDate(task.deadline)} · progres {fmtPct(task.progress)}
                                </p>
                              </div>
                              {task.overdue ? (
                                <Badge tone="red" glyph="!">Terlambat {task.daysLate} hari</Badge>
                              ) : (
                                <Badge tone={task.daysLeft <= 3 ? "amber" : "slate"}>
                                  {task.daysLeft === 0 ? "Hari ini" : `${task.daysLeft} hari lagi`}
                                </Badge>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <EmptyNote>Tidak ada deadline aktif yang perlu ditampilkan.</EmptyNote>
                      )}
                    </Card>

                    <Card
                      eyebrow="Rencana belajar"
                      title="Sesi berikutnya"
                      description="Jadwal yang tersimpan di Planner, bukan bukti bahwa sesi sudah dilaksanakan."
                    >
                      {analytics.schedule.nextSession ? (
                        <div className="rounded-xl border border-slate-200 p-4">
                          <p className="break-words text-sm font-semibold text-slate-900">
                            {analytics.schedule.nextSession.title}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            {fmtDate(analytics.schedule.nextSession.date, {
                              weekday: "long", day: "numeric", month: "long", year: "numeric"
                            })}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-blue-700">
                            {analytics.schedule.nextSession.startTime}–{analytics.schedule.nextSession.endTime}
                          </p>
                        </div>
                      ) : (
                        <EmptyNote>Belum ada sesi mendatang untuk tugas aktif. Buat jadwal di Planner.</EmptyNote>
                      )}

                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <MiniStat
                          label="Jam terjadwal mendatang"
                          value={fmtHours(analytics.schedule.upcomingHours)}
                          note={`${analytics.schedule.upcomingSessions} sesi`}
                        />
                        <MiniStat
                          label="Kebutuhan tercakup sampai deadline"
                          value={fmtPct(analytics.productivity.coveragePct)}
                          note="Berdasarkan jadwal yang relevan"
                        />
                      </div>
                    </Card>
                  </div>
                </section>
              )}

              {activeTab === "tasks" && (
                <section
                  id="analytics-panel-tasks"
                  role="tabpanel"
                  aria-labelledby="analytics-tab-tasks"
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
                    <ProgressSection progress={analytics.progress} />
                    <DeadlineSection deadlines={analytics.deadlines} />
                  </div>
                  <ProductivitySection productivity={analytics.productivity} />
                </section>
              )}

              {activeTab === "schedule" && (
                <section
                  id="analytics-panel-schedule"
                  role="tabpanel"
                  aria-labelledby="analytics-tab-schedule"
                  className="space-y-6"
                >
                  <ScheduleSection
                    schedule={analytics.schedule}
                    productivity={analytics.productivity}
                  />
                </section>
              )}

              {activeTab === "habits" && (
                <section
                  id="analytics-panel-habits"
                  role="tabpanel"
                  aria-labelledby="analytics-tab-habits"
                  className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2"
                >
                  <HabitSection habits={analytics.habits} />
                  <AvailabilitySection availability={analytics.dataAvailability} />
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
