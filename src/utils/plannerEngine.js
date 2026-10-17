// ==========================================================
// PLANNER ENGINE V7 - StudyFlow
//
// Struktur data Firestore yang dipakai:
//   tasks:            { title, course, deadline:"YYYY-MM-DD", duration,
//                       progress, priority:"High|Medium|Low", status }
//   studyPreferences: { day:"Rabu", startTime:"19:00", endTime:"21:00",
//                       duration:2 }
//
// Cara kerja generateSchedulePlan():
//   1. Hitung sisa jam tiap tugas (durasi dikurangi progress).
//   2. Ubah preferensi mingguan ("Rabu 19:00-21:00") menjadi slot
//      tanggal nyata, mulai hari ini sampai beberapa minggu ke depan.
//   3. Isi slot satu per satu secara kronologis, per blok 1 jam.
//      Tiap blok diberikan ke tugas dengan skor tertinggi
//      (kedekatan deadline 50% + prioritas 30% + sisa durasi 20%),
//      TAPI hanya jika itu tidak membuat tugas lain gagal mengejar
//      deadline-nya (cek "slack" per deadline, lihat pickTask).
//      Tugas yang sudah lewat deadline hanya memakai slack yang
//      tersisa, jadi tidak pernah menyerobot tugas yang masih bisa dikejar.
//   4. Sesi berurutan untuk tugas yang sama digabung jadi satu kartu.
//   5. Jam yang tidak muat sebelum deadline dilaporkan di `unscheduled`.
// ==========================================================


// ==========================
// KONSTANTA
// ==========================

const DAY_MS = 24 * 60 * 60 * 1000;

const SESSION_HOURS = 1;        // ukuran satu blok belajar (jam)
const MIN_SESSION_HOURS = 0.5;  // sisa slot di bawah ini dianggap tidak terpakai
const MIN_HORIZON_DAYS = 56;    // jadwal dibuat minimal 8 minggu ke depan
const MAX_HORIZON_DAYS = 180;   // batas atas jika deadline sangat jauh
const EPS = 1e-6;

const PRIORITY_SCORE = {
  high: 100,
  medium: 60,
  low: 30
};

const dayMap = {
  "Minggu": 0,
  "Senin": 1,
  "Selasa": 2,
  "Rabu": 3,
  "Kamis": 4,
  "Jumat": 5,
  "Sabtu": 6
};


// ==========================
// HELPER TANGGAL & WAKTU
// (semua pakai waktu lokal, bukan UTC)
// ==========================

function round2(n){
  return Number(Number(n).toFixed(2));
}

function pad(n){
  return String(n).padStart(2, "0");
}

