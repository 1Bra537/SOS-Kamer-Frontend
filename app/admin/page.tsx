"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { configureAmplify } from "@/lib/amplify";
import { getAuthState } from "@/lib/auth";
import SignOutButton from "../../components/SignOutButton";

import {
  getAdminReports,
  getAdminNotifications,
  acknowledgeNotification,
  resolveReport,
  getEvidenceUrl,
} from "@/lib/api";

type MediaType = "image" | "video";

type EvidenceItem = {
  key: string;
  evidenceUrl: string;
  mediaType: MediaType;
  contentType?: string;
};

type Report = {
  reportId: string;
  citizenId: string;
  incidentType: string;
  description: string;
  photoKey: string;

  evidence?: {
    key: string;
    contentType?: string;
    mediaType?: MediaType;
  }[];

  mediaType?: MediaType;
  contentType?: string;

  town: string;
  quarter: string;
  status: string;
  createdAt: string;
  resolvedAt?: string;
};

type Notification = {
  notificationId: string;
  reportId: string;
  citizenId: string;
  incidentType: string;
  description: string;
  photoKey: string;
  town: string;
  quarter: string;
  status: string;
  createdAt: string;
  acknowledgedAt?: string;
};

type SortOption =
  | "newest"
  | "oldest"
  | "type"
  | "status";

const INCIDENT_TYPES = [
  "ALL",
  "CHILD_ABUSE",
  "FIGHT",
  "THEFT",
  "OTHER",
];

const STATUS_OPTIONS = [
  "ALL",
  "NEW",
  "RESOLVED",
];

function formatIncidentType(type: string) {
  switch (type) {
    case "CHILD_ABUSE":
      return "Child Abuse";

    case "FIGHT":
      return "Fight";

    case "THEFT":
      return "Theft";

    case "OTHER":
      return "Other";

    default:
      return type
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) =>
          char.toUpperCase()
        );
  }
}

function formatStatus(status: string) {
  switch (status) {
    case "NEW":
      return "Active";

    case "RESOLVED":
      return "Resolved";

    case "UNACKNOWLEDGED":
      return "Needs attention";

    case "ACKNOWLEDGED":
      return "Acknowledged";

    default:
      return status;
  }
}

