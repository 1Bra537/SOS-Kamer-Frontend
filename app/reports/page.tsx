"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { configureAmplify } from "../../lib/amplify";
import { getAuthState } from "../../lib/auth";
import {
  CitizenReport,
  getMyReports,
} from "../../lib/api";
import SignOutButton from "../../components/SignOutButton";


function formatIncidentType(type: string) {
  return type
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}


function formatStatus(status: string) {
  switch (status) {
    case "NEW":
      return "Report received";
    case "ACKNOWLEDGED":
      return "Under review";
    case "RESOLVED":
      return "Resolved";
    default:
      return status
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}


function formatDate(dateString?: string) {
  if (!dateString) return "Unknown";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}


function StatusBadge({ status }: { status: string }) {
  const resolved = status === "RESOLVED";
  const acknowledged = status === "ACKNOWLEDGED";

  const classes = resolved
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : acknowledged
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-red-200 bg-red-50 text-red-700";

  const dot = resolved
    ? "bg-emerald-500"
    : acknowledged
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {formatStatus(status)}
    </span>
  );
}


function ReportCard({ report }: { report: CitizenReport }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
              {formatIncidentType(report.incidentType)}
            </span>

            {report.incidentType === "CHILD_ABUSE" && (
              <span className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                Critical
              </span>
            )}
          </div>

          <h2 className="mt-3 font-mono text-sm font-bold text-slate-900">
            {report.reportId}
          </h2>

          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
            {report.description}
          </p>
        </div>

        <div className="shrink-0">
          <StatusBadge status={report.status} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 text-xs text-slate-500 sm:grid-cols-3">
        <div>
          <p className="font-bold uppercase tracking-wider text-slate-400">
            Location
          </p>
          <p className="mt-1 font-semibold text-slate-700">
            {report.quarter}, {report.town}
          </p>
        </div>

        <div>
          <p className="font-bold uppercase tracking-wider text-slate-400">
            Submitted
          </p>
          <p className="mt-1 font-semibold text-slate-700">
            {formatDate(report.createdAt)}
          </p>
        </div>

        <div>
          <p className="font-bold uppercase tracking-wider text-slate-400">
            Evidence
          </p>
          <p className="mt-1 font-semibold text-slate-700">
            {report.evidenceCount} file
            {report.evidenceCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <Link
        href={`/reports/${encodeURIComponent(report.reportId)}`}
        className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-5 text-xs font-bold text-white transition hover:bg-slate-800 sm:w-auto"
      >
        Track this report →
      </Link>
    </article>
  );
}


export default function MyReportsPage() {
  const router = useRouter();

  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "RESOLVED">("ALL");

  useEffect(() => {
    async function load() {
      try {
        configureAmplify();

        const authState = await getAuthState();

        if (!authState.signedIn) {
          router.replace("/login");
          return;
        }

        if (authState.role === "admin") {
          router.replace("/admin");
          return;
        }

        if (authState.role !== "citizen") {
          router.replace("/login");
          return;
        }

        const result = await getMyReports();
        setReports(result.reports || []);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            "Unable to load your reports. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  const filteredReports = useMemo(() => {
    if (filter === "ACTIVE") {
      return reports.filter((report) => report.status !== "RESOLVED");
    }

    if (filter === "RESOLVED") {
      return reports.filter((report) => report.status === "RESOLVED");
    }

    return reports;
  }, [filter, reports]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/report" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 font-black text-white">
              S
            </span>

            <div>
              <p className="text-sm font-bold tracking-tight text-slate-950">
                SOS<span className="text-red-600">-Kamer</span>
              </p>
              <p className="hidden text-[10px] font-medium text-slate-400 sm:block">
                Citizen Reporting
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/report"
              className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Report incident
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">
            Citizen dashboard
          </p>

          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                My reports
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Follow every incident you have submitted and see when
                the response team takes action.
              </p>
            </div>

            {!loading && (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
                <span className="font-bold text-slate-900">
                  {reports.length}
                </span>{" "}
                report{reports.length === 1 ? "" : "s"}
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {[
            ["ALL", "All reports"],
            ["ACTIVE", "Active"],
            ["RESOLVED", "Resolved"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                setFilter(value as "ALL" | "ACTIVE" | "RESOLVED")
              }
              className={`rounded-xl border px-4 py-2.5 text-xs font-bold transition ${
                filter === value
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="grid gap-4">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-bold text-red-800">
              Could not load your reports
            </p>
            <p className="mt-2 text-sm leading-6 text-red-700">
              {error}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && filteredReports.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
              📋
            </div>

            <h2 className="mt-5 text-lg font-bold text-slate-900">
              {reports.length === 0
                ? "You have not submitted any reports yet"
                : "No reports match this filter"}
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {reports.length === 0
                ? "Once you submit an incident, it will appear here so you can track its progress."
                : "Try another filter to see your other reports."}
            </p>

            {reports.length === 0 && (
              <Link
                href="/report"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-red-600 px-5 text-xs font-bold text-white"
              >
                Report an incident
              </Link>
            )}
          </div>
        )}

        {!loading && !error && filteredReports.length > 0 && (
          <div className="grid gap-4">
            {filteredReports.map((report) => (
              <ReportCard
                key={report.reportId}
                report={report}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