function startOfDay(date){
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// "2026-10-17" dalam waktu lokal (toISOString() memakai UTC dan bisa
// mundur satu hari untuk pengguna di WITA antara 00:00-08:00)
function formatDate(date){
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Deadline dianggap berakhir pada 23:59 hari tersebut (waktu lokal).
// Mendukung string "YYYY-MM-DD", Date, dan Firestore Timestamp.
function parseDeadline(value){

  if(!value) return null;

  if(typeof value.toDate === "function"){
    value = value.toDate();
  }

  if(typeof value === "string"){
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m){
      return new Date(
        Number(m[1]), Number(m[2]) - 1, Number(m[3]),
        23, 59, 59, 999
      );
    }
  }

  const d = new Date(value);
  if(isNaN(d.getTime())) return null;

  d.setHours(23, 59, 59, 999);
  return d;
}

// selisih hari kalender: 0 = hari ini, 1 = besok, negatif = sudah lewat
function daysBetween(from, to){
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

function timeToDecimal(time){

  if(typeof time !== "string") return NaN;

  const [hour, minute = 0] = time.split(":").map(Number);

  return hour + (minute / 60);
}

function decimalToTime(decimal){

  const totalMinutes = Math.round(decimal * 60);

  return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;
}


// ==========================
// HITUNG SISA JAM TASK
// ==========================

export function calculateRemainingHours(task){

  const duration = Number(task.duration || 0);

  const progress = Math.min(
    Math.max(Number(task.progress || 0), 0),
    100
  );

  return round2(duration * (100 - progress) / 100);
}


// ==========================
// DEADLINE PRESSURE SCORE
// `now` opsional: scheduler memakai tanggal slot, sehingga tugas
// terasa makin mendesak saat slotnya mendekati deadline.
// ==========================

export function calculateDeadlinePressure(task, now = new Date()){

  const deadline = parseDeadline(task.deadline);

  const daysLeft = deadline
    ? daysBetween(now, deadline)
    : Infinity;

  let deadlineScore;

  if(daysLeft <= 1){
    deadlineScore = 100;
  }
  else if(daysLeft <= 3){
    deadlineScore = 90;
  }
  else if(daysLeft <= 7){
    deadlineScore = 70;
  }
  else if(daysLeft <= 14){
    deadlineScore = 50;
  }
  else{
    deadlineScore = 30;
  }

  const priorityScore =
    PRIORITY_SCORE[String(task.priority || "").toLowerCase()] || 30;

  // memakai sisa jam, bukan durasi awal: tugas yang hampir selesai
  // tidak perlu terasa "berat"
  const durationScore = Math.min(
    calculateRemainingHours(task) * 10,
    100
  );

  const finalScore =
    (deadlineScore * 0.5) +
    (priorityScore * 0.3) +
    (durationScore * 0.2);

  return Number(finalScore.toFixed(1));
}


// ==========================
// TASK WEIGHT
// ==========================

export function calculateTaskWeight(tasks){

  const scored = tasks.map(task => ({
    task,
    score: calculateDeadlinePressure(task)
  }));

  const totalScore = scored.reduce(
    (sum, item) => sum + item.score,
    0
  );

  return scored.map(({ task, score }) => ({
    ...task,
    pressureScore: score,
    weight: totalScore === 0
      ? 0
      : Number((score / totalScore * 100).toFixed(1))
  }));
}


// ==========================
// JAM PER SLOT & KAPASITAS MINGGUAN
// endTime - startTime dipakai jika valid, kalau tidak pakai duration
// ==========================

function slotRange(slot){

  const start = timeToDecimal(slot.startTime);

  let end = timeToDecimal(slot.endTime);

  if(!(end > start)){
    end = start + Number(slot.duration || 0);
  }

  return { start, end };
}

function slotHours(slot){

  const { start, end } = slotRange(slot);

  const hours = end - start;

  return isFinite(hours) && hours > 0 ? hours : 0;
}

export function calculateWeeklyCapacity(slots){

  return round2(
    slots.reduce((total, slot) => total + slotHours(slot), 0)
  );
}


// ==========================
// TOTAL TASK HOURS
// ==========================

export function calculateTotalTaskHours(tasks){

  return round2(
    tasks.reduce(
      (total, task) => total + calculateRemainingHours(task),
      0
    )
  );
}


// ==========================
// DISTRIBUTE HOURS
// ==========================

export function distributeTaskHours(tasks, weeklyCapacity){

  return calculateTaskWeight(tasks).map(task => ({
    ...task,
    allocatedHours: Number(
      (weeklyCapacity * task.weight / 100).toFixed(2)
    )
  }));
}


// ==========================
// BALANCED QUEUE (tidak lagi dipakai scheduler, dipertahankan
// agar import lama tetap jalan)
// ==========================

export function createBalancedTaskQueue(tasks, weeklyCapacity){

  return distributeTaskHours(tasks, weeklyCapacity)
    .map(task => ({
      ...task,
      remainingHours: calculateRemainingHours(task)
    }))
    .sort((a, b) => b.pressureScore - a.pressureScore);
}


// ==========================
// SLOT NYATA (TANGGAL + JAM)
// ==========================

function buildSlotInstances(slots, now, horizonDays){

  const today = startOfDay(now);

  const nowDecimal = now.getHours() + (now.getMinutes() / 60);

  const instances = [];

  for(let i = 0; i <= horizonDays; i++){

    const day = new Date(today);
    day.setDate(today.getDate() + i);

    // kumpulkan jendela waktu hari ini, lalu gabungkan yang tumpang tindih
    // (misalnya slot yang tersimpan dua kali)
    const windows = [];

    for(const slot of slots){

      if(dayMap[slot.day] !== day.getDay()) continue;

      let { start, end } = slotRange(slot);

      if(!isFinite(start) || !isFinite(end)) continue;

      windows.push({ start, end });
    }

    windows.sort((a, b) => a.start - b.start);

    const merged = [];

    for(const window of windows){

      const last = merged[merged.length - 1];

      if(last && window.start <= last.end + EPS){
        last.end = Math.max(last.end, window.end);
      }
      else{
        merged.push({ ...window });
      }
    }

    for(let { start, end } of merged){

      // slot hari ini yang sudah berjalan: mulai dari kelipatan 15 menit berikutnya
      if(i === 0){
        start = Math.max(start, Math.ceil(nowDecimal * 4) / 4);
      }

      if(end - start < MIN_SESSION_HOURS - EPS) continue;

      instances.push({
        date: day,
        dateStr: formatDate(day),
        start,
        end,
        cursor: start
      });
    }
  }

  return instances.sort(
    (a, b) => (a.date - b.date) || (a.start - b.start)
  );
}

// total jam kosong dari slot ke-fromIndex sampai deadline
function freeHoursBefore(slots, fromIndex, deadline){

  let total = 0;

  for(let j = fromIndex; j < slots.length; j++){

    if(deadline && slots[j].date > deadline) break;

    const free = slots[j].end - slots[j].cursor;

    // sisa slot di bawah batas minimum tidak bisa dipakai
    if(free >= MIN_SESSION_HOURS - EPS) total += free;
  }

  return total;
}

function cmp(x, y){
  return x === y ? 0 : (x < y ? -1 : 1);
}

function deadlineTime(item){
  return item.deadline ? item.deadline.getTime() : Infinity;
}

// Memilih tugas untuk satu blok belajar.
//
// 1. Hitung "slack" tiap deadline: jam kosong sampai deadline itu
//    dikurangi total sisa jam semua tugas yang deadline-nya sama atau
//    lebih awal. Slack 0 berarti slot sampai deadline itu pas-pasan.
// 2. Sebuah tugas hanya boleh mengambil blok ini kalau tidak membuat
//    slack deadline lain menjadi negatif. Tugas yang sudah terlambat
//    (atau tanpa deadline) hanya boleh memakai slack yang masih tersisa.
// 3. Dari tugas yang boleh, ambil skor tertinggi (deadline terdekat,
//    prioritas, durasi).
function pickTask(open, slots, slotIndex, length, free, slotDate){

  const constrained = open.filter(
    item => !item.overdue && item.deadline
  );

  const times = [...new Set(
    constrained.map(item => item.deadline.getTime())
  )].sort((a, b) => a - b);

  const slacks = times.map(time => {

    const supply = freeHoursBefore(slots, slotIndex, new Date(time));

    const demand = constrained
      .filter(item => item.deadline.getTime() <= time)
      .reduce((sum, item) => sum + item.remaining, 0);

    return { time, slack: supply - demand };
  });

  const allowed = open.filter(item => {

    const used = Math.min(length, item.remaining);

    const leftover = free - used;

    // sisa slot yang terlalu kecil untuk dipakai ikut hangus
    const waste =
      leftover > EPS && leftover < MIN_SESSION_HOURS - EPS
        ? leftover
        : 0;

    const hasDeadline = !item.overdue && Boolean(item.deadline);

    return slacks.every(({ time, slack }) => {

      // blok ini ikut mengurangi kebutuhan deadline yang sama atau lebih akhir
      const reducesDemand = hasDeadline && item.deadline.getTime() <= time;

      const after = reducesDemand
        ? slack - waste
        : slack - used - waste;

      return after >= Math.min(slack, 0) - EPS;
    });
  });

  // seharusnya tidak pernah kosong (tugas dengan deadline terdekat selalu
  // boleh), tapi jaga-jaga: pakai deadline terdekat
  if(allowed.length === 0){
    return [...constrained].sort(
      (a, b) => cmp(deadlineTime(a), deadlineTime(b))
    )[0];
  }

  const scored = allowed.map(item => ({
    item,
    score: calculateDeadlinePressure(item.task, slotDate)
  }));

  scored.sort((a, b) =>
    (b.score - a.score) ||
    cmp(deadlineTime(a.item), deadlineTime(b.item))
  );

  return scored[0].item;
}


// ==========================
// SCHEDULER UTAMA
// Mengembalikan { schedules, unscheduled, overdueTasks }
//   schedules   : siap disimpan ke studySchedules
//   unscheduled : tugas yang jamnya tidak muat sebelum deadline
//   overdueTasks: tugas yang deadline-nya sudah lewat
// options.now dan options.sessionHours opsional (berguna untuk tes)
// ==========================

export function generateSchedulePlan(tasks, availableSlots, options = {}){

  const now = options.now ? new Date(options.now) : new Date();

  const sessionHours = Number(options.sessionHours) > 0
    ? Number(options.sessionHours)
    : SESSION_HOURS;

  const result = {
    schedules: [],
    unscheduled: [],
    overdueTasks: []
  };


  // 1. siapkan tugas (sisa jam dibulatkan ke atas per 15 menit)
  const items = tasks
    .map(task => {

      const deadline = parseDeadline(task.deadline);

      return {
        task,
        id: task.id,
        title: task.title,
        course: task.course || "",
        deadline,
        overdue: deadline ? deadline < now : false,
        remaining: Math.ceil(calculateRemainingHours(task) * 4) / 4
      };
    })
    .filter(item => item.remaining > EPS);

  if(items.length === 0) return result;

  result.overdueTasks = items
    .filter(item => item.overdue)
    .map(item => ({
      taskId: item.id,
      title: item.title,
      deadline: formatDate(item.deadline)
    }));


  // 2. slot nyata sampai deadline terjauh (minimal 8 minggu)
  const latest = items.reduce(
    (max, item) =>
      item.deadline && item.deadline > max ? item.deadline : max,
    now
  );

  const horizonDays = Math.min(
    Math.max(daysBetween(now, latest), MIN_HORIZON_DAYS),
    MAX_HORIZON_DAYS
  );

  const slots = buildSlotInstances(availableSlots, now, horizonDays);


  // 3. isi slot secara kronologis, blok demi blok
  const blocks = [];

  scheduling:
  for(let i = 0; i < slots.length; i++){

    const slot = slots[i];

    while(slot.end - slot.cursor >= MIN_SESSION_HOURS - EPS){

      // tugas yang masih punya sisa dan deadline-nya belum lewat di tanggal slot ini
      const open = items.filter(item =>
        item.remaining > EPS &&
        (item.overdue || !item.deadline || slot.date <= item.deadline)
      );

      // slot makin lama makin jauh dari hari ini, jadi kalau sudah
      // tidak ada kandidat, slot berikutnya juga tidak akan ada
      if(open.length === 0) break scheduling;

      const free = slot.end - slot.cursor;

      let length = Math.min(sessionHours, free);

      // sisa slot terlalu kecil untuk satu blok lagi -> ambil semuanya
      if(free - length < MIN_SESSION_HOURS - EPS){
        length = free;
      }

      const chosen = pickTask(open, slots, i, length, free, slot.date);

      const used = Math.min(length, chosen.remaining);

      blocks.push({
        item: chosen,
        dateStr: slot.dateStr,
        start: slot.cursor,
        end: slot.cursor + used
      });

      chosen.remaining -= used;
      slot.cursor += used;

      if(chosen.remaining < EPS) chosen.remaining = 0;
    }
  }


  // 4. gabungkan blok berurutan milik tugas yang sama
  const merged = [];

  for(const block of blocks){

    const last = merged[merged.length - 1];

    if(
      last &&
      last.item === block.item &&
      last.dateStr === block.dateStr &&
      Math.abs(last.end - block.start) < EPS
    ){
      last.end = block.end;
    }
    else{
      merged.push({ ...block });
    }
  }

  result.schedules = merged.map(block => ({
    taskId: block.item.id,
    title: block.item.title,
    course: block.item.course,
    date: block.dateStr,
    startTime: decimalToTime(block.start),
    endTime: decimalToTime(block.end),
    duration: round2(block.end - block.start),
    overdue: block.item.overdue,
    status: "planned"
  }));


  // 5. laporkan yang tidak muat
  result.unscheduled = items
    .filter(item => item.remaining > EPS)
    .map(item => ({
      taskId: item.id,
      title: item.title,
      hours: round2(item.remaining),
      deadline: item.deadline ? formatDate(item.deadline) : null,
      reason: item.overdue
        ? "Deadline sudah lewat dan slot belajar tidak cukup"
        : "Slot belajar sebelum deadline tidak cukup"
    }));

  return result;
}


// ==========================
// KOMPATIBILITAS: tetap mengembalikan array jadwal saja
// ==========================

export function generateBalancedSchedule(tasks, availableSlots, options){

  return generateSchedulePlan(tasks, availableSlots, options).schedules;
}


// ==========================
// KEKURANGAN WAKTU
// Dihitung dari data yang tersimpan (tugas + jadwal), jadi tetap
// muncul setelah halaman dimuat ulang. Hanya sesi hari ini dan
// seterusnya yang dihitung sebagai jam yang sudah terjadwal.
// ==========================

export function calculateShortages(tasks, schedules, now = new Date()){

  const today = formatDate(now);

  return tasks
    .map(task => {

      const deadline = parseDeadline(task.deadline);

      const needed = Math.ceil(calculateRemainingHours(task) * 4) / 4;

      const scheduled = schedules
        .filter(item =>
          item.taskId === task.id &&
          String(item.date) >= today
        )
        .reduce((sum, item) => sum + Number(item.duration || 0), 0);

      return {
        taskId: task.id,
        title: task.title,
        deadline: deadline ? formatDate(deadline) : null,
        overdue: deadline ? deadline < now : false,
        needed: round2(needed),
        scheduled: round2(scheduled),
        missing: round2(needed - scheduled)
      };
    })
    .filter(item => item.needed > 0 && item.missing > 0.01)
    .sort((a, b) =>
      (a.deadline || "9999-12-31").localeCompare(b.deadline || "9999-12-31")
    );
}


// ==========================
// CEK BENTROK WAKTU BELAJAR
// Dipakai form "Atur Waktu Belajar" sebelum menyimpan. Mengembalikan
// { slot, duplicate } untuk slot pertama yang bentrok di hari yang sama,
// atau null kalau aman. Slot yang hanya bersentuhan
// (19:00-20:00 dan 20:00-21:00) tidak dianggap bentrok.
// ==========================

export function findSlotConflict(existingSlots, day, startTime, endTime){

  const start = timeToDecimal(startTime);

  const end = timeToDecimal(endTime);

  for(const slot of existingSlots){

    if(slot.day !== day) continue;

    const range = slotRange(slot);

    if(!isFinite(range.start) || !isFinite(range.end)) continue;

    if(start < range.end - EPS && end > range.start + EPS){

      return {
        slot,
        duplicate:
          Math.abs(range.start - start) < EPS &&
          Math.abs(range.end - end) < EPS
      };
    }
  }

  return null;
}


// ==========================
// SESI MILIK TUGAS AKTIF
// Jadwal tersimpan di Firestore tidak ikut terhapus saat tugasnya
// selesai atau dihapus. Fungsi ini menyaring supaya yang ditampilkan
// hanya sesi dari tugas yang masih aktif (status pending dan masih
// ada sisa jam). Kirim hanya tugas berstatus pending sebagai argumen.
// ==========================

export function filterActiveSchedules(activeTasks, schedules){

  const activeIds = new Set(
    activeTasks
      .filter(task => calculateRemainingHours(task) > 0)
      .map(task => task.id)
  );

  return schedules.filter(item => activeIds.has(item.taskId));
}


// ==========================
// WORKLOAD ANALYSIS
// status: "normal" | "warning" | "overload"
// ==========================

export function analyzeWorkload(tasks, slots, options = {}){

  const weeklyCapacity = calculateWeeklyCapacity(slots);

  const totalTaskHours = calculateTotalTaskHours(tasks);

  const plan = generateSchedulePlan(tasks, slots, options);

  const unscheduledHours = round2(
    plan.unscheduled.reduce((sum, item) => sum + item.hours, 0)
  );

  let status = "normal";

  let message = "Beban belajar masih aman.";

  if(weeklyCapacity === 0){

    status = "overload";

    message = "Belum ada waktu belajar. Tambahkan dulu di form waktu belajar.";
  }
  else if(unscheduledHours > 0){

    status = "overload";

    message =
      `${unscheduledHours} jam tugas tidak muat sebelum deadline. ` +
      "Tambah waktu belajar atau geser deadline.";
  }
  else if(plan.overdueTasks.length > 0){

    status = "warning";

    message =
      `${plan.overdueTasks.length} tugas sudah lewat deadline. ` +
      "Tetap dijadwalkan secepatnya.";
  }
  else if(totalTaskHours > weeklyCapacity){

    status = "warning";

    message = "Waktu belajar mulai terbatas.";
  }

  return {

    weeklyCapacity,

    totalTaskHours,

    utilization:
      weeklyCapacity === 0
        ? 0
        : Number((totalTaskHours / weeklyCapacity * 100).toFixed(1)),

    unscheduledHours,

    overdueCount: plan.overdueTasks.length,

    status,

    message
  };
}


// ==========================
// SORT TASK
// ==========================

export function sortTasks(tasks){

  return [...tasks].sort(
    (a, b) =>
      calculateDeadlinePressure(b) -
      calculateDeadlinePressure(a)
  );
}
