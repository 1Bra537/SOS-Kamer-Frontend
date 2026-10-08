"use client";

import { useLocale, useTranslations } from "next-intl";
import T from "../../../components/T";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { configureAmplify } from "@/lib/amplify";
import { getAuthState } from "@/lib/auth";
import {
  getAdminNotifications,
  getAdminNotificationCount,
  acknowledgeNotification,
} from "@/lib/api";
import SignOutButton from "../../../components/SignOutButton";

type Notification = {
  notificationId: string;
  reportId: string;
  incidentType: string;

  /**
   * Optional because a VOICE notification may not
   * contain a text description.
   */
  description?: string;

  descriptionType?: "TEXT" | "VOICE";

  town?: string;
  quarter?: string;

  /**
   * Anonymous reports do not have a citizen identity.
   */
  isAnonymous?: boolean;

  status: string;
  createdAt: string;
  acknowledgedAt?: string;
};

function formatIncidentType(type: string) {
  return type
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string | undefined, locale: string, unknownText: string) {
  if (!value) return unknownText;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminNotificationsPage() {
  const tu = useTranslations("ui");
  const locale = useLocale();
  const router = useRouter();

  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [count, setCount] = useState(0);

  const [loading, setLoading] =
    useState(true);

  const [processingId, setProcessingId] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError("");

      configureAmplify();

      const auth = await getAuthState();

      if (!auth.signedIn) {
        return router.replace("/login");
      }

      if (auth.role !== "admin") {
        return router.replace("/report");
      }

      const [
        notificationsResponse,
        countResponse,
      ] = await Promise.all([
        getAdminNotifications(),
        getAdminNotificationCount(),
      ]);

      setNotifications(
        notificationsResponse.notifications || []
      );

      setCount(
        countResponse.count || 0
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          tu("unableNotifications")
      );
    } finally {
      setLoading(false);
    }
  }

  async function acknowledge(
    notificationId: string
  ) {
    try {
      setProcessingId(notificationId);

      await acknowledgeNotification(
        notificationId
      );

      setNotifications((items) =>
        items.map((item) =>
          item.notificationId ===
          notificationId
            ? {
                ...item,
                status:
                  "ACKNOWLEDGED",
                acknowledgedAt:
                  new Date().toISOString(),
              }
            : item
        )
      );

      setCount((value) =>
        Math.max(0, value - 1)
      );
    } catch (err: any) {
      alert(
        err?.message ||
          tu("unableAcknowledge")
      );
    } finally {
      setProcessingId("");
    }
  }

  const sorted = [
    ...notifications,
  ].sort(
    (a, b) =>
      new Date(
        b.createdAt
      ).getTime() -
      new Date(
        a.createdAt
      ).getTime()
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <p className="text-sm text-slate-300"><T k="loadingNotifications" /></p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-base font-bold tracking-tight text-slate-950">
              SOS-Kamer
            </p>

            <p className="text-xs font-medium text-slate-500">
              <T k="notificationsAdmin" />
            </p>
          </div>

          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              onClick={() =>
                router.push("/admin")
              }
              className="mb-4 text-xs font-semibold text-slate-500 hover:text-slate-950"
            >
              <T k="backDashboard" />
            </button>

            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                <T k="notifications" />
              </h1>

              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                {count} current
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-500"><T k="reviewAlerts" /></p>
          </div>

          <button
            onClick={load}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <T k="refresh" />
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {sorted.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                ✓
              </div>

              <p className="text-sm font-semibold text-slate-700">
                <T k="noNotifications" />
              </p>

              <p className="mt-1 text-xs text-slate-400">
                <T k="upToDate" />
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sorted.map(
                (notification) => {
                  const pending =
                    notification.status ===
                    "UNACKNOWLEDGED";

                  return (
                    <div
                      key={
                        notification.notificationId
                      }
                      className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
                            {formatIncidentType(
                              notification.incidentType
                            )}
                          </span>

                          {notification.isAnonymous && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                              <T k="anonymous" />
                            </span>
                          )}

                          {pending ? (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                              <T k="needsAttention" />
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                              <T k="acknowledged" />
                            </span>
                          )}
                        </div>

                        <p className="mt-3 text-sm font-semibold text-slate-800">
                          {notification.description ||
                            (notification.descriptionType ===
                            "VOICE"
                              ? tu("voiceAttached")
                              : tu("noDescriptionProvided"))}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {notification.town ||
                            tu("unknownTown")}{" "}
                          ·{" "}
                          {notification.quarter ||
                            "Unknown quarter"}
                        </p>

                        <p className="mt-2 text-[11px] text-slate-400">
                          Report{" "}
                          <span className="font-mono">
                            {
                              notification.reportId
                            }
                          </span>{" "}
                          ·{" "}
                          {formatDate(notification.createdAt, locale, tu("unknown"))}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            router.push(
                              `/admin?reportId=${encodeURIComponent(
                                notification.reportId
                              )}`
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        ><T k="viewReport" /></button>

                        {pending ? (
                          <button
                            onClick={() =>
                              acknowledge(
                                notification.notificationId
                              )
                            }
                            disabled={
                              processingId ===
                              notification.notificationId
                            }
                            className="rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            {processingId ===
                            notification.notificationId
                              ? "Acknowledging..."
                              : "Acknowledge"}
                          </button>
                        ) : (
                          <span className="px-2 py-2.5 text-xs font-semibold text-emerald-600">
                            <T k="acknowledge" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}