import Link from "next/link";
import { getTranslations } from "next-intl/server";

const emergencyServices = [
  {
    key: "police",
    number: "117",
  },
  {
    key: "gendarmerie",
    number: "113",
  },
  {
    key: "fire",
    number: "118",
  },
  {
    key: "medical",
    number: "119",
  },
] as const;

export default async function HomePage() {
  const t = await getTranslations("home");
  const common = await getTranslations("common");
  const emergency = await getTranslations("emergency");

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="SOS-Kamer home"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white shadow-sm">
              S
            </span>

            <div>
              <p className="text-base font-bold tracking-tight">
                SOS<span className="text-red-600">-Kamer</span>
              </p>

              <p className="text-[10px] font-medium text-slate-400">
                {common("tagline")}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {common("signIn")}
            </Link>

            <Link
              href="/signup"
              className="hidden rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 sm:inline-flex"
            >
              {common("createAccount")}
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
              {t("emergencySupport")}
            </p>

            <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              {t("heroTitle")}
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-500 sm:text-lg">
              {t("heroDescription")}
            </p>

            <div className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4 sm:p-5">
              <p className="text-sm font-bold text-red-700">
                {t("immediateDangerTitle")}
              </p>

              <p className="mt-1 text-sm leading-6 text-red-700/80">
                {t("immediateDangerDescription")}
              </p>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/report"
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
              >
                {common("reportIncident")}
              </Link>

              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                {common("viewMyReports")}
              </Link>
            </div>
          </div>

          {/* EMERGENCY SERVICES */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-5">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-950">
                {t("emergencyServices")}
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                {t("emergencyServicesDescription")}
              </p>
            </div>

            <div className="space-y-3">
              {emergencyServices.map((service) => (
                <a
                  key={service.number}
                  href={`tel:${service.number}`}
                  className="group block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-red-200 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-950">
                        {emergency(`${service.key}`)}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {emergency(`${service.key}Description`)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xl font-bold tracking-wide text-slate-950">
                        {service.number}
                      </p>

                      <span className="mt-1 inline-flex rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition group-hover:bg-red-700">
                        {common("call")}
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>

            <p className="mt-4 text-center text-[11px] leading-5 text-slate-400">
              {t("phoneConfirmation")}
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 lg:py-16">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
              {t("howItWorks")}
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {t("howItWorksTitle")}
            </h2>

            <p className="mt-4 text-base leading-7 text-slate-500">
              {t("howItWorksDescription")}
            </p>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {[
              ["01", t("reportStep"), t("reportStepDescription")],
              ["02", t("evidenceStep"), t("evidenceStepDescription")],
              ["03", t("trackStep"), t("trackStepDescription")],
            ].map(([number, title, text]) => (
              <div
                key={number}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <span className="text-xs font-bold text-red-600">
                  {number}
                </span>

                <h3 className="mt-3 text-lg font-bold text-slate-950">
                  {title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-7 text-sm text-slate-400 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} SOS-Kamer.
          </p>

          <div className="flex gap-4">
            <Link
              href="/login"
              className="transition hover:text-slate-700"
            >
              {common("signIn")}
            </Link>

            <Link
              href="/signup"
              className="transition hover:text-slate-700"
            >
              {common("createAccount")}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
