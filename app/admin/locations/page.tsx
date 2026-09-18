"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { configureAmplify } from "@/lib/amplify";
import { getAuthState } from "@/lib/auth";
import { getAdminReports, AdminReport } from "@/lib/api";

const IncidentLocationMap = dynamic(() => import("@/components/IncidentLocationMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-100">
      <p className="text-sm font-medium text-slate-500">Loading map...</p>
    </div>
  ),
});

function formatDate(value?: string) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function getCoordinates(report: AdminReport) {
  const latitude = Number(report.latitude);
  const longitude = Number(report.longitude);
  const accuracy = Number(report.locationAccuracy);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude, accuracy: Number.isFinite(accuracy) ? accuracy : undefined };
}

export default function AdminLocationsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        configureAmplify();
        const authState = await getAuthState();
        if (!authState.signedIn) { router.replace("/login"); return; }
        if (authState.role !== "admin") { router.replace("/report"); return; }
        const result = await getAdminReports();
        const withLocation = (result.reports || []).filter((report) => getCoordinates(report) !== null);
        setReports(withLocation);
        setSelectedReportId(withLocation[0]?.reportId || "");
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Unable to load report locations.");
      } finally { setLoading(false); }
    }
    void load();
  }, [router]);

  const selectedReport = useMemo(() => reports.find((report) => report.reportId === selectedReportId) || null, [reports, selectedReportId]);
  const selectedCoordinates = selectedReport ? getCoordinates(selectedReport) : null;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-red-500" />
          <p className="text-sm font-medium text-slate-300">Loading report locations...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-base font-bold text-slate-950">SOS-Kamer</p>
            <p className="text-xs text-slate-500">Report Locations</p>
          </div>
          <button type="button" onClick={() => router.push("/admin")} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">← Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">GPS reports</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Incident locations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Review the device-reported location attached to each incident. The accuracy circle shows the reported GPS uncertainty.</p>
        </section>

        {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {reports.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <p className="text-sm font-bold text-slate-800">No reports with GPS location found</p>
            <p className="mt-1 text-xs text-slate-500">New reports will appear here after location capture is enabled.</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-4">
                <p className="text-xs font-bold text-slate-950">Reports with location</p>
                <p className="mt-1 text-[11px] text-slate-500">{reports.length} report{reports.length === 1 ? "" : "s"}</p>
              </div>
              <div className="max-h-[620px] divide-y divide-slate-100 overflow-y-auto">
                {reports.map((report) => {
                  const coords = getCoordinates(report);
                  const selected = report.reportId === selectedReportId;
                  return (
                    <button key={report.reportId} type="button" onClick={() => setSelectedReportId(report.reportId)} className={`w-full p-4 text-left transition ${selected ? "bg-red-50" : "bg-white hover:bg-slate-50"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-800">{report.reportId}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-700">{report.town}</p>
                          <p className="text-[11px] text-slate-500">{report.quarter}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-red-600 shadow-sm">📍</span>
                      </div>
                      {coords && <p className="mt-3 font-mono text-[10px] text-slate-400">{coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}</p>}
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {selectedReport && selectedCoordinates ? (
                <>
                  <div className="border-b border-slate-200 p-5 sm:p-6">
                    <p className="text-xs font-bold uppercase tracking-wide text-red-600">Selected report</p>
                    <h2 className="mt-1 break-all font-mono text-sm font-bold text-slate-950">{selectedReport.reportId}</h2>
                    <p className="mt-1 text-xs text-slate-500">{selectedReport.town} · {selectedReport.quarter}</p>
                  </div>
                  <div className="p-5 sm:p-6">
                    <IncidentLocationMap latitude={selectedCoordinates.latitude} longitude={selectedCoordinates.longitude} accuracy={selectedCoordinates.accuracy} />
                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Latitude</p><p className="mt-1 font-mono text-sm font-semibold text-slate-800">{selectedCoordinates.latitude.toFixed(8)}</p></div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Longitude</p><p className="mt-1 font-mono text-sm font-semibold text-slate-800">{selectedCoordinates.longitude.toFixed(8)}</p></div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Accuracy</p><p className="mt-1 text-sm font-semibold text-slate-800">{typeof selectedCoordinates.accuracy === "number" ? `± ${Math.round(selectedCoordinates.accuracy)} m` : "Unavailable"}</p></div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Captured</p><p className="mt-1 text-sm font-semibold text-slate-800">{formatDate(selectedReport.locationCapturedAt)}</p></div>
                    </div>
                  </div>
                </>
              ) : <div className="flex min-h-[500px] items-center justify-center p-8 text-center"><p className="text-sm text-slate-500">Select a report to view its location.</p></div>}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
