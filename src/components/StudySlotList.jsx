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


export default function StudySlotList({ children }) {
  const { user } = useAuth();
  const [slots, setSlots] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  // Daftar diperbarui otomatis ketika preferensi belajar berubah di Firestore.
  useEffect(() => {
    if (!user) return;

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

  // Hapus slot waktu belajar dari Firebase.
  async function handleDelete(slot) {
    const ok = window.confirm(
      `Hapus waktu belajar ${slot.day} ${slot.startTime} - ${slot.endTime}?`
    );

    if (!ok) return;

    try {
      setDeletingId(slot.id);
      await deleteDoc(doc(db, "studyPreferences", slot.id));
    } catch (error) {
      console.error("Gagal menghapus waktu belajar:", error);
      window.alert("Gagal menghapus waktu belajar. Silakan coba lagi.");
    } finally {
      setDeletingId(null);
    }
  }

  // Tandai entri yang sama persis dengan entri sebelumnya.
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

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            Preferensi belajar
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Waktu Belajar Saya
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
            Slot waktu luang yang digunakan untuk menyusun jadwal belajar otomatis.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <span className="w-fit whitespace-nowrap rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
            {slots.length} slot <span className="px-1 text-slate-300">·</span>{" "}
            {Number(totalHours.toFixed(2))} jam/minggu
          </span>
          {children && <div className="w-full sm:w-auto">{children}</div>}
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
          <p className="font-semibold text-slate-800">Belum ada waktu belajar</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Tambahkan hari dan jam luang agar Study Planner dapat menyusun jadwal untuk tugas aktif.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(slot => (
            <article
              key={slot.id}
              className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-colors hover:border-slate-300"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                    <span>{slot.day}</span>
                    {slot.duplicate && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Duplikat
                      </span>
                    )}
                  </p>
                  <p className="mt-2 break-words text-sm font-medium tabular-nums text-slate-700">
                    {slot.startTime} - {slot.endTime}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold tabular-nums text-slate-600">
                    {Number(slot.duration || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })} jam
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(slot)}
                    disabled={deletingId === slot.id}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === slot.id ? "Menghapus..." : "Hapus"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-slate-400">
        Setelah menambah atau menghapus waktu belajar, jalankan Generate Jadwal Otomatis kembali agar jadwal menggunakan slot terbaru.
      </p>
    </section>
  );
}
