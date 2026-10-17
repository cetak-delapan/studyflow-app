import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../services/firebase";

function getRegisterErrorMessage(error) {
  switch (error?.code) {
    case "auth/email-already-in-use":
      return "Email ini sudah terdaftar. Silakan login atau gunakan email lain.";
    case "auth/invalid-email":
      return "Format email tidak valid.";
    case "auth/weak-password":
      return "Password terlalu lemah. Gunakan minimal 6 karakter.";
    case "auth/network-request-failed":
      return "Koneksi bermasalah. Periksa internet lalu coba lagi.";
    default:
      return "Registrasi gagal. Periksa data yang kamu masukkan lalu coba lagi.";
  }
}

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    university: "",
    major: "",
    semester: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleRegister(event) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password
      );

      const newUser = userCredential.user;

      await setDoc(doc(db, "users", newUser.uid), {
        name: form.name.trim(),
        email: form.email.trim(),
        university: form.university.trim(),
        major: form.major.trim(),
        semester: Number(form.semester),
        createdAt: new Date(),
      });

      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErrorMessage(getRegisterErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:px-6">
      <section className="w-full max-w-2xl">
        <div className="mb-7 text-center">
          <Link to="/register" className="inline-flex text-3xl font-extrabold tracking-tight text-slate-900" aria-label="StudyFlow">
            Study<span className="text-blue-600">Flow</span>
          </Link>
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Mulai perjalanan belajarmu
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Buat akun StudyFlow
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Isi informasi berikut untuk menyiapkan ruang belajarmu.
          </p>
        </div>

        <form
          onSubmit={handleRegister}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="register-name" className="mb-2 block text-sm font-semibold text-slate-700">
                Nama lengkap
              </label>
              <input
                id="register-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Masukkan nama lengkap"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="register-email" className="mb-2 block text-sm font-semibold text-slate-700">
                Email
              </label>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nama@email.com"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="register-password" className="mb-2 block text-sm font-semibold text-slate-700">
                Password
              </label>
              <input
                id="register-password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Minimal 6 karakter"
                value={form.password}
                onChange={handleChange}
                minLength={6}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="register-university" className="mb-2 block text-sm font-semibold text-slate-700">
                Universitas
              </label>
              <input
                id="register-university"
                name="university"
                type="text"
                autoComplete="organization"
                placeholder="Nama universitas"
                value={form.university}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="register-major" className="mb-2 block text-sm font-semibold text-slate-700">
                Program studi
              </label>
              <input
                id="register-major"
                name="major"
                type="text"
                placeholder="Nama program studi"
                value={form.major}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="register-semester" className="mb-2 block text-sm font-semibold text-slate-700">
                Semester
              </label>
              <input
                id="register-semester"
                name="semester"
                type="number"
                min="1"
                max="14"
                step="1"
                placeholder="Contoh: 4"
                value={form.semester}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Membuat akun..." : "Buat akun"}
          </button>

          <p className="mt-6 text-center text-sm text-slate-600">
            Sudah punya akun?{" "}
            <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
              Login
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
