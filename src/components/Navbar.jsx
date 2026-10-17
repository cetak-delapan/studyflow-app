
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);

  const hour = new Date().getHours();

  let greeting = "Selamat Pagi";

  if (hour >= 12 && hour < 18) {
    greeting = "Selamat Siang";
  } else if (hour >= 18) {
    greeting = "Selamat Malam";
  }

  useEffect(() => {
    let cancelled = false;

    async function getProfile() {
      if (!user) {
        setProfile(null);
        return;
      }

      try {
        const ref = doc(db, "users", user.uid);
        const snapshot = await getDoc(ref);

        if (!cancelled) {
          setProfile(
            snapshot.exists() ? snapshot.data() : null
          );
        }
      } catch (error) {
        console.error("Gagal memuat profil:", error);
      }
    }

    getProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div
      className="
        mb-8 rounded-2xl border border-slate-200
        bg-white px-6 py-6 shadow-sm
        md:px-8 md:py-7
      "
    >
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
        {greeting},{" "}
        {profile?.name || "Mahasiswa"}
      </h1>

      <p className="mt-2 text-sm text-slate-500 md:text-base">
        Mahasiswa Program Studi {profile?.major || ""}
      </p>
    </div>
  );
}
