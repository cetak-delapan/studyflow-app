import {useState} from "react";
import {
collection,
addDoc,
getDocs,
query,
where
} from "firebase/firestore";

import {db} from "../services/firebase";

import {useAuth} from "../context/AuthContext";

import {findSlotConflict} from "../utils/plannerEngine";


export default function StudyTimeForm(){

const [day,setDay]=useState("Senin");

const [start,setStart]=useState("");

const [end,setEnd]=useState("");

const [saving,setSaving]=useState(false);
const [isOpen,setIsOpen]=useState(false);

const {user}=useAuth();

function calculateDuration(start,end){


const startTime =
new Date(`2026-01-01T${start}`);


const endTime =
new Date(`2026-01-01T${end}`);



const diff =
(endTime-startTime)
/
(1000*60*60);



return Number(diff.toFixed(2));


}

async function saveStudyTime(){


// cegah klik ganda saat data masih dikirim
if(saving) return;


if(!user){

alert("Silakan login terlebih dahulu");

return;

}


if(!start || !end){

alert("Jam belajar belum lengkap");

return;

}



const duration =
calculateDuration(
start,
end
);



if(duration<=0){

alert(
"Jam selesai harus lebih besar dari jam mulai"
);

return;

}



try{

setSaving(true);


// cek waktu belajar yang sudah ada di hari yang sama
const snapshot =
await getDocs(

query(

collection(db,"studyPreferences"),

where("userId","==",user.uid)

)

);


const existing =
snapshot.docs.map(item=>item.data());


const conflict =
findSlotConflict(
existing,
day,
start,
end
);


if(conflict){

alert(

conflict.duplicate

?

`Waktu belajar ${day} ${start} - ${end} sudah ada.`

:

`Bentrok dengan waktu belajar yang sudah ada: ${day} ${conflict.slot.startTime} - ${conflict.slot.endTime}. Hapus yang lama dulu kalau ingin menggantinya.`

);

return;

}



await addDoc(

collection(db,"studyPreferences"),

{

userId:user.uid,

day,

startTime:start,

endTime:end,

duration,


createdAt:new Date()

}

);



alert(
"Waktu belajar berhasil disimpan"
);



setStart("");

setEnd("");

setIsOpen(false);

}
catch(error){

console.error(error);

alert("Gagal menyimpan waktu belajar");

}
finally{

setSaving(false);

}

}

return (
  <>
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 sm:w-auto"
    >
      Tambah Waktu Belajar
    </button>

    {isOpen && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
        onClick={event => {
          if (event.target === event.currentTarget) {
            setIsOpen(false);
          }
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="study-time-modal-title"
          className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          onClick={event => event.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                Preferensi belajar
              </p>
              <h2
                id="study-time-modal-title"
                className="mt-1 text-xl font-bold tracking-tight text-slate-900"
              >
                Atur Waktu Belajar
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Pilih waktu luang yang rutin tersedia setiap minggu.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Tutup modal"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-100"
            >
              ×
            </button>
          </header>

          <form
            onSubmit={event => {
              event.preventDefault();
              saveStudyTime();
            }}
            className="space-y-5 p-5 sm:p-6"
          >
            <div>
              <label
                htmlFor="study-day"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Hari
              </label>
              <select
                id="study-day"
                value={day}
                onChange={event => setDay(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
              >
                <option>Senin</option>
                <option>Selasa</option>
                <option>Rabu</option>
                <option>Kamis</option>
                <option>Jumat</option>
                <option>Sabtu</option>
                <option>Minggu</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="study-start"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Jam mulai
                </label>
                <input
                  id="study-start"
                  type="time"
                  value={start}
                  onChange={event => setStart(event.target.value)}
                  className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div>
                <label
                  htmlFor="study-end"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Jam selesai
                </label>
                <input
                  id="study-end"
                  type="time"
                  value={end}
                  onChange={event => setEnd(event.target.value)}
                  className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                />
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-sm leading-6 text-slate-600">
                Pastikan jam selesai lebih besar daripada jam mulai. Sistem akan menghitung durasi belajar secara otomatis.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Menyimpan..." : "Simpan waktu"}
              </button>
            </div>
          </form>
        </section>
      </div>
    )}
  </>
);
}
