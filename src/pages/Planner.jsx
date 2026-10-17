import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import MobileNavbar from "../components/MobileNavbar";

import { useSidebar } from "../context/SidebarContext";
import StudyTimeForm from "../components/StudyTimeForm";
import StudySlotList from "../components/StudySlotList";

import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  deleteDoc,
  doc
} from "firebase/firestore";

import { db } from "../services/firebase";

import { useAuth } from "../context/AuthContext";

import { useState, useEffect } from "react";

import {
  sortTasks,
  analyzeWorkload,
  calculateDeadlinePressure,
  calculateTaskWeight,
  distributeTaskHours,
  calculateWeeklyCapacity,
  generateSchedulePlan,
  calculateShortages,
  filterActiveSchedules
} from "../utils/plannerEngine";

import ScheduleCard from "../components/ScheduleCard";


export default function Planner(){


const {user}=useAuth();


const {
collapsed
}=useSidebar();




const [tasks,setTasks]=useState([]);

const [schedules,setSchedules]=useState([]);

const [workload,setWorkload]=useState(null);




// ==========================
// LOAD TASK
// ==========================

async function loadTasks(){


if(!user) return;



const q=query(

collection(db,"tasks"),

where(
"userId",
"==",
user.uid
)

);



const snapshot =
await getDocs(q);



const data =
snapshot.docs.map(item=>({


id:item.id,


...item.data()


}));



setTasks(data);


}






// ==========================
// LOAD SCHEDULE
// ==========================

async function loadSchedules(){


if(!user) return;



const q=query(

collection(db,"studySchedules"),

where(
"userId",
"==",
user.uid
)

);



const snapshot =
await getDocs(q);



const data =

snapshot.docs

.map(item=>({


id:item.id,


...item.data()


}))


.sort(

(a,b)=>

new Date(a.date)
-
new Date(b.date)
||
String(a.startTime || "").localeCompare(String(b.startTime || ""))

);



setSchedules(data);



}







useEffect(()=>{


if(user){

loadTasks();

loadSchedules();

}


},[user]);









// ==========================
// LOAD STUDY SLOT
// ==========================

async function getStudySlots(){


if(!user) return [];



const q=query(

collection(db,"studyPreferences"),

where(
"userId",
"==",
user.uid
)

);



const snapshot =
await getDocs(q);



return snapshot.docs.map(item=>({


id:item.id,


...item.data()


}));



}








// ==========================
// DELETE OLD SCHEDULE
// ==========================

async function clearOldSchedules(){



const q=query(

collection(db,"studySchedules"),

where(
"userId",
"==",
user.uid
)

);



const snapshot =
await getDocs(q);



for(
const item of snapshot.docs
){


await deleteDoc(

doc(

db,

"studySchedules",

item.id

)

);


}


}









// ==========================
// GENERATE SMART SCHEDULE
// ==========================

async function handleGenerateSchedule(){



const activeTasks =

tasks.filter(

task=>

task.status==="pending"

);





if(activeTasks.length===0){


alert(
"Belum ada tugas aktif"
);


return;


}






const slots =
await getStudySlots();

const workloadData =
analyzeWorkload(
activeTasks,
slots
);


setWorkload(workloadData);


console.log(
"WORKLOAD ANALYSIS:",
workloadData
);



if(slots.length===0){


alert(
"Tambahkan waktu belajar terlebih dahulu"
);


return;


}






// hapus jadwal lama

// (jadwal lama baru dihapus setelah jadwal baru berhasil dibuat, lihat di bawah)



let generated=[];

let plan=null;


// ==========================
// V6.2 BALANCED SCHEDULER
// ==========================


console.log(
"DEADLINE SCORE",

activeTasks.map(task=>({

title:task.title,

score:
calculateDeadlinePressure(task)

}))

);


console.log(
"TASK WEIGHT",

calculateTaskWeight(activeTasks)

);



console.log(
"ALLOCATION",

distributeTaskHours(

activeTasks,

calculateWeeklyCapacity(slots)

)

);




// generate dengan adaptive scheduler

plan =

generateSchedulePlan(

activeTasks,

slots

);











generated = plan.schedules;



if(generated.length===0){



alert(
"Jadwal belum dapat dibuat. Waktu belajar sebelum deadline tidak cukup, tambah slot belajar atau geser deadline."
);



return;


}








// hapus jadwal lama (setelah jadwal baru dipastikan berhasil dibuat)

await clearOldSchedules();



// simpan firebase

for(
const item of generated
){



await addDoc(

collection(

db,

"studySchedules"

),

{


...item,


userId:user.uid,


createdAt:new Date()


}


);


}








generated.sort(

(a,b)=>

new Date(a.date)

-

new Date(b.date)

);





setSchedules(generated);





alert(
plan.unscheduled.length>0

?

"Jadwal dibuat, tapi ada tugas yang kekurangan waktu belajar. Lihat bagian Belum Terjadwal di bagian bawah halaman."

:

"Jadwal belajar berhasil dibuat"
);



}









const activeTasks =

tasks.filter(

task=>

task.status==="pending"

);







const totalHours =

activeTasks.reduce(

(sum,task)=>

sum+

Number(task.duration || 0),

0

);








// hanya sesi dari tugas yang masih aktif yang ditampilkan: jadwal lama
// di Firestore tidak otomatis terhapus saat tugasnya selesai

const visibleSchedules =

filterActiveSchedules(activeTasks,schedules);







// tugas yang jamnya belum masuk jadwal (dihitung dari data tersimpan,
// baru ditampilkan setelah jadwal pernah dibuat)

const shortages =

schedules.length>0

?

calculateShortages(activeTasks,schedules)

:

[];







const totalMissingHours =

shortages.reduce(

(sum,item)=>sum+item.missing,

0

);







const overdueTasks =

activeTasks.filter(

task=>

task.deadline &&

new Date(`${task.deadline}T23:59:59`) < new Date()

);







const nearestDeadline =


activeTasks.length>0


?


[...activeTasks].sort(

(a,b)=>

new Date(a.deadline)

-

new Date(b.deadline)

)[0]


:

null;








return (
  <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50">
    <Sidebar />

    <main
      className={`min-w-0 flex-1 px-4 pb-10 pt-5 transition-all duration-300 sm:px-6 lg:px-8 ${
        collapsed ? "lg:ml-20" : "lg:ml-64"
      }`}
    >
      <MobileNavbar />
      <Navbar />

      <div className="mx-auto w-full max-w-7xl">
        <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              Perencanaan belajar
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Study Planner
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Atur waktu belajar dan susun jadwal berdasarkan kebutuhan serta deadline tugas.
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            Perencanaan mingguan
          </div>
        </header>

        <section className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Tugas aktif</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              {activeTasks.length}
            </p>
            <p className="mt-1 text-sm text-slate-500">Tugas yang belum selesai</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total estimasi pengerjaan</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              {totalHours} <span className="text-lg font-semibold text-slate-500">jam</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">Akumulasi durasi tugas aktif</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
            <p className="text-sm font-medium text-slate-500">Deadline terdekat</p>
            <p className="mt-3 text-xl font-bold tracking-tight text-slate-900">
              {nearestDeadline
                ? new Date(nearestDeadline.deadline).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                  })
                : "Belum ada deadline"}
            </p>
            <p className="mt-1 truncate text-sm text-slate-500">
              {nearestDeadline ? nearestDeadline.title : "Tambahkan tugas untuk melihat deadline"}
            </p>
          </div>
        </section>

        <section className="mt-7 space-y-6">
          <StudySlotList>
            <StudyTimeForm />
          </StudySlotList>

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                  Ringkasan
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  Analisis beban belajar
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Perbandingan kebutuhan tugas dengan waktu belajar yang tersedia.
                </p>
              </div>
            </div>

            {workload && activeTasks.length > 0 ? (
              <div className="mt-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">Kapasitas mingguan</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {workload.weeklyCapacity}
                      <span className="ml-1 text-sm font-medium text-slate-500">jam</span>
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">Kebutuhan tugas</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {workload.totalTaskHours}
                      <span className="ml-1 text-sm font-medium text-slate-500">jam</span>
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">Utilisasi</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {workload.utilization}%
                    </p>
                  </div>
                </div>

                <div
                  className={`mt-4 rounded-xl border p-4 ${
                    workload.status === "overload"
                      ? "border-red-200 bg-red-50"
                      : workload.status === "warning"
                      ? "border-amber-200 bg-amber-50"
                      : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p
                      className={`text-sm font-semibold ${
                        workload.status === "overload"
                          ? "text-red-700"
                          : workload.status === "warning"
                          ? "text-amber-700"
                          : "text-emerald-700"
                      }`}
                    >
                      {workload.status === "overload"
                        ? "Beban belajar tinggi"
                        : workload.status === "warning"
                        ? "Waktu belajar perlu diperhatikan"
                        : "Beban belajar terkendali"}
                    </p>
                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                        workload.status === "overload"
                          ? "bg-red-100 text-red-700"
                          : workload.status === "warning"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {workload.status === "overload"
                        ? "Perlu penyesuaian"
                        : workload.status === "warning"
                        ? "Perlu perhatian"
                        : "Aman"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {workload.message}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                <p className="font-semibold text-slate-800">
                  Analisis belum tersedia
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Buat jadwal belajar untuk melihat kapasitas mingguan, kebutuhan waktu, dan status beban tugas.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerateSchedule}
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              Generate Jadwal Otomatis
            </button>
          </div>
        </section>

        <section className="mt-9">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                Rencana kamu
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                Jadwal Belajar Saya
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Sesi belajar yang sudah disusun berdasarkan waktu dan deadline.
              </p>
            </div>
            <span className="w-fit rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600">
              {visibleSchedules.length} sesi
            </span>
          </div>

          {overdueTasks.length > 0 && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
              <p className="font-semibold">
                Ada {overdueTasks.length} tugas yang sudah melewati deadline
              </p>
              <p className="mt-1">
                <span className="font-medium">
                  {overdueTasks.map(task => task.title).join(", ")}
                </span>
                . Tugas ini dijadwalkan menggunakan slot yang tersisa setelah tugas yang masih dapat dikejar deadline-nya. Ubah deadline di halaman Tugas atau tandai selesai jika sudah dikerjakan.
              </p>
            </div>
          )}

          {visibleSchedules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <h3 className="text-lg font-semibold text-slate-800">
                {activeTasks.length === 0
                  ? "Tidak ada tugas aktif"
                  : "Belum ada jadwal belajar"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {activeTasks.length === 0
                  ? "Semua tugas sudah selesai. Tambahkan tugas baru di halaman Tugas untuk menyusun jadwal belajar."
                  : "Atur waktu belajar terlebih dahulu, lalu pilih Generate Jadwal Otomatis untuk menyusun rencana belajar."}
              </p>
            </div>
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {visibleSchedules.map(item => (
                <ScheduleCard
                  key={item.id || `${item.taskId}-${item.date}-${item.startTime}`}
                  schedule={item}
                />
              ))}
            </div>
          )}
        </section>

        {shortages.length > 0 && (
          <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-amber-900">
                  Tugas yang belum terjadwalkan
                </h2>
                <p className="mt-2 text-sm leading-6 text-amber-800">
                  Waktu belajar yang tersedia belum cukup untuk {shortages.length} tugas. Total kekurangan waktu adalah{" "}
                  <strong>{Number(totalMissingHours.toFixed(2))} jam</strong>.
                  Tambah slot belajar atau sesuaikan deadline, lalu generate ulang jadwal.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {shortages.map(item => (
                <div
                  key={item.taskId}
                  className="flex min-w-0 flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-900">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Deadline:{" "}
                      {item.deadline
                        ? new Date(`${item.deadline}T00:00:00`).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                          })
                        : "-"}
                      {item.overdue && (
                        <span className="ml-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Terlambat
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 sm:text-right">
                    <p className="font-semibold text-amber-800">
                      Kurang {item.missing} jam
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Terjadwal {item.scheduled} dari {item.needed} jam
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  </div>
);
}
