"use client";

import dynamic from "next/dynamic";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { configureAmplify } from "@/lib/amplify";
import { getAuthState } from "@/lib/auth";
import {
  getAdminReports,
  AdminReport,
} from "@/lib/api";

const IncidentLocationMap = dynamic(
  () => import("@/components/IncidentLocationMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-100">
        <p className="text-sm font-medium text-slate-500">
          Loading map...
        </p>
      </div>
    ),
  }
);

function formatDate(value?: string) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getCoordinates(report: AdminReport) {
  const latitude = Number(report.latitude);
  const longitude = Number(report.longitude);
  const accuracy = Number(report.locationAccuracy);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy)
      ? accuracy
      : undefined,
  };
}

function AdminLocationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedReportId =
    searchParams.get("reportId");

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [selectedReportId, setSelectedReportId] =
    useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        configureAmplify();

        const authState = await getAuthState();

        if (!authState.signedIn) {
          router.replace("/login");
          return;
        }

        if (authState.role !== "admin") {
          router.replace("/report");
          return;
        }

        const result = await getAdminReports();

        const withLocation = (
          result.reports || []
        ).filter(
          (report) => getCoordinates(report) !== null
        );

        setReports(withLocation);

        if (requestedReportId) {
          const requestedReport =
            withLocation.find(
              (report) =>
                report.reportId === requestedReportId
            );

          if (!requestedReport) {
            setSelectedReportId("");

            setError(
              `The requested report (${requestedReportId}) was not found or does not have a valid GPS location.`
            );

            return;
          }

          setSelectedReportId(
            requestedReport.reportId
          );
        } else {
          setSelectedReportId(
            withLocation[0]?.reportId || ""
          );
        }
      } catch (err: any) {
        console.error(
          "Unable to load report locations:",
          err
        );

        setError(
          err?.message ||
            "Unable to load report locations."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [router, requestedReportId]);

  const selectedReport = useMemo(() => {
    return (
      reports.find(
        (report) =>
          report.reportId === selectedReportId
      ) || null
    );
  }, [reports, selectedReportId]);

  const selectedCoordinates = selectedReport
    ? getCoordinates(selectedReport)
    : null;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-red-500" />

          <p className="text-sm font-medium text-slate-300">
            Loading report locations...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Incident Locations
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                View the GPS locations associated with
                submitted incident reports.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="text-sm font-medium text-red-700">
              {error}
            </p>
          </div>
        )}

        {reports.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <svg
                className="h-7 w-7 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 21a2 2 0 01-2.828 0l-4.243-4.343a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>

            <h2 className="text-lg font-bold text-slate-900">
              No report locations available
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              No submitted reports currently contain
              valid GPS coordinates.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            {/* Report List */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-slate-900">
                      Reports
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      {reports.length} report
                      {reports.length === 1
                        ? ""
                        : "s"} with GPS
                    </p>
                  </div>

                  <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                    GPS
                  </div>
                </div>
              </div>

              <div className="max-h-[620px] overflow-y-auto">
                {reports.map((report) => {
                  const coordinates =
                    getCoordinates(report);

                  if (!coordinates) {
                    return null;
                  }

                  const isSelected =
                    report.reportId ===
                    selectedReportId;

                  return (
                    <button
                      key={report.reportId}
                      type="button"
                      onClick={() =>
                        setSelectedReportId(
                          report.reportId
                        )
                      }
                      className={`w-full border-b border-slate-100 px-5 py-4 text-left transition ${
                        isSelected
                          ? "bg-red-50"
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className={`truncate text-sm font-bold ${
                              isSelected
                                ? "text-red-700"
                                : "text-slate-900"
                            }`}
                          >
                            {report.reportId}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(
                              report.createdAt
                            )}
                          </p>
                        </div>

                        {isSelected && (
                          <span className="shrink-0 rounded-full bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                            Selected
                          </span>
                        )}
                      </div>

                      <div className="mt-3 rounded-xl bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Coordinates
                        </p>

                        <p className="mt-1 font-mono text-xs text-slate-700">
                          {coordinates.latitude.toFixed(
                            6
                          )}
                          ,{" "}
                          {coordinates.longitude.toFixed(
                            6
                          )}
                        </p>

                        {coordinates.accuracy !==
                          undefined && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Accuracy: approximately{" "}
                            {Math.round(
                              coordinates.accuracy
                            )}{" "}
                            m
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Map Section */}
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {selectedReport &&
              selectedCoordinates ? (
                <>
                  <div className="mb-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                          Selected incident
                        </p>

                        <h2 className="mt-1 text-xl font-bold text-slate-900">
                          {selectedReport.reportId}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          Submitted{" "}
                          {formatDate(
                            selectedReport.createdAt
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-100 px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          GPS Coordinates
                        </p>

                        <p className="mt-1 font-mono text-xs text-slate-700">
                          {selectedCoordinates.latitude.toFixed(
                            6
                          )}
                          ,{" "}
                          {selectedCoordinates.longitude.toFixed(
                            6
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <IncidentLocationMap
                    latitude={
                      selectedCoordinates.latitude
                    }
                    longitude={
                      selectedCoordinates.longitude
                    }
                    accuracy={
                      selectedCoordinates.accuracy
                    }
                  />

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Latitude
                      </p>

                      <p className="mt-1 font-mono text-sm font-semibold text-slate-800">
                        {selectedCoordinates.latitude.toFixed(
                          6
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Longitude
                      </p>

                      <p className="mt-1 font-mono text-sm font-semibold text-slate-800">
                        {selectedCoordinates.longitude.toFixed(
                          6
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        GPS Accuracy
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {selectedCoordinates.accuracy !==
                        undefined
                          ? `±${Math.round(
                              selectedCoordinates.accuracy
                            )} m`
                          : "Not available"}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-[500px] items-center justify-center rounded-2xl bg-slate-100">
                  <p className="text-sm font-medium text-slate-500">
                    Select a report to view its
                    location.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

export default function AdminLocationsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-red-500" />

            <p className="text-sm font-medium text-slate-300">
              Loading report locations...
            </p>
          </div>
        </main>
      }
    >
      <AdminLocationsContent />
    </Suspense>
  );
}