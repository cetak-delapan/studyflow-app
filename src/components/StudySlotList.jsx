import { useEffect, useState } from "react";

import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc
} from "firebase/firestore";

import { db } from "../services/firebase";

import { useAuth } from "../context/AuthContext";


const DAY_ORDER = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu"
];


export default function StudySlotList(){

  const { user } = useAuth();

  const [slots, setSlots] = useState([]);

  const [deletingId, setDeletingId] = useState(null);


  // realtime: daftar otomatis ikut berubah saat form menambah data
  useEffect(() => {

    if(!user) return;

    const q = query(
      collection(db, "studyPreferences"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(

      q,

      snapshot => {

        const data = snapshot.docs
          .map(item => ({
            id: item.id,
            ...item.data()
          }))
          .sort((a, b) =>
            (DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)) ||
            String(a.startTime || "").localeCompare(String(b.startTime || ""))
          );

        setSlots(data);
      },

      error => {
        console.error("Gagal memuat waktu belajar:", error);
      }

    );

    return unsubscribe;

  }, [user]);


  async function handleDelete(slot){

    const ok = window.confirm(
      `Hapus waktu belajar ${slot.day} ${slot.startTime} - ${slot.endTime}?`
    );

    if(!ok) return;

    try{

      setDeletingId(slot.id);

      await deleteDoc(doc(db, "studyPreferences", slot.id));

    }
    catch(error){

      console.error(error);

      alert("Gagal menghapus waktu belajar");

    }
    finally{

      setDeletingId(null);

    }
  }


  // tandai entri yang sama persis dengan entri sebelumnya
  const seen = new Set();

  const rows = slots.map(slot => {

    const key = `${slot.day}|${slot.startTime}|${slot.endTime}`;

    const duplicate = seen.has(key);

    seen.add(key);

    return { ...slot, duplicate };
  });


  const totalHours = slots.reduce(
    (sum, slot) => sum + Number(slot.duration || 0),
    0
  );


  return(

    <div className="bg-white rounded-2xl shadow p-6">

      <div className="flex items-center justify-between">

        <h2 className="text-xl font-bold">
          🕒 Waktu Belajar Saya
        </h2>

        <span className="text-sm text-gray-500">
          {slots.length} slot · {totalHours} jam/minggu
        </span>

      </div>


      {
        rows.length === 0

        ?

        <p className="mt-4 text-gray-500 text-sm">
          Belum ada waktu belajar. Tambahkan lewat form di atas.
        </p>

        :

        <div className="mt-4 space-y-3">

          {
            rows.map(slot => (

              <div
                key={slot.id}
                className="
                flex
                items-center
                justify-between
                bg-gray-50
                rounded-xl
                px-4
                py-3
                "
              >

                <div>

                  <p className="font-semibold">

                    {slot.day}

                    {
                      slot.duplicate && (

                        <span className="
                        ml-2
                        text-xs
                        bg-yellow-100
                        text-yellow-700
                        rounded-full
                        px-2
                        py-0.5
                        ">
                          Duplikat
                        </span>

                      )
                    }

                  </p>

                  <p className="text-sm text-gray-500">
                    {slot.startTime} - {slot.endTime} · {slot.duration} jam
                  </p>

                </div>


                <button

                  onClick={() => handleDelete(slot)}

                  disabled={deletingId === slot.id}

                  className="
                  text-sm
                  text-red-600
                  border
                  border-red-200
                  rounded-lg
                  px-3
                  py-1
                  hover:bg-red-50
                  disabled:opacity-50
                  "

                >

                  {deletingId === slot.id ? "Menghapus..." : "🗑️ Hapus"}

                </button>

              </div>

            ))
          }

        </div>
      }


      <p className="mt-4 text-xs text-gray-400">
        Setelah menambah atau menghapus waktu belajar, klik
        Generate Jadwal Otomatis lagi supaya jadwalnya diperbarui.
      </p>

    </div>

  );

}
