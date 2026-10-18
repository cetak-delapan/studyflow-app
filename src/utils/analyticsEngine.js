// ==========================================================
// ANALYTICS ENGINE - StudyFlow
//
// Fungsi murni (tanpa Firebase, tanpa React) yang mengubah data
// tasks, studySchedules, dan studyPreferences menjadi statistik.
// Dipisah dari halaman supaya bisa dites dan dipakai ulang oleh
// AI Assistant dengan angka yang sama persis.
//
// PRINSIP: hanya menghitung dari data yang BENAR-BENAR tersimpan.
//
// Tersedia di Firebase saat ini:
//   tasks            : title, course, deadline, duration, priority,
//                      progress (nilai terakhir), status, createdAt
//   studySchedules   : taskId, date, startTime, endTime, duration
//                      (jadwal hasil generate; status selalu "planned")
//   studyPreferences : day, startTime, endTime, duration
//
// BELUM direkam (tidak boleh diklaim terukur):
//   - durasi belajar yang benar-benar dijalankan
//   - sesi yang terlaksana atau terlewat
//   - riwayat perubahan progress dari waktu ke waktu
//   - waktu tugas diselesaikan (field completedAt) - dipakai kalau
//     suatu saat disimpan, kalau belum ada ditandai "belum terukur"
//   - riwayat jadwal lama (generate ulang menghapus jadwal lama)
// ==========================================================

import { calculateRemainingHours } from "./plannerEngine";


// ==========================
// KONSTANTA
// ==========================

const DAY_MS = 24 * 60 * 60 * 1000;
const EPS = 1e-6;

// sama dengan Planner.jsx: tugas aktif = status "pending"
export const ACTIVE_STATUS = "pending";

// nilai status yang dianggap selesai (huruf besar/kecil diabaikan).
// Kalau halaman Tugas menyimpan nilai lain saat menandai selesai,
// tambahkan di sini.
export const COMPLETED_STATUSES = ["completed", "done", "selesai", "finished"];

const DAY_NAMES = [
  "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"
];

export const WEEK_ORDER = [
  "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"
];

const LEVEL_RANK = { critical: 0, warning: 1, info: 2, good: 3 };


// ==========================
// HELPER
// ==========================

function round1(n){
  return Number(Number(n).toFixed(1));
}

function round2(n){
  return Number(Number(n).toFixed(2));
}

function pad(n){
  return String(n).padStart(2, "0");
}

function num(value){
  const n = Number(value);
  return isFinite(n) ? n : 0;
}

function clampPct(value){
  return Math.min(Math.max(num(value), 0), 100);
}

