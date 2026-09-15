"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { configureAmplify } from "../../../lib/amplify";
import { getAuthState } from "../../../lib/auth";
import {
  CitizenReport,
  getMyReport,
} from "../../../lib/api";
import SignOutButton from "../../../components/SignOutButton";

const STATUS_STEPS = [
  {
    status: "NEW",
    title: "Report received",
    description: "Your report has been submitted to SOS-Kamer.",
  },
  {
    status: "ACKNOWLEDGED",
    title: "Under review",
    description: "An authorized responder has acknowledged the report.",
  },
  {
    status: "RESOLVED",
    title: "Resolved",
    description: "The response team has marked the incident as resolved.",
  },
];

function formatIncidentType(type: string) {
  return type
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function statusIndex(status: string) {
  const index = STATUS_STEPS.findIndex(
    (step) => step.status === status
  );

  return index >= 0 ? index : 0;
}

function Timeline({
  report,
}: {
  report: CitizenReport;
}) {
  const history = report.statusHistory || [];

  return (
    <div className="space-y-0">
      {history.length === 0 ? (
        <p className="text-sm text-slate-500">
          No activity has been recorded yet.
        </p>
      ) : (
        history.map((event, index) => (
          <div
            key={`${event.status}-${event.timestamp}-${index}`}
            className="relative flex gap-4 pb-7 last:pb-0"
          >
            {index < history.length - 1 && (
              <span className="absolute left-[11px] top-6 h-full w-px bg-slate-200" />
            )}

            <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[10px] font-black text-white">
              ✓
            </div>

            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">
                {event.status === "NEW"
                  ? "Report submitted"
                  : event.status === "ACKNOWLEDGED"
                    ? "Report acknowledged"
                    : event.status === "RESOLVED"
                      ? "Incident resolved"
                      : event.status.replaceAll("_", " ")}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {event.actor} · {formatDate(event.timestamp)}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function StatusTracker({
  status,
}: {
  status: string;
}) {
  const currentIndex = statusIndex(status);

  return (
    <div>
      <div className="hidden items-start md:flex">
        {STATUS_STEPS.map((step, index) => {
          const completed = index <= currentIndex;
          const current = index === currentIndex;

          return (
            <div
              key={step.status}
              className="flex flex-1 items-start"
            >
              <div className="flex flex-col items-center text-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-black ${
                    completed
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-300"
                  } ${current ? "ring-4 ring-slate-100" : ""}`}
                >
                  {completed ? "✓" : index + 1}
                </div>

                <p
                  className={`mt-3 text-xs font-bold ${
                    completed
                      ? "text-slate-900"
                      : "text-slate-400"
                  }`}
                >
                  {step.title}
                </p>
              </div>

              {index < STATUS_STEPS.length - 1 && (
                <div
                  className={`mt-5 h-0.5 flex-1 ${
                    index < currentIndex
                      ? "bg-slate-950"
                      : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-4 md:hidden">
        {STATUS_STEPS.map((step, index) => {
          const completed = index <= currentIndex;

          return (
            <div key={step.status} className="flex gap-3">
              <div className="relative">
                {index < STATUS_STEPS.length - 1 && (
                  <span className="absolute left-3 top-7 h-12 w-px bg-slate-200" />
                )}

                <div
                  className={`relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${
                    completed
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-300"
                  }`}
                >
                  {completed ? "✓" : index + 1}
                </div>
              </div>

              <div>
                <p
                  className={`text-sm font-bold ${
                    completed
                      ? "text-slate-900"
                      : "text-slate-400"
                  }`}
                >
                  {step.title}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReportDetailsPage() {
  const router = useRouter();
  const params = useParams<{ reportId: string }>();

  const reportId = params?.reportId
    ? decodeURIComponent(params.reportId)
    : "";

  const [report, setReport] = useState<CitizenReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!reportId) return;

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

        const result = await getMyReport(reportId);
        setReport(result.report);
      } catch (err: any) {
        console.error(err);

        setError(
          err?.message ||
            "This report could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [reportId, router]);

  const currentStatusLabel = useMemo(() => {
    if (!report) return "";

    switch (report.status) {
      case "NEW":
        return "Report received";
      case "ACKNOWLEDGED":
        return "Under review";
      case "RESOLVED":
        return "Resolved";
      default:
        return report.status.replaceAll("_", " ");
    }
  }, [report]);

  const isVoiceReport =
    report?.descriptionType === "VOICE";

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/reports" className="flex items-center gap-3">
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
              href="/reports"
              className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              ← Home
            </Link>

            <SignOutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
        {loading && (
          <div className="space-y-4">
            <div className="h-32 animate-pulse rounded-2xl bg-white" />
            <div className="h-72 animate-pulse rounded-2xl bg-white" />
            <div className="h-56 animate-pulse rounded-2xl bg-white" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-bold text-red-800">
              Report unavailable
            </p>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {error}
            </p>

            <Link
              href="/reports"
              className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white"
            >
              Back to my reports
            </Link>
          </div>
        )}

        {!loading && !error && report && (
          <>
            <div className="mb-6">
              <Link
                href="/reports"
                className="text-xs font-bold text-slate-500 hover:text-slate-900"
              >
                ← Back to my reports
              </Link>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">
                    Incident tracking
                  </p>

                  <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                    {formatIncidentType(report.incidentType)}
                  </h1>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Current status
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {currentStatusLabel}
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Submitted
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {formatDate(report.createdAt)}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Location
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {report.quarter}, {report.town}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Evidence
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {report.evidenceCount} file
                    {report.evidenceCount === 1 ? "" : "s"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Last update
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {formatDate(
                      report.updatedAt ||
                        report.createdAt
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Progress
                </p>

                <h2 className="mt-1 text-lg font-bold">
                  Follow your report
                </h2>
              </div>

              <div className="mt-8">
                <StatusTracker status={report.status} />
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Activity
                </p>

                <h2 className="mt-1 text-lg font-bold">
                  Report timeline
                </h2>

                <div className="mt-7">
                  <Timeline report={report} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Your report
                </p>

                <h2 className="mt-1 text-lg font-bold">
                  Incident details
                </h2>

                {isVoiceReport ? (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 18.5a4.5 4.5 0 0 0 4.5-4.5V8a4.5 4.5 0 0 0-9 0v6a4.5 4.5 0 0 0 4.5 4.5Z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 13.5a7 7 0 0 1-14 0M12 20v3M8 23h8"
                          />
                        </svg>
                      </div>

                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          Voice description
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Your recorded incident description
                        </p>
                      </div>
                    </div>

                    {report.audioUrl ? (
                      <audio
                        className="mt-5 w-full"
                        controls
                        preload="metadata"
                        src={report.audioUrl}
                      >
                        Your browser does not support audio playback.
                      </audio>
                    ) : (
                      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs leading-5 text-amber-700">
                          The voice recording is currently unavailable.
                          Please try refreshing the report later.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                    {report.description}
                  </p>
                )}

                {report.resolvedAt && (
                  <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-bold text-emerald-800">
                      Incident resolved
                    </p>

                    <p className="mt-1 text-xs leading-5 text-emerald-700">
                      This report was marked resolved on{" "}
                      {formatDate(report.resolvedAt)}.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-900">
                Need to report another incident?
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Submit a new report and it will appear in My Reports.
              </p>

              <Link
                href="/report"
                className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-red-600 px-5 text-xs font-bold text-white transition hover:bg-red-500"
              >
                Report an incident
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}