function formatDate(dateString: string) {
  if (!dateString) {
    return "Unknown";
  }

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

function formatRelativeTime(dateString: string) {
  if (!dateString) {
    return "";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const difference =
    Date.now() - date.getTime();

  const seconds = Math.floor(
    difference / 1000
  );

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(
    seconds / 60
  );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(
    hours / 24
  );

  if (days < 7) {
    return `${days}d ago`;
  }

  return formatDate(dateString);
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  if (status === "RESOLVED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Resolved
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Active
    </span>
  );
}

function IncidentBadge({
  type,
}: {
  type: string;
}) {
  const isCritical =
    type === "CHILD_ABUSE";

  return (
    <span
      className={
        isCritical
          ? "inline-flex rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700"
          : "inline-flex rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700"
      }
    >
      {formatIncidentType(type)}
    </span>
  );
}

export default function AdminPage() {
  const router = useRouter();

  const [reports, setReports] = useState<Report[]>(
    []
  );

  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");

  const [processingId, setProcessingId] =
    useState("");

  // -------------------------------------------------
  // Filters
  // -------------------------------------------------

  const [searchQuery, setSearchQuery] =
    useState("");

  const [typeFilter, setTypeFilter] =
    useState("ALL");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [sortOption, setSortOption] =
    useState<SortOption>("newest");

  // -------------------------------------------------
  // Evidence gallery
  // -------------------------------------------------

  const [evidenceItems, setEvidenceItems] =
    useState<EvidenceItem[]>([]);

  const [evidenceIndex, setEvidenceIndex] =
    useState(0);

  const [evidenceLoading, setEvidenceLoading] =
    useState(false);

  const [evidenceError, setEvidenceError] =
    useState("");

  const [
    selectedEvidenceReportId,
    setSelectedEvidenceReportId,
  ] = useState("");

  // -------------------------------------------------
  // Load dashboard
  // -------------------------------------------------

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    try {
      setLoading(true);
      setError("");

      configureAmplify();

      const authState =
        await getAuthState();

      if (!authState.signedIn) {
        router.replace("/login");
        return;
      }

      if (authState.role !== "admin") {
        router.replace("/report");
        return;
      }

      const [
        reportsResponse,
        notificationsResponse,
      ] = await Promise.all([
        getAdminReports(),
        getAdminNotifications(),
      ]);

      setReports(
        reportsResponse.reports || []
      );

      setNotifications(
        notificationsResponse.notifications ||
          []
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to load administrator data."
      );
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------
  // Resolve report
  // -------------------------------------------------

  async function handleResolveReport(
    reportId: string
  ) {
    try {
      setProcessingId(reportId);

      await resolveReport(reportId);

      setReports((current) =>
        current.map((report) =>
          report.reportId === reportId
            ? {
                ...report,
                status: "RESOLVED",
                resolvedAt:
                  new Date().toISOString(),
              }
            : report
        )
      );
    } catch (err: any) {
      alert(
        err?.message ||
          "Unable to resolve this report."
      );
    } finally {
      setProcessingId("");
    }
  }

  // -------------------------------------------------
  // Load evidence
  // -------------------------------------------------

  async function handleViewEvidence(
    reportId: string
  ) {
    try {
      setEvidenceLoading(true);
      setEvidenceError("");
      setEvidenceItems([]);
      setEvidenceIndex(0);
      setSelectedEvidenceReportId(
        reportId
      );

      const result =
        await getEvidenceUrl(reportId);

      if (
        Array.isArray(result.evidence) &&
        result.evidence.length > 0
      ) {
        const items: EvidenceItem[] =
          result.evidence.map(
            (item: any) => ({
              key: item.key,
              evidenceUrl:
                item.evidenceUrl,
              mediaType:
                item.mediaType === "video"
                  ? "video"
                  : "image",
              contentType:
                item.contentType || "",
            })
          );

        setEvidenceItems(items);
        setEvidenceIndex(0);

        return;
      }

      if (result.evidenceUrl) {
        let mediaType: MediaType =
          "image";

        if (
          result.mediaType === "video"
        ) {
          mediaType = "video";
        } else if (
          result.contentType?.startsWith(
            "video/"
          )
        ) {
          mediaType = "video";
        } else if (
          result.photoKey
            ?.toLowerCase()
            .endsWith(".mp4") ||
          result.photoKey
            ?.toLowerCase()
            .endsWith(".webm") ||
          result.photoKey
            ?.toLowerCase()
            .endsWith(".mov")
        ) {
          mediaType = "video";
        }

        setEvidenceItems([
          {
            key:
              result.photoKey ||
              "evidence",
            evidenceUrl:
              result.evidenceUrl,
            mediaType,
            contentType:
              result.contentType || "",
          },
        ]);

        setEvidenceIndex(0);

        return;
      }

      throw new Error(
        "No evidence was returned."
      );
    } catch (err: any) {
      console.error(err);

      setEvidenceError(
        err?.message ||
          "Unable to load evidence."
      );
    } finally {
      setEvidenceLoading(false);
    }
  }

  // -------------------------------------------------
  // Evidence navigation
  // -------------------------------------------------

  function handlePreviousEvidence() {
    if (evidenceItems.length <= 1) {
      return;
    }

    setEvidenceIndex((current) =>
      current === 0
        ? evidenceItems.length - 1
        : current - 1
    );
  }

  function handleNextEvidence() {
    if (evidenceItems.length <= 1) {
      return;
    }

    setEvidenceIndex((current) =>
      current === evidenceItems.length - 1
        ? 0
        : current + 1
    );
  }

  function closeEvidence() {
    setEvidenceItems([]);
    setEvidenceIndex(0);
    setEvidenceError("");
    setSelectedEvidenceReportId("");
  }

  // -------------------------------------------------
  // Acknowledge notification
  // -------------------------------------------------

  async function handleAcknowledgeNotification(
    notificationId: string
  ) {
    try {
      setProcessingId(
        notificationId
      );

      await acknowledgeNotification(
        notificationId
      );

      const notification = notifications.find(
        (item) => item.notificationId === notificationId
      );

      setNotifications((current) =>
        current.map((notification) =>
          notification.notificationId ===
          notificationId
            ? {
                ...notification,
                status: "ACKNOWLEDGED",
                acknowledgedAt:
                  new Date().toISOString(),
            }
            : notification
        )
      );

      // Keep the report list synchronized with the notification
      // acknowledgement. The backend also persists this transition.
      if (notification?.reportId) {
        setReports((current) =>
          current.map((report) =>
            report.reportId === notification.reportId &&
            report.status !== "RESOLVED"
              ? {
                  ...report,
                  status: "ACKNOWLEDGED",
              }
              : report
          )
        );
      }
    } catch (err: any) {
      alert(
        err?.message ||
          "Unable to acknowledge notification."
      );
    } finally {
      setProcessingId("");
    }
  }

  // -------------------------------------------------
  // Filter + sort reports
  // -------------------------------------------------

  const filteredReports = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase();

    const result = reports.filter(
      (report) => {
        const matchesSearch =
          !query ||
          report.reportId
            ?.toLowerCase()
            .includes(query) ||
          report.description
            ?.toLowerCase()
            .includes(query) ||
          report.town
            ?.toLowerCase()
            .includes(query) ||
          report.quarter
            ?.toLowerCase()
            .includes(query) ||
          report.incidentType
            ?.toLowerCase()
            .includes(query);

        const matchesType =
          typeFilter === "ALL" ||
          report.incidentType ===
            typeFilter;

        const matchesStatus =
          statusFilter === "ALL" ||
          report.status === statusFilter;

        return (
          matchesSearch &&
          matchesType &&
          matchesStatus
        );
      }
    );

    return result.sort((a, b) => {
      if (
        sortOption === "newest"
      ) {
        return (
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
        );
      }

      if (
        sortOption === "oldest"
      ) {
        return (
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime()
        );
      }

      if (
        sortOption === "type"
      ) {
        return formatIncidentType(
          a.incidentType
        ).localeCompare(
          formatIncidentType(
            b.incidentType
          )
        );
      }

      if (
        sortOption === "status"
      ) {
        return formatStatus(
          a.status
        ).localeCompare(
          formatStatus(
            b.status
          )
        );
      }

      return 0;
    });
  }, [
    reports,
    searchQuery,
    typeFilter,
    statusFilter,
    sortOption,
  ]);

  // -------------------------------------------------
  // Statistics
  // -------------------------------------------------

  const activeReports =
    reports.filter(
      (report) =>
        report.status !== "RESOLVED"
    ).length;

  const resolvedReports =
    reports.filter(
      (report) =>
        report.status === "RESOLVED"
    ).length;

  const unacknowledgedNotifications =
    notifications.filter(
      (notification) =>
        notification.status ===
        "UNACKNOWLEDGED"
    ).length;

  const criticalReports =
    reports.filter(
      (report) =>
        report.incidentType ===
          "CHILD_ABUSE" &&
        report.status !== "RESOLVED"
    ).length;

  const currentEvidence =
    evidenceItems[evidenceIndex];

  // -------------------------------------------------
  // Loading
  // -------------------------------------------------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-red-500" />

          <p className="text-sm font-medium text-slate-300">
            Verifying administrator access...
          </p>

          <p className="mt-1 text-xs text-slate-500">
            SOS-Kamer Incident Response
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">

      {/* =================================================
          TOP NAVIGATION
      ================================================= */}

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">

        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
              <span className="text-lg font-black">
                S
              </span>
            </div>

            <div>
              <p className="text-base font-bold tracking-tight text-slate-950">
                SOS-Kamer
              </p>

              <p className="text-xs font-medium text-slate-500">
                Incident Response Console
              </p>
            </div>

          </div>

          <div className="flex items-center gap-3">

            <div className="hidden text-right sm:block">

              <p className="text-sm font-semibold text-slate-800">
                Administrator
              </p>

              <p className="text-xs text-slate-500">
                Operations Dashboard
              </p>

            </div>

            <SignOutButton />

          </div>

        </div>

      </header>

      {/* =================================================
          MAIN CONTENT
      ================================================= */}

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* =================================================
            PAGE INTRO
        ================================================= */}

        <section className="mb-8">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

            <div>

              <div className="mb-2 flex items-center gap-2">

                <span className="h-2 w-2 rounded-full bg-red-500" />

                <span className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
                  Live Operations
                </span>

              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Incident Dashboard
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Monitor incoming reports, review
                evidence, and manage incident
                response from one place.
              </p>

            </div>

            <button
              onClick={loadAdminData}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              ↻ Refresh data
            </button>

          </div>

        </section>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">

            <span className="mt-0.5 font-bold">
              !
            </span>

            <div>

              <p className="font-semibold">
                Dashboard error
              </p>

              <p className="mt-1">
                {error}
              </p>

            </div>

          </div>
        )}

        {/* =================================================
            STATISTICS
        ================================================= */}

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* Active */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-sm font-medium text-slate-500">
                  Active incidents
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  {activeReports}
                </p>

              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              </div>

            </div>

            <p className="mt-4 text-xs font-medium text-slate-400">
              Reports requiring attention
            </p>

          </div>

          {/* Critical */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-sm font-medium text-slate-500">
                  Critical incidents
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  {criticalReports}
                </p>

              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                !
              </div>

            </div>

            <p className="mt-4 text-xs font-medium text-red-600">
              Active child-abuse reports
            </p>

          </div>

          {/* Notifications */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-sm font-medium text-slate-500">
                  Needs attention
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  {unacknowledgedNotifications}
                </p>

              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                !
              </div>

            </div>

            <p className="mt-4 text-xs font-medium text-slate-400">
              Unacknowledged notifications
            </p>

          </div>

          {/* Resolved */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-sm font-medium text-slate-500">
                  Resolved incidents
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  {resolvedReports}
                </p>

              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                ✓
              </div>

            </div>

            <p className="mt-4 text-xs font-medium text-slate-400">
              Successfully closed reports
            </p>

          </div>

        </section>

        {/* =================================================
            EVIDENCE VIEWER
        ================================================= */}

        {(evidenceLoading ||
          evidenceError ||
          evidenceItems.length > 0) && (

          <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <span className="h-2 w-2 rounded-full bg-slate-900" />

                  <h2 className="text-sm font-bold text-slate-950">
                    Evidence review
                  </h2>

                </div>

                {selectedEvidenceReportId && (
                  <p className="mt-1 text-xs text-slate-500">
                    Report{" "}
                    <span className="font-mono font-semibold text-slate-700">
                      {selectedEvidenceReportId}
                    </span>
                  </p>
                )}

              </div>

              {(evidenceItems.length > 0 ||
                evidenceError) && (

                <button
                  onClick={closeEvidence}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Close preview
                </button>

              )}

            </div>

            <div className="p-5">

              {evidenceLoading && (
                <div className="flex flex-col items-center justify-center py-16">

                  <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

                  <p className="text-sm font-medium text-slate-500">
                    Loading secure evidence...
                  </p>

                </div>
              )}

              {evidenceError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {evidenceError}
                </div>
              )}

              {currentEvidence &&
                !evidenceLoading && (

                <div className="flex flex-col items-center">

                  <div className="mb-4 flex items-center gap-2">

                    <span
                      className={
                        currentEvidence.mediaType ===
                        "video"
                          ? "rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700"
                          : "rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                      }
                    >
                      {currentEvidence.mediaType ===
                      "video"
                        ? "Video"
                        : "Image"}
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {evidenceIndex + 1} of{" "}
                      {evidenceItems.length}
                    </span>

                  </div>

                  <div className="flex w-full items-center justify-center gap-2 sm:gap-4">

                    <button
                      onClick={
                        handlePreviousEvidence
                      }
                      disabled={
                        evidenceItems.length <=
                        1
                      }
                      aria-label="Previous evidence"
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ←
                    </button>

                    <div className="flex min-h-[260px] flex-1 items-center justify-center overflow-hidden rounded-xl bg-slate-950 p-2 sm:min-h-[420px]">

                      {currentEvidence.mediaType ===
                      "image" ? (

                        <img
                          key={
                            currentEvidence.evidenceUrl
                          }
                          src={
                            currentEvidence.evidenceUrl
                          }
                          alt={`Incident evidence ${
                            evidenceIndex + 1
                          }`}
                          className="max-h-[560px] w-auto max-w-full rounded-lg object-contain"
                        />

                      ) : (

                        <video
                          key={
                            currentEvidence.evidenceUrl
                          }
                          src={
                            currentEvidence.evidenceUrl
                          }
                          controls
                          playsInline
                          preload="metadata"
                          className="max-h-[560px] w-full rounded-lg"
                        >
                          Your browser does not support
                          video playback.
                        </video>

                      )}

                    </div>

                    <button
                      onClick={
                        handleNextEvidence
                      }
                      disabled={
                        evidenceItems.length <=
                        1
                      }
                      aria-label="Next evidence"
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      →
                    </button>

                  </div>

                  <div className="mt-4 max-w-xl text-center">

                    <p className="text-xs font-medium text-slate-500">
                      {currentEvidence.contentType ||
                        "Evidence file"}
                    </p>

                    <p className="mt-1 break-all font-mono text-[10px] text-slate-400">
                      {currentEvidence.key
                        .split("/")
                        .pop()}
                    </p>

                  </div>

                </div>

              )}

            </div>

          </section>
        )}

        {/* =================================================
            INCIDENT REPORTS
        ================================================= */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* Header */}

          <div className="border-b border-slate-200 px-5 py-5 sm:px-6">

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <h2 className="text-lg font-bold tracking-tight text-slate-950">
                    Incident reports
                  </h2>

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {filteredReports.length}
                  </span>

                </div>

              </div>

              {/* Filters */}

              <div className="flex flex-col gap-2 sm:flex-row">

                {/* Search */}

                <div className="relative">

                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    ⌕
                  </span>

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) =>
                      setSearchQuery(
                        event.target.value
                      )
                    }
                    placeholder="Search reports..."
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:w-56"
                  />

                </div>

                {/* Type */}

                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(
                      event.target.value
                    )
                  }
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >

                  {INCIDENT_TYPES.map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type === "ALL"
                          ? "All types"
                          : formatIncidentType(
                              type
                            )}
                      </option>
                    )
                  )}

                </select>

                {/* Status */}

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >

                  <option value="ALL">
                    All statuses
                  </option>

                  <option value="NEW">
                    Active
                  </option>

                  <option value="RESOLVED">
                    Resolved
                  </option>

                </select>

                {/* Sort */}

                <select
                  value={sortOption}
                  onChange={(event) =>
                    setSortOption(
                      event.target
                        .value as SortOption
                    )
                  }
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >

                  <option value="newest">
                    Newest first
                  </option>

                  <option value="oldest">
                    Oldest first
                  </option>

                  <option value="type">
                    Sort by type
                  </option>

                  <option value="status">
                    Sort by status
                  </option>

                </select>

              </div>

            </div>

          </div>

          {/* Empty state */}

          {filteredReports.length === 0 ? (

            <div className="px-6 py-16 text-center">

              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-400">
                ✓
              </div>

              <h3 className="text-sm font-bold text-slate-800">
                No reports found
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Try changing your search or
                filters.
              </p>

              {(searchQuery ||
                typeFilter !== "ALL" ||
                statusFilter !== "ALL") && (

                <button
                  onClick={() => {
                    setSearchQuery("");
                    setTypeFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                  className="mt-4 text-sm font-semibold text-slate-900 underline underline-offset-4"
                >
                  Clear filters
                </button>

              )}

            </div>

          ) : (

            <>

              {/* Desktop table */}

              <div className="hidden overflow-x-auto lg:block">

                <table className="w-full text-left">

                  <thead className="border-b border-slate-200 bg-slate-50">

                    <tr>

                      <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Incident
                      </th>

                      <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Location
                      </th>

                      <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Description
                      </th>

                      <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Reported
                      </th>

                      <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Status
                      </th>

                      <th className="px-6 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Actions
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {filteredReports.map(
                      (report) => {

                        const evidenceCount =
                          report.evidence?.length ||
                          (report.photoKey ? 1 : 0);

                        return (

                          <tr
                            key={
                              report.reportId
                            }
                            className="group transition hover:bg-slate-50/70"
                          >

                            {/* Incident */}

                            <td className="px-6 py-4">

                              <div className="flex flex-col gap-2">

                                <IncidentBadge
                                  type={
                                    report.incidentType
                                  }
                                />

                              </div>

                            </td>

                            {/* Location */}

                            <td className="px-6 py-4">

                              <p className="text-sm font-semibold text-slate-800">
                                {report.town}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-500">
                                {report.quarter}
                              </p>

                            </td>

                            {/* Description */}

                            <td className="max-w-md px-6 py-4">

                              <p className="line-clamp-2 text-sm leading-5 text-slate-600">
                                {
                                  report.description
                                }
                              </p>

                              {evidenceCount >
                                0 && (

                                <button
                                  onClick={() =>
                                    handleViewEvidence(
                                      report.reportId
                                    )
                                  }
                                  disabled={
                                    evidenceLoading &&
                                    selectedEvidenceReportId ===
                                      report.reportId
                                  }
                                  className="mt-2 text-xs font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950"
                                >
                                  {evidenceLoading &&
                                  selectedEvidenceReportId ===
                                    report.reportId
                                    ? "Loading evidence..."
                                    : `${evidenceCount} evidence ${
                                        evidenceCount ===
                                        1
                                          ? "file"
                                          : "files"
                                      }`}
                                </button>

                              )}

                            </td>

                            {/* Reported */}

                            <td className="px-6 py-4">

                              <p className="text-sm font-semibold text-slate-700">
                                {formatRelativeTime(
                                  report.createdAt
                                )}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-400">
                                {formatDate(
                                  report.createdAt
                                )}
                              </p>

                            </td>

                            {/* Status */}

                            <td className="px-6 py-4">

                              <StatusBadge
                                status={
                                  report.status
                                }
                              />

                            </td>

                            {/* Actions */}

                            <td className="px-6 py-4">

                              <div className="flex items-center justify-end gap-2">

                                {evidenceCount >
                                  0 && (

                                  <button
                                    onClick={() =>
                                      handleViewEvidence(
                                        report.reportId
                                      )
                                    }
                                    disabled={
                                      evidenceLoading &&
                                      selectedEvidenceReportId ===
                                        report.reportId
                                    }
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    View
                                  </button>

                                )}

                                {report.status !==
                                "RESOLVED" ? (

                                  <button
                                    onClick={() =>
                                      handleResolveReport(
                                        report.reportId
                                      )
                                    }
                                    disabled={
                                      processingId ===
                                      report.reportId
                                    }
                                    className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {processingId ===
                                    report.reportId
                                      ? "Resolving..."
                                      : "Resolve"}
                                  </button>

                                ) : (

                                  <span className="px-3 py-2 text-xs font-semibold text-emerald-600">
                                    Closed
                                  </span>

                                )}

                              </div>

                            </td>

                          </tr>

                        );

                      }
                    )}

                  </tbody>

                </table>

              </div>

              {/* Mobile cards */}

              <div className="divide-y divide-slate-100 lg:hidden">

                {filteredReports.map(
                  (report) => {

                    const evidenceCount =
                      report.evidence?.length ||
                      (report.photoKey ? 1 : 0);

                    return (

                      <div
                        key={
                          report.reportId
                        }
                        className="p-5"
                      >

                        <div className="flex items-start justify-between gap-4">

                          <div>

                            <IncidentBadge
                              type={
                                report.incidentType
                              }
                            />

                          </div>

                          <StatusBadge
                            status={
                              report.status
                            }
                          />

                        </div>

                        <div className="mt-4">

                          <p className="text-sm font-semibold text-slate-800">
                            {report.town}
                          </p>

                          <p className="text-xs text-slate-500">
                            {report.quarter}
                          </p>

                        </div>

                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {
                            report.description
                          }
                        </p>

                        <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">

                          <span>
                            {formatRelativeTime(
                              report.createdAt
                            )}
                          </span>

                          {evidenceCount >
                            0 && (

                            <>
                              <span>
                                •
                              </span>

                              <span>
                                {evidenceCount}{" "}
                                {evidenceCount ===
                                1
                                  ? "evidence"
                                  : "evidence files"}
                              </span>
                            </>

                          )}

                        </div>

                        <div className="mt-4 flex gap-2">

                          {evidenceCount >
                            0 && (

                            <button
                              onClick={() =>
                                handleViewEvidence(
                                  report.reportId
                                )
                              }
                              className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700"
                            >
                              View evidence
                            </button>

                          )}

                          {report.status !==
                          "RESOLVED" ? (

                            <button
                              onClick={() =>
                                handleResolveReport(
                                  report.reportId
                                )
                              }
                              disabled={
                                processingId ===
                                report.reportId
                              }
                              className="flex-1 rounded-lg bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {processingId ===
                              report.reportId
                                ? "Resolving..."
                                : "Resolve"}
                            </button>

                          ) : (

                            <div className="flex flex-1 items-center justify-center rounded-lg bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">
                              Resolved
                            </div>

                          )}

                        </div>

                      </div>

                    );

                  }
                )}

              </div>

            </>

          )}

        </section>

        {/* =================================================
            NOTIFICATIONS
        ================================================= */}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-5 py-5 sm:px-6">

            <div className="flex items-center justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <h2 className="text-lg font-bold tracking-tight text-slate-950">
                    Notifications
                  </h2>

                  {unacknowledgedNotifications >
                    0 && (

                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      {
                        unacknowledgedNotifications
                      }{" "}
                      pending
                    </span>

                  )}

                </div>

                <p className="mt-1 text-xs text-slate-500">
                  System alerts requiring administrator
                  acknowledgement.
                </p>

              </div>

            </div>

          </div>

          {notifications.length ===
          0 ? (

            <div className="px-6 py-12 text-center">

              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                ✓
              </div>

              <p className="text-sm font-semibold text-slate-700">
                No notifications
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Everything is up to date.
              </p>

            </div>

          ) : (

            <div className="divide-y divide-slate-100">

              {notifications
                .slice()
                .sort(
                  (a, b) =>
                    new Date(
                      b.createdAt
                    ).getTime() -
                    new Date(
                      a.createdAt
                    ).getTime()
                )
                .map(
                  (notification) => (

                    <div
                      key={
                        notification.notificationId
                      }
                      className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                    >

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <IncidentBadge
                            type={
                              notification.incidentType
                            }
                          />

                          {notification.status ===
                            "UNACKNOWLEDGED" && (

                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                              Needs attention
                            </span>

                          )}

                        </div>

                        <p className="mt-3 text-sm font-semibold text-slate-800">
                          {
                            notification.description
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {notification.town}{" "}
                          ·{" "}
                          {
                            notification.quarter
                          }
                        </p>

                        <p className="mt-2 text-[11px] text-slate-400">
                          {formatRelativeTime(
                            notification.createdAt
                          )}
                        </p>

                      </div>

                      {notification.status ===
                      "UNACKNOWLEDGED" ? (

                        <button
                          onClick={() =>
                            handleAcknowledgeNotification(
                              notification.notificationId
                            )
                          }
                          disabled={
                            processingId ===
                            notification.notificationId
                          }
                          className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                        >
                          {processingId ===
                          notification.notificationId
                            ? "Acknowledging..."
                            : "Acknowledge"}
                        </button>

                      ) : (

                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">

                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50">
                            ✓
                          </span>

                          Acknowledged

                        </span>

                      )}

                    </div>

                  )
                )}

            </div>

          )}

        </section>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="py-8 text-center">

          <p className="text-xs text-slate-400">
            SOS-Kamer · Incident Response Platform
          </p>

          <p className="mt-1 text-[10px] text-slate-300">
            Administrator console
          </p>

        </footer>

      </div>

    </main>
  );
}