function startOfDay(date){
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n){
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// tanggal lokal "YYYY-MM-DD" (bukan UTC)
function formatDate(date){
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// selisih hari kalender: 0 = hari ini, negatif = sudah lewat
function daysBetween(from, to){
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

// mendukung Date, string, dan Firestore Timestamp
function toDate(value){

  if(!value) return null;

  if(typeof value.toDate === "function"){
    value = value.toDate();
  }

  const d = value instanceof Date ? value : new Date(value);

  return isNaN(d.getTime()) ? null : d;
}

// deadline berakhir pukul 23:59:59 hari tersebut (waktu lokal)
function parseDeadline(value){

  if(!value) return null;

  if(typeof value === "string"){

    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if(m){
      return new Date(
        Number(m[1]), Number(m[2]) - 1, Number(m[3]),
        23, 59, 59, 999
      );
    }
  }

  const d = toDate(value);

  if(!d) return null;

  const end = new Date(d);
  end.setHours(23, 59, 59, 999);

  return end;
}

function timeToDecimal(time){

  if(typeof time !== "string") return NaN;

  const [hour, minute = 0] = time.split(":").map(Number);

  return hour + (minute / 60);
}

// endTime dipakai kalau valid, kalau tidak pakai duration
function slotRange(slot){

  const start = timeToDecimal(slot.startTime);

  let end = timeToDecimal(slot.endTime);

  if(!(end > start)){
    end = start + num(slot.duration);
  }

  return { start, end };
}

function sumDuration(list){
  return round2(list.reduce((sum, item) => sum + num(item.duration), 0));
}

function fmtNum(n){
  return String(Number(Number(n).toFixed(2))).replace(".", ",");
}

function titleList(items, max = 3){

  const shown = items.slice(0, max).join(", ");

  const rest = items.length - max;

  return rest > 0 ? `${shown} dan ${rest} lainnya` : shown;
}


// ==========================
// STATUS TUGAS
// ==========================

export function isTaskActive(task){
  return task.status === ACTIVE_STATUS;
}

export function isTaskCompleted(task){
  return COMPLETED_STATUSES.includes(
    String(task.status || "").toLowerCase()
  );
}

// Hanya tampilkan jadwal untuk tugas yang masih aktif. Fungsi ini lokal
// karena plannerEngine.js versi V7 tidak mengekspor filterActiveSchedules.
function filterActiveSchedules(activeTasks, schedules){
  const activeIds = new Set(activeTasks.map(task => task.id));
  return schedules.filter(item => activeIds.has(item.taskId));
}


// ==========================
// WAKTU BELAJAR PER HARI
// Slot yang dobel atau tumpang tindih digabung, jadi jam tidak
// terhitung dua kali (sama seperti scheduler di plannerEngine).
// ==========================

function windowsByDay(slots){

  const map = {};

  for(const slot of slots){

    if(!WEEK_ORDER.includes(slot.day)) continue;

    const { start, end } = slotRange(slot);

    if(!isFinite(start) || !isFinite(end) || end <= start) continue;

    (map[slot.day] = map[slot.day] || []).push({ start, end });
  }

  for(const day of Object.keys(map)){

    map[day].sort((a, b) => a.start - b.start);

    const merged = [];

    for(const window of map[day]){

      const last = merged[merged.length - 1];

      if(last && window.start <= last.end + EPS){
        last.end = Math.max(last.end, window.end);
      }
      else{
        merged.push({ ...window });
      }
    }

    map[day] = merged;
  }

  return map;
}

function dayHours(windows){
  return windows.reduce((sum, w) => sum + (w.end - w.start), 0);
}

function weeklyCapacityOf(map){
  return round2(
    Object.values(map).reduce((sum, windows) => sum + dayHours(windows), 0)
  );
}

// jam belajar yang tersedia dalam 7 hari mulai `startDate`.
// Pada hari ini, bagian yang sudah lewat tidak dihitung.
function capacityInRange(map, startDate, now){

  const today = formatDate(now);

  const nowDecimal = now.getHours() + (now.getMinutes() / 60);

  let total = 0;

  for(let i = 0; i < 7; i++){

    const day = addDays(startDate, i);

    const windows = map[DAY_NAMES[day.getDay()]] || [];

    for(const window of windows){

      let start = window.start;

      if(formatDate(day) === today){
        start = Math.max(start, Math.ceil(nowDecimal * 4) / 4);
      }

      if(window.end - start > EPS) total += window.end - start;
    }
  }

  return round2(total);
}


// ==========================
// PROGRESS TRACKING
// ==========================

export function calculateProgressStats(tasks){

  const active = tasks.filter(isTaskActive);

  const completed = tasks.filter(isTaskCompleted);

  const other = tasks.length - active.length - completed.length;

  const totalHours = round2(
    [...active, ...completed].reduce((sum, t) => sum + num(t.duration), 0)
  );

  // tugas selesai dihitung penuh; tugas aktif sebesar progress-nya
  const doneHours = round2(
    completed.reduce((sum, t) => sum + num(t.duration), 0) +
    active.reduce(
      (sum, t) => sum + num(t.duration) * clampPct(t.progress) / 100,
      0
    )
  );

  const remainingHours = round2(
    active.reduce((sum, t) => sum + calculateRemainingHours(t), 0)
  );

  const buckets = [
    { key: "belum", label: "Belum dimulai (0%)", count: 0 },
    { key: "awal", label: "Awal (1–49%)", count: 0 },
    { key: "lanjut", label: "Berjalan (50–99%)", count: 0 },
    { key: "siap", label: "100%, belum ditandai selesai", count: 0 }
  ];

  for(const task of active){

    const pct = clampPct(task.progress);

    const bucket =
      pct <= 0 ? buckets[0] :
      pct < 50 ? buckets[1] :
      pct < 100 ? buckets[2] :
      buckets[3];

    bucket.count += 1;
  }

  const taskProgress = active
    .map(task => {

      const deadline = parseDeadline(task.deadline);

      return {
        id: task.id,
        title: task.title,
        course: task.course || "",
        progress: round1(clampPct(task.progress)),
        remainingHours: round2(calculateRemainingHours(task)),
        deadline: deadline ? formatDate(deadline) : null
      };
    })
    .sort((a, b) =>
      (a.deadline || "9999-12-31").localeCompare(b.deadline || "9999-12-31")
    );

  return {
    total: tasks.length,
    active: active.length,
    completed: completed.length,
    other,
    completionRate:
      tasks.length > 0
        ? round1(completed.length / tasks.length * 100)
        : null,
    averageProgressActive:
      active.length > 0
        ? round1(
            active.reduce((sum, t) => sum + clampPct(t.progress), 0) /
            active.length
          )
        : null,
    totalHours,
    doneHours,
    remainingHours,
    doneRate: totalHours > 0 ? round1(doneHours / totalHours * 100) : null,
    buckets,
    taskProgress
  };
}


// ==========================
// DEADLINE ANALYSIS
// ==========================

export function calculateDeadlineStats(tasks, now = new Date()){

  const active = tasks.filter(isTaskActive);

  const rows = active.map(task => {

    const deadline = parseDeadline(task.deadline);

    const overdue = deadline ? deadline < now : false;

    return {
      id: task.id,
      title: task.title,
      deadline: deadline ? formatDate(deadline) : null,
      daysLeft: deadline ? daysBetween(now, deadline) : null,
      overdue,
      progress: round1(clampPct(task.progress)),
      remainingHours: round2(calculateRemainingHours(task))
    };
  });

  const buckets = [
    { key: "terlambat", label: "Terlambat", count: 0, titles: [] },
    { key: "d3", label: "0–3 hari lagi", count: 0, titles: [] },
    { key: "d7", label: "4–7 hari lagi", count: 0, titles: [] },
    { key: "d14", label: "8–14 hari lagi", count: 0, titles: [] },
    { key: "d15", label: "Lebih dari 14 hari", count: 0, titles: [] },
    { key: "none", label: "Tanpa deadline", count: 0, titles: [] }
  ];

  for(const row of rows){

    const bucket =
      row.deadline === null ? buckets[5] :
      row.overdue ? buckets[0] :
      row.daysLeft <= 3 ? buckets[1] :
      row.daysLeft <= 7 ? buckets[2] :
      row.daysLeft <= 14 ? buckets[3] :
      buckets[4];

    bucket.count += 1;
    bucket.titles.push(row.title);
  }

  const overdueList = rows
    .filter(row => row.overdue)
    .map(row => ({ ...row, daysLate: -row.daysLeft }))
    .sort((a, b) => b.daysLate - a.daysLate);

  const upcomingList = rows
    .filter(row => !row.overdue && row.deadline !== null)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  // pola penyelesaian: hanya untuk tugas selesai yang punya completedAt
  const completed = tasks.filter(isTaskCompleted);

  const measured = completed.filter(task => toDate(task.completedAt));

  let onTime = 0;
  let late = 0;
  let withoutDeadline = 0;

  for(const task of measured){

    const deadline = parseDeadline(task.deadline);

    if(!deadline){
      withoutDeadline += 1;
      continue;
    }

    if(toDate(task.completedAt) <= deadline) onTime += 1;
    else late += 1;
  }

  // 8 jendela 7 hari terakhir, dari yang terlama ke terbaru
  const today = startOfDay(now);

  const completionByWeek = [];

  for(let k = 7; k >= 0; k--){

    const end = addDays(today, -7 * k);

    const start = addDays(end, -6);

    const startStr = formatDate(start);

    const endStr = formatDate(end);

    const count = measured.filter(task => {

      const done = formatDate(toDate(task.completedAt));

      return done >= startStr && done <= endStr;
    }).length;

    completionByWeek.push({ start: startStr, end: endStr, count });
  }

  return {
    buckets,
    overdueList,
    upcomingList,
    completion: {
      completedTotal: completed.length,
      measured: measured.length,
      unmeasured: completed.length - measured.length,
      withoutDeadline,
      onTime,
      late,
      onTimeRate:
        onTime + late > 0
          ? round1(onTime / (onTime + late) * 100)
          : null
    },
    completionByWeek
  };
}


// ==========================
// STUDY HABIT (pola waktu belajar yang DIATUR)
// Ini rutinitas yang direncanakan, bukan catatan belajar sebenarnya.
// ==========================

export function calculateHabitStats(slots){

  const map = windowsByDay(slots);

  const byDay = WEEK_ORDER.map(day => {

    const windows = map[day] || [];

    return {
      day,
      hours: round2(dayHours(windows)),
      sessions: windows.length
    };
  });

  const usedDays = byDay.filter(item => item.hours > 0);

  const windowCount = byDay.reduce((sum, item) => sum + item.sessions, 0);

  const weeklyHours = round2(
    byDay.reduce((sum, item) => sum + item.hours, 0)
  );

  const longestSessionHours = round2(
    Math.max(
      0,
      ...Object.values(map).flat().map(w => w.end - w.start)
    )
  );

  // jeda terpanjang (dalam hari) antar hari belajar, melingkar per minggu
  let maxRestDays = null;

  if(usedDays.length === 1){
    maxRestDays = 6;
  }
  else if(usedDays.length >= 2){

    const idx = usedDays.map(item => WEEK_ORDER.indexOf(item.day));

    let maxGap = 0;

    for(let i = 0; i < idx.length; i++){

      const next = idx[(i + 1) % idx.length];

      maxGap = Math.max(maxGap, (next - idx[i] + 7) % 7);
    }

    maxRestDays = maxGap - 1;
  }

  // slot yang tumpang tindih / dobel pada hari yang sama
  const valid = slots
    .filter(slot => WEEK_ORDER.includes(slot.day))
    .map(slot => ({ day: slot.day, ...slotRange(slot) }))
    .filter(slot => isFinite(slot.start) && isFinite(slot.end) && slot.end > slot.start)
    .sort((a, b) =>
      WEEK_ORDER.indexOf(a.day) - WEEK_ORDER.indexOf(b.day) ||
      a.start - b.start
    );

  let overlappingSlots = 0;

  const maxEnd = {};

  for(const slot of valid){

    if(maxEnd[slot.day] !== undefined && slot.start < maxEnd[slot.day] - EPS){
      overlappingSlots += 1;
    }

    maxEnd[slot.day] = Math.max(maxEnd[slot.day] ?? 0, slot.end);
  }

  return {
    byDay,
    daysUsed: usedDays.length,
    weeklyHours,
    windowCount,
    averageSessionHours:
      windowCount > 0 ? round2(weeklyHours / windowCount) : 0,
    longestSessionHours,
    maxRestDays,
    overlappingSlots
  };
}


// ==========================
// SCHEDULE INSIGHTS
// ==========================

export function calculateScheduleStats(tasks, schedules, slots, now = new Date()){

  const active = tasks.filter(isTaskActive);

  const visible = filterActiveSchedules(active, schedules);

  const today = formatDate(now);

  const upcoming = visible
    .filter(item => String(item.date) >= today)
    .sort((a, b) =>
      String(a.date).localeCompare(String(b.date)) ||
      String(a.startTime || "").localeCompare(String(b.startTime || ""))
    );

  const passed = visible.filter(item => String(item.date) < today);

  const byWeekday = WEEK_ORDER.map(day => {

    const mine = upcoming.filter(item =>
      DAY_NAMES[new Date(`${item.date}T12:00:00`).getDay()] === day
    );

    return { day, hours: sumDuration(mine), sessions: mine.length };
  });

  const map = windowsByDay(slots);

  // 4 minggu bergulir mulai hari ini
  const weeks = [];

  for(let k = 0; k < 4; k++){

    const start = addDays(startOfDay(now), 7 * k);

    const startStr = formatDate(start);

    const endStr = formatDate(addDays(start, 6));

    const planned = sumDuration(
      upcoming.filter(item => item.date >= startStr && item.date <= endStr)
    );

    const capacity = capacityInRange(map, start, now);

    weeks.push({
      start: startStr,
      end: endStr,
      plannedHours: planned,
      capacityHours: capacity,
      utilization:
        capacity > 0 ? round1(planned / capacity * 100) : null
    });
  }

  return {
    activeSessions: visible.length,
    upcomingSessions: upcoming.length,
    upcomingHours: sumDuration(upcoming),
    passedSessions: passed.length,
    passedHours: sumDuration(passed),
    byWeekday,
    weeks,
    nextSession: upcoming[0]
      ? {
          title: upcoming[0].title,
          date: upcoming[0].date,
          startTime: upcoming[0].startTime,
          endTime: upcoming[0].endTime
        }
      : null,
    lastSessionDate: upcoming.length ? upcoming[upcoming.length - 1].date : null
  };
}


// ==========================
// PRODUCTIVITY (rencana vs yang tercatat)
// Yang dibandingkan hanya data tersimpan: jam yang dibutuhkan,
// jam yang sudah dijadwalkan, dan progress terakhir. Pelaksanaan
// sesi tidak direkam, jadi tidak diukur.
// ==========================

export function calculateProductivity(tasks, schedules, slots, now = new Date()){

  const active = tasks.filter(isTaskActive);

  const today = formatDate(now);

  const weeklyCapacity = weeklyCapacityOf(windowsByDay(slots));

  const perTask = active.map(task => {

    const remaining = calculateRemainingHours(task);

    // Dibulatkan ke kelipatan 15 menit agar konsisten dengan kebutuhan
    // alokasi jadwal. Nilai ini tetap estimasi, bukan durasi aktual.
    const needed = Math.ceil(remaining * 4) / 4;

    const mine = schedules.filter(item => item.taskId === task.id);

    const upcomingMine = mine.filter(item => String(item.date) >= today);

    const deadline = parseDeadline(task.deadline);
    const deadlineDate = deadline ? formatDate(deadline) : null;

    // Untuk tugas dengan deadline, hanya sesi hari ini atau mendatang
    // yang jatuh pada/sebelum deadline dihitung sebagai cakupan.
    // Jika tidak ada deadline, semua sesi mendatang tetap dihitung.
    const beforeDeadline = upcomingMine.filter(item =>
      !deadlineDate || String(item.date) <= deadlineDate
    );

    const afterDeadline = deadlineDate
      ? upcomingMine.filter(item => String(item.date) > deadlineDate)
      : [];

    const scheduled = sumDuration(beforeDeadline);
    const scheduledUpcoming = sumDuration(upcomingMine);
    const scheduledAfterDeadline = sumDuration(afterDeadline);

    const passedHours = sumDuration(
      mine.filter(item => String(item.date) < today)
    );

    return {
      taskId: task.id,
      title: task.title,
      deadline: deadlineDate,
      overdue: deadline ? deadline < now : false,
      progress: round1(clampPct(task.progress)),
      needed: round2(needed),
      // Jam yang memenuhi deadline, dipakai untuk coverage dan missing.
      scheduled,
      // Semua sesi mendatang, untuk transparansi bila ada sesi setelah deadline.
      scheduledUpcoming,
      scheduledAfterDeadline,
      missing: round2(Math.max(0, needed - scheduled)),
      coverage:
        needed > 0
          ? round1(Math.min(100, scheduled / needed * 100))
          : 100,
      passedHours
    };
  });

  const neededHours = round2(perTask.reduce((s, t) => s + t.needed, 0));

  const coveredHours = round2(
    perTask.reduce((s, t) => s + Math.min(t.scheduled, t.needed), 0)
  );

  const remainingHours = round2(
    active.reduce((sum, t) => sum + calculateRemainingHours(t), 0)
  );

  return {
    weeklyCapacity,
    remainingHours,
    weeksNeeded:
      weeklyCapacity > 0 ? round1(remainingHours / weeklyCapacity) : null,
    neededHours,
    coveredHours,
    coveragePct:
      neededHours > 0 ? round1(coveredHours / neededHours * 100) : null,
    missingHours: round2(perTask.reduce((s, t) => s + t.missing, 0)),
    overdueActive: perTask.filter(t => t.overdue).length,
    perTask: perTask.sort((a, b) =>
      (a.deadline || "9999-12-31").localeCompare(b.deadline || "9999-12-31")
    )
  };
}


// ==========================
// DATA YANG TERSEDIA vs BELUM DIREKAM
// ==========================

function describeDataAvailability(deadlines, schedule){

  const { completedTotal, measured } = deadlines.completion;

  const completedAt =
    completedTotal === 0
      ? {
          state: "no",
          note: "Belum ada tugas selesai untuk mengevaluasi ketepatan waktu."
        }
      : measured === completedTotal
        ? { state: "yes", note: "Semua tugas selesai punya waktu selesai." }
        : measured > 0
          ? {
              state: "partial",
              note: `${measured} dari ${completedTotal} tugas selesai punya waktu selesai.`
            }
          : {
              state: "no",
              note: "Waktu selesai belum disimpan saat tugas ditandai selesai, jadi ketepatan waktu penyelesaian belum bisa diukur."
            };

  const scheduleHistory =
    schedule.passedSessions > 0
      ? {
          state: "partial",
          note: `Ada ${schedule.passedSessions} sesi yang tanggalnya sudah lewat, tetapi generate ulang jadwal menghapus jadwal lama.`
        }
      : {
          state: "no",
          note: "Generate ulang jadwal menghapus jadwal lama, jadi riwayat jadwal tidak tersimpan."
        };

  return {

    available: [
      "Tugas: judul, mata kuliah, deadline, durasi, prioritas, status",
      "Progress terakhir tiap tugas",
      "Jadwal hasil generate yang masih tersimpan; sesi lama terhapus saat jadwal dibuat ulang",
      "Waktu belajar yang diatur di Planner"
    ],

    gaps: [
      {
        key: "actual",
        label: "Durasi belajar sebenarnya",
        state: "no",
        note: "Belum ada pencatatan jam belajar yang benar-benar dijalankan."
      },
      {
        key: "outcome",
        label: "Sesi terlaksana atau terlewat",
        state: "no",
        note: "Status sesi di jadwal selalu \"planned\"; belum ada penanda selesai atau terlewat."
      },
      {
        key: "completedAt",
        label: "Waktu tugas diselesaikan",
        ...completedAt
      },
      {
        key: "progressHistory",
        label: "Riwayat progress",
        state: "no",
        note: "Yang tersimpan hanya progress terakhir, belum ada perubahan dari waktu ke waktu."
      },
      {
        key: "scheduleHistory",
        label: "Riwayat jadwal",
        ...scheduleHistory
      }
    ]
  };
}


// ==========================
// TEMUAN OTOMATIS
// Setiap temuan lahir dari angka di atas, tidak ada tebakan penyebab.
// ==========================

function buildInsights({ progress, deadlines, schedule, habits, productivity, hasSlots }){

  const out = [];

  const add = (id, level, title, detail) =>
    out.push({ id, level, title, detail });

  if(progress.total === 0){

    add(
      "no-tasks",
      "info",
      "Belum ada tugas",
      "Tambahkan tugas di halaman Tugas supaya analitik bisa dihitung."
    );

    return out;
  }

  if(progress.active === 0 && progress.completed > 0){

    add(
      "all-done",
      "good",
      "Semua tugas sudah selesai",
      `${progress.completed} tugas selesai dan tidak ada tugas aktif.`
    );
  }

  const overdue = deadlines.overdueList;

  if(overdue.length > 0){

    add(
      "overdue",
      "critical",
      `${overdue.length} tugas aktif sudah lewat deadline`,
      `${titleList(overdue.map(t => t.title))}. Ubah deadline di halaman Tugas atau selesaikan lebih dulu.`
    );
  }

  const dueSoonLow = deadlines.upcomingList.filter(
    t => t.daysLeft <= 3 && t.progress < 50
  );

  if(dueSoonLow.length > 0){

    add(
      "due-soon",
      "warning",
      `${dueSoonLow.length} tugas jatuh tempo dalam 3 hari dengan progress di bawah 50%`,
      dueSoonLow
        .slice(0, 3)
        .map(t => `${t.title} (progress ${fmtNum(t.progress)}%, sisa ${fmtNum(t.remainingHours)} jam)`)
        .join("; ") + "."
    );
  }

  if(
    productivity.weeklyCapacity > 0 &&
    overdue.length > 0 &&
    productivity.weeksNeeded !== null &&
    productivity.weeksNeeded <= 1
  ){

    add(
      "capacity-vs-overdue",
      "warning",
      "Waktu belajar tersedia cukup, tetapi masih ada tugas terlambat",
      `Kapasitas ${fmtNum(productivity.weeklyCapacity)} jam per minggu sudah mencakup sisa pekerjaan ${fmtNum(productivity.remainingHours)} jam, namun ${overdue.length} tugas melewati deadline. StudyFlow belum merekam apakah sesi belajar benar-benar dijalankan, jadi penyebabnya belum bisa dipastikan dari data.`
    );
  }

  if(progress.active > 0 && productivity.remainingHours > 0 && !hasSlots){

    add(
      "no-slots",
      "warning",
      "Belum ada waktu belajar yang diatur",
      "Atur waktu belajar di halaman Planner supaya jadwal bisa disusun."
    );
  }

  if(hasSlots && productivity.missingHours > 0){

    const lacking = productivity.perTask.filter(t => t.missing > 0);

    add(
      "missing-hours",
      "warning",
      `${fmtNum(productivity.missingHours)} jam tugas belum masuk jadwal`,
      `${titleList(lacking.map(t => t.title))}. Cakupan hanya menghitung sesi hari ini atau mendatang yang jatuh pada atau sebelum deadline. Tambah waktu belajar atau sesuaikan deadline di Planner.`
    );
  }

  const ready = progress.buckets.find(b => b.key === "siap");

  if(ready && ready.count > 0){

    add(
      "ready-to-complete",
      "info",
      `${ready.count} tugas sudah 100% tetapi belum ditandai selesai`,
      "Tandai selesai di halaman Tugas supaya hilang dari daftar aktif dan jadwal."
    );
  }

  const stalled = productivity.perTask.filter(
    t => t.passedHours > 0 && t.progress === 0
  );

  if(stalled.length > 0){

    add(
      "stalled",
      "warning",
      "Ada sesi terjadwal yang sudah lewat, tetapi progress tugas masih 0%",
      `${titleList(stalled.map(t => `${t.title} (${fmtNum(t.passedHours)} jam)`))}. Bisa jadi sesi belum dijalankan atau progress belum diperbarui.`
    );
  }

  if(schedule.passedSessions > 0){

    add(
      "passed-sessions",
      "info",
      `${schedule.passedSessions} sesi terjadwal sudah lewat tanggalnya`,
      "Apakah sesi itu dijalankan belum direkam. Generate ulang jadwal akan menghapusnya."
    );
  }

  if(habits.overlappingSlots > 0){

    add(
      "overlap",
      "info",
      `${habits.overlappingSlots} slot waktu belajar dobel atau tumpang tindih`,
      "Hapus yang dobel di Planner supaya daftar tetap rapi. Perhitungan jam sudah menggabungkan slot yang tumpang tindih."
    );
  }

  const { measured, onTimeRate, onTime, late } = deadlines.completion;

  if(measured > 0 && onTimeRate !== null){

    add(
      "on-time",
      onTimeRate >= 80 ? "good" : onTimeRate >= 50 ? "info" : "warning",
      `${fmtNum(onTimeRate)}% tugas selesai tepat waktu`,
      `${onTime} tepat waktu dan ${late} terlambat, dari tugas yang waktu selesainya tercatat.`
    );
  }

  if(
    progress.active > 0 &&
    productivity.neededHours > 0 &&
    hasSlots &&
    overdue.length === 0 &&
    productivity.missingHours <= 0.01 &&
    productivity.perTask.every(task => task.missing <= 0.01)
  ){

    add(
      "all-scheduled",
      "good",
      "Kebutuhan tugas aktif sudah tercakup oleh jadwal yang relevan",
      `${fmtNum(productivity.neededHours)} jam kebutuhan tercakup. Untuk tugas yang memiliki deadline, hanya sesi pada atau sebelum tanggal deadline yang dihitung.`
    );
  }

  return out.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
}


// ==========================
// GABUNGAN: satu panggilan untuk satu halaman
// ==========================

export function buildAnalytics({
  tasks = [],
  schedules = [],
  slots = [],
  now = new Date()
} = {}){

  const progress = calculateProgressStats(tasks);

  const deadlines = calculateDeadlineStats(tasks, now);

  const schedule = calculateScheduleStats(tasks, schedules, slots, now);

  const habits = calculateHabitStats(slots);

  const productivity = calculateProductivity(tasks, schedules, slots, now);

  const hasSlots = habits.weeklyHours > 0;

  return {
    generatedAt: now,
    hasTasks: tasks.length > 0,
    hasSlots,
    progress,
    deadlines,
    schedule,
    habits,
    productivity,
    insights: buildInsights({
      progress, deadlines, schedule, habits, productivity, hasSlots
    }),
    dataAvailability: describeDataAvailability(deadlines, schedule)
  };
}
