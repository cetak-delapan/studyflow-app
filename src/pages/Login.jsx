import { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { auth } from "../services/firebase";
import { useAuth } from "../context/AuthContext";

function getLoginErrorMessage(error) {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Email atau password belum sesuai. Periksa kembali data akunmu.";
    case "auth/invalid-email":
      return "Format email tidak valid.";
    case "auth/too-many-requests":
      return "Terlalu banyak percobaan login. Coba lagi beberapa saat.";
    case "auth/network-request-failed":
      return "Koneksi bermasalah. Periksa internet lalu coba lagi.";
    default:
      return "Login gagal. Periksa data akun dan coba lagi.";
  }
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Jika sesi login masih aktif, arahkan setelah status autentikasi diketahui.
  useEffect(() => {
    if (!authLoading && user) {
      const destination = location.state?.from?.pathname || "/dashboard";
      navigate(destination, { replace: true });
    }
  }, [authLoading, user, location.state, navigate]);

  async function handleLogin(event) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      // Remember Me menyimpan sesi lintas browser restart.
      // Jika tidak dicentang, sesi berakhir saat sesi browser ditutup.
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );

      await signInWithEmailAndPassword(auth, email.trim(), password);

      const destination = location.state?.from?.pathname || "/dashboard";
      navigate(destination, { replace: true });
    } catch (error) {
      setErrorMessage(getLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 sm:px-6">
      <section className="w-full max-w-md">
        <div className="mb-7 text-center">
          <Link
            to="/login"
            className="inline-flex text-3xl font-extrabold tracking-tight text-slate-900"
            aria-label="StudyFlow"
          >
            Study<span className="text-blue-600">Flow</span>
          </Link>
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Selamat datang kembali
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Masuk ke StudyFlow
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Lanjutkan mengatur tugas dan jadwal belajarmu.
          </p>
        </div>

        <form
          onSubmit={handleLogin}
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

          <div className="space-y-5">
            <div>
              <label
                htmlFor="login-email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  aria-pressed={showPassword}
                  title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  className="absolute inset-y-0 right-0 flex items-center justify-center rounded-r-xl px-3 text-slate-500 transition-colors hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.7 4.2 10 7-.5 1.1-1.3 2.3-2.4 3.3" />
                      <path d="M6.2 6.2C3.9 7.6 2.5 9.7 2 12c1.3 2.8 4.8 7 10 7 1 0 2-.2 2.9-.5" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center">
            <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                name="rememberMe"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600 focus:ring-2 focus:ring-blue-200"
              />
              <span>Remember Me</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Memproses..." : "Login"}
          </button>

          <p className="mt-6 text-center text-sm text-slate-600">
            Belum punya akun?{" "}
            <Link
              to="/register"
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Daftar sekarang
            </Link>
          </p>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          StudyFlow membantu mengatur tugas dan waktu belajar dalam satu tempat.
        </p>
      </section>
    </main>
  );
}
