"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { configureAmplify } from "../../lib/amplify";
import {
  signUp,
  confirmSignUp,
  signInWithRedirect,
} from "aws-amplify/auth";
  import "aws-amplify/auth/enable-oauth-listener";
  import { getCurrentUser, signOut } from "aws-amplify/auth";

export default function SignupPage() {
  const router = useRouter();


  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const [confirming, setConfirming] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [googleLoading, setGoogleLoading] = useState(false);

async function handleGoogleSignUp() {
  setError("");
  setGoogleLoading(true);

  try {
    configureAmplify();

    await signInWithRedirect({
      provider: "Google",
      options: {
        prompt: "SELECT_ACCOUNT",
      },
    });
  } catch (err: any) {
    console.error("Google sign-up failed:", err);

    setError(
      err?.message || "Could not continue with Google."
    );

    setGoogleLoading(false);
  }
}

  async function submit(e: FormEvent) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      configureAmplify();

      if (!confirming) {
        const result = await signUp({
          username: email,
          password,
          options: {
            userAttributes: {
              email,
            },
          },
        });

        if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
          setConfirming(true);
        } else {
          router.push("/login");
        }
      } else {
        await confirmSignUp({
          username: email,
          confirmationCode: code,
        });

        router.push("/login");
      }
    } catch (err: any) {
      setError(
        err?.message || "Could not create account."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-10 text-slate-950 sm:px-6">

      <div className="w-full max-w-md">

        {/* BRAND */}

        <div className="mb-7 flex justify-center">
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white shadow-sm">
              S
            </span>

            <div>
              <p className="text-base font-bold tracking-tight">
                SOS<span className="text-red-600">-Kamer</span>
              </p>

              <p className="text-[10px] font-medium text-slate-400">
                Faster Emergency Connections
              </p>
            </div>
          </Link>
        </div>

        {/* CARD */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {!confirming ? (
            <>

              {/* CREATE ACCOUNT */}

              <div className="px-6 pb-6 pt-7 sm:px-8 sm:pt-8">

                <div className="mb-7">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-red-600">
                    Citizen registration
                  </p>

                  <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[27px]">
                    Create your account
                  </h1>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Set up your account to start reporting
                    incidents securely.
                  </p>
                </div>

                {/* ERROR */}

                {error && (
                  <div className="mb-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[11px] font-black text-red-700">
                      !
                    </span>

                    <p className="text-xs leading-5 text-red-700">
                      {error}
                    </p>
                  </div>
                )}


                {/* GOOGLE */}

<button
  type="button"
  onClick={handleGoogleSignUp}
  disabled={googleLoading || loading}
  className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
>
  {googleLoading ? (
    <>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
      Connecting to Google...
    </>
  ) : (
    <>
      <span className="flex h-5 w-5 items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path
            fill="#4285F4"
            d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.22a4.46 4.46 0 0 1-1.94 2.93v2.43h3.14c1.84-1.69 2.93-4.18 2.93-7.39Z"
          />
          <path
            fill="#34A853"
            d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.43c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.29v2.51A9.74 9.74 0 0 0 12 21.5Z"
          />
          <path
            fill="#FBBC05"
            d="M6.54 13.6A5.85 5.85 0 0 1 6.24 12c0-.56.1-1.1.3-1.6V7.89H3.29A9.74 9.74 0 0 0 2.25 12c0 1.57.38 3.06 1.04 4.11l3.25-2.51Z"
          />
          <path
            fill="#EA4335"
            d="M12 6.37c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.47 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.71 5.39l3.25 2.51C7.31 8.09 9.46 6.37 12 6.37Z"
          />
        </svg>
      </span>

      Continue with Google
    </>
  )}
</button>

<div className="relative my-5">
  <div className="absolute inset-0 flex items-center">
    <div className="w-full border-t border-slate-100" />
  </div>

  <div className="relative flex justify-center">
    <span className="bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
      Or create with email
    </span>
  </div>
</div>



                <form
                  onSubmit={submit}
                  className="space-y-5"
                >

                  {/* EMAIL */}

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-xs font-bold text-slate-600"
                    >
                      Email address
                    </label>

                    <input
                      id="email"
                      required
                      autoComplete="email"
                      type="email"
                      value={email}
                      onChange={(e) =>
                        setEmail(e.target.value)
                      }
                      placeholder=""
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-500 focus:bg-white focus:ring-4 focus:ring-slate-100"
                    />
                  </div>

                  {/* PASSWORD */}

                  <div>
                    <label
                      htmlFor="password"
                      className="mb-2 block text-xs font-bold text-slate-600"
                    >
                      Create password
                    </label>

                    <div className="relative">
                      <input
                        id="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        value={password}
                        onChange={(e) =>
                          setPassword(e.target.value)
                        }
                        placeholder=""
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-16 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-500 focus:bg-white focus:ring-4 focus:ring-slate-100"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (current) => !current
                          )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        {showPassword
                          ? "Hide"
                          : "Show"}
                      </button>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          password.length >= 8
                            ? "bg-emerald-500"
                            : "bg-slate-300"
                        }`}
                      />

                      <p
                        className={`text-[10px] ${
                          password.length >= 8
                            ? "text-emerald-600"
                            : "text-slate-400"
                        }`}
                      >
                        {password.length >= 8
                          ? "Password length requirement met"
                          : "Use at least 8 characters"}
                      </p>
                    </div>
                  </div>




                  {/* SUBMIT */}

                  <button
                    type="submit"
                    disabled={loading}
                    className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white shadow-sm shadow-red-900/10 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-white" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        Create account
                        <span className="transition-transform group-hover:translate-x-0.5">
                          →
                        </span>
                      </>
                    )}
                  </button>

                </form>

              </div>

              {/* FOOTER */}

              <div className="border-t border-slate-100 bg-slate-50 px-6 py-5 text-center sm:px-8">
                <p className="text-xs text-slate-500">
                  Already registered?{" "}
                  <Link
                    href="/login"
                    className="font-bold text-red-600 transition hover:text-red-700"
                  >
                    Sign in
                  </Link>
                </p>
              </div>

            </>
          ) : (
            <>

              {/* VERIFICATION */}

              <div className="px-6 pb-6 pt-7 sm:px-8 sm:pt-8">

                <div className="mb-7">

                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                    <span className="text-lg font-black text-emerald-600">
                      ✓
                    </span>
                  </div>

                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600">
                    Step 2 of 2 · Verification
                  </p>

                  <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[27px]">
                    Check your email
                  </h1>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    We sent a verification code to{" "}
                    <span className="font-semibold text-slate-800">
                      {email}
                    </span>
                    .
                  </p>

                </div>

                {/* ERROR */}

                {error && (
                  <div className="mb-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[11px] font-black text-red-700">
                      !
                    </span>

                    <p className="text-xs leading-5 text-red-700">
                      {error}
                    </p>
                  </div>
                )}

                <form
                  onSubmit={submit}
                  className="space-y-5"
                >

                  <div>
                    <label
                      htmlFor="code"
                      className="mb-2 block text-xs font-bold text-slate-600"
                    >
                      Verification code
                    </label>

                    <input
                      id="code"
                      required
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value)
                      }
                      placeholder="Enter your code"
                      className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-center text-lg font-bold tracking-[0.3em] text-slate-900 outline-none transition placeholder:text-slate-400 placeholder:tracking-normal hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                    />

                    <p className="mt-3 text-[10px] leading-5 text-slate-400">
                      Enter the code exactly as it appears in
                      your verification email.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-white" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify email
                        <span className="transition-transform group-hover:translate-x-0.5">
                          →
                        </span>
                      </>
                    )}
                  </button>

                </form>

                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    setCode("");
                    setError("");
                  }}
                  className="mt-5 w-full text-center text-xs font-semibold text-slate-400 transition hover:text-slate-700"
                >
                  ← Use a different email
                </button>

              </div>

            </>
          )}

        </div>

        {/* BOTTOM */}

        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

          <p className="text-[10px] font-medium text-slate-400">
            Building safer communities through faster, smarter, and more connected emergency response.
          </p>
        </div>

        {/* <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-[10px] font-semibold text-slate-400 transition hover:text-slate-700"
          >
            ← Return home
          </Link>
        </div> */}

      </div>
    </main>
  );
}