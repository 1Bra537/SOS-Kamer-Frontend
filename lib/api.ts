import { fetchAuthSession } from "aws-amplify/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

if (!API_URL) {
  console.warn(
    "NEXT_PUBLIC_API_URL is not configured."
  );
}

// =========================================================
// TYPES
// =========================================================

export type UploadType = "evidence" | "voice";

export type ReportDescriptionType = "TEXT" | "VOICE";

export type MediaType = "image" | "video";

export type EvidencePayload = {
  key: string;
  contentType: string;
  mediaType: MediaType;
};

export type CreateReportPayload = {
  reportId: string;
  incidentType: string;

  /**
   * Text description is optional because VOICE reports
   * intentionally do not contain a text description.
   */
  description?: string;

  descriptionType: ReportDescriptionType;

  audioKey?: string;
  audioContentType?: string;

  evidence: EvidencePayload[];

  town: string;
  quarter: string;

  latitude: number;
  longitude: number;
  locationAccuracy: number;
  locationCapturedAt: string;
};

export type UploadResponse = {
  reportId: string;

  evidenceId?: string;

  photoKey?: string;
  evidenceKey?: string;

  audioKey?: string;

  uploadUrl: string;

  contentType: string;

  mediaType: "image" | "video" | "audio";

  uploadType: UploadType;

  ExpiresIn?: number;
};

export type CitizenReport = {
  reportId: string;
  incidentType: string;

  description?: string;
  descriptionType?: ReportDescriptionType;

  audioKey?: string;
  audioContentType?: string;
  audioUrl?: string;

  town: string;
  quarter: string;

  latitude?: number | string;
  longitude?: number | string;
  locationAccuracy?: number | string;
  locationCapturedAt?: string;

  status: string;

  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;

  evidenceCount: number;

  statusHistory: {
    status: string;
    timestamp: string;
    actor?: string;
  }[];
};

export type AdminReport = {
  reportId: string;

  /**
   * Anonymous reports intentionally do not contain
   * a citizenId.
   */
  citizenId?: string;

  /**
   * True when the report was submitted anonymously.
   */
  isAnonymous?: boolean;

  incidentType: string;

  description?: string;
  descriptionType?: ReportDescriptionType;

  audioKey?: string;
  audioContentType?: string;

  photoKey?: string;

  evidence?: EvidencePayload[];

  town: string;
  quarter: string;

  latitude?: number | string;
  longitude?: number | string;
  locationAccuracy?: number | string;
  locationCapturedAt?: string;

  status: string;

  createdAt: string;
  updatedAt?: string;

  acknowledgedAt?: string;
  resolvedAt?: string;

  statusHistory?: {
    status: string;
    timestamp: string;
    actorType?: string;
    actorId?: string;
  }[];
};

export type AdminNotification = {
  notificationId: string;
  reportId: string;

  incidentType: string;

  /**
   * Optional because voice reports may not have
   * a text description.
   */
  description?: string;

  descriptionType?: ReportDescriptionType;

  town?: string;
  quarter?: string;

  /**
   * True when the notification belongs to an
   * anonymous report.
   */
  isAnonymous?: boolean;

  status: string;

  createdAt: string;
  acknowledgedAt?: string;
};

// =========================================================
// ADMIN ANALYTICS
// =========================================================

export type AdminAnalytics = {
  summary: {
    totalReports: number;
    newReports: number;
    acknowledgedReports: number;
    inProgressReports: number;
    resolvedReports: number;
  };

  reportsByType: {
    type: string;
    count: number;
  }[];

  reportsByStatus: {
    status: string;
    count: number;
  }[];

  reportsOverTime: {
    date: string;
    count: number;
  }[];

  reportsByTown: {
    town: string;
    count: number;
  }[];

  averageAcknowledgementTimeMinutes: number;
  averageResolutionTimeMinutes: number;

  filters?: {
    type?: string;
    town?: string;
    status?: string;
    period?: string;
  };
};

// =========================================================
// COMMON HELPERS
// =========================================================

async function authHeaders(): Promise<Record<string, string>> {
  const session = await fetchAuthSession();

  const token =
    session.tokens?.idToken?.toString();

  if (!token) {
    throw new Error(
      "You must be signed in to perform this action."
    );
  }

  return {
    "Content-Type": "application/json",
    Authorization: token,
  };
}

async function parseResponse<T = any>(
  response: Response
): Promise<T> {
  const text = await response.text();

  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      message: text,
    };
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data as T;
}

function requireApiUrl() {
  if (!API_URL) {
    throw new Error(
      "API URL is not configured."
    );
  }
}

// =========================================================
// UPLOADS
// =========================================================

export async function getUploadUrl(
  file: File,
  reportId?: string,
  uploadType: UploadType = "evidence"
): Promise<UploadResponse> {
  requireApiUrl();

  const headers = await authHeaders();

  const response = await fetch(
    `${API_URL}/uploads/presign`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        uploadType,
        ...(reportId
          ? {
              reportId,
              existingReportId: reportId,
            }
          : {}),
      }),
    }
  );

  return parseResponse<UploadResponse>(
    response
  );
}

/**
 * Public upload endpoint used for anonymous reports.
 *
 * No Cognito token is attached here intentionally.
 */
export async function getAnonymousUploadUrl(
  file: File,
  reportId?: string,
  uploadType: UploadType = "evidence"
): Promise<UploadResponse> {
  requireApiUrl();

  const response = await fetch(
    `${API_URL}/anonymous/uploads/presign`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        uploadType,
        ...(reportId
          ? {
              reportId,
              existingReportId: reportId,
            }
          : {}),
      }),
    }
  );

  return parseResponse<UploadResponse>(
    response
  );
}

export async function uploadEvidence(
  uploadUrl: string,
  file: File,
  contentType?: string
): Promise<void> {
  const uploadContentType =
    contentType ||
    file.type ||
    "application/octet-stream";

  const response = await fetch(
    uploadUrl,
    {
      method: "PUT",
      headers: {
        "Content-Type": uploadContentType,
      },
      body: file,
    }
  );

  if (!response.ok) {
    throw new Error(
      `File upload failed with status ${response.status}.`
    );
  }
}

// =========================================================
// REPORT CREATION
// =========================================================

/**
 * Create a normal authenticated citizen report.
 */
export async function createReport(
  payload: CreateReportPayload
) {
  requireApiUrl();

  const response = await fetch(
    `${API_URL}/reports`,
    {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return parseResponse(response);
}

/**
 * Create an anonymous report.
 *
 * This endpoint deliberately does not send an
 * Authorization header.
 */
export async function createAnonymousReport(
  payload: CreateReportPayload
) {
  requireApiUrl();

  const response = await fetch(
    `${API_URL}/anonymous/reports`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  return parseResponse(response);
}

// =========================================================
// CITIZEN REPORTS
// =========================================================

export async function getMyReports(): Promise<{
  reports: CitizenReport[];
  count: number;
}> {
  requireApiUrl();

  const response = await fetch(
    `${API_URL}/reports/my`,
    {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
    }
  );

  return parseResponse(response);
}

export async function getMyReport(
  reportId: string
): Promise<{
  report: CitizenReport;
}> {
  requireApiUrl();

  const response = await fetch(
    `${API_URL}/reports/my/${encodeURIComponent(
      reportId
    )}`,
    {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
    }
  );

  return parseResponse(response);
}

// =========================================================
// ADMIN REPORTS
// =========================================================

export async function getAdminReports(): Promise<{
  reports: AdminReport[];
}> {
  requireApiUrl();

  const response = await fetch(
    `${API_URL}/admin/reports`,
    {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
    }
  );

  return parseResponse(response);
}

export async function resolveReport(
  reportId: string
) {
  requireApiUrl();

  const response = await fetch(
    `${API_URL}/admin/reports/${encodeURIComponent(
      reportId
    )}`,
    {
      method: "PATCH",
      headers: await authHeaders(),
      body: JSON.stringify({
        status: "RESOLVED",
      }),
    }
  );

  return parseResponse(response);
}

// =========================================================
// ADMIN EVIDENCE
// =========================================================

export async function getEvidenceUrl(
  reportId: string
) {
  requireApiUrl();

  const response = await fetch(
    `${API_URL}/admin/reports/${encodeURIComponent(
      reportId
    )}/evidence`,
    {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
    }
  );

  return parseResponse(response);
}

export async function getEvidenceDownloadUrl(
  reportId: string,
  index: number
) {
  requireApiUrl();

  const response = await fetch(
    `${API_URL}/admin/reports/${encodeURIComponent(
      reportId
    )}/evidence/${index}/download`,
    {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
    }
  );

  return parseResponse(response);
}

// =========================================================
// ADMIN VOICE DESCRIPTIONS
// =========================================================

export async function getAdminDescriptionAudioUrl(
  reportId: string
) {
  requireApiUrl();

  const response = await fetch(
    `${API_URL}/admin/reports/${encodeURIComponent(
      reportId
    )}/description-audio`,
    {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
    }
  );

  return parseResponse(response);
}

/**
 * Backwards-compatible API name used by the admin page.
 *
 * app/admin/page.tsx imports:
 * getReportDescriptionAudioUrl
 *
 * Keep both names so existing code using
 * getAdminDescriptionAudioUrl continues to work.
 */
export const getReportDescriptionAudioUrl =
  getAdminDescriptionAudioUrl;

// =========================================================
// ADMIN PDF
// =========================================================

export async function getReportPdfUrl(
  reportId: string
) {
  requireApiUrl();

  const response = await fetch(
    `${API_URL}/admin/reports/${encodeURIComponent(
      reportId
    )}/pdf`,
    {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
    }
  );

  return parseResponse(response);
}

// =========================================================
// ADMIN NOTIFICATIONS
// =========================================================

export async function getAdminNotifications(): Promise<{
  notifications: AdminNotification[];
}> {
  requireApiUrl();

  const response = await fetch(
    `${API_URL}/admin/notifications`,
    {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
    }
  );

  return parseResponse(response);
}

export async function getAdminNotificationCount(): Promise<{
  count: number;
}> {
  requireApiUrl();

  const response = await fetch(
    `${API_URL}/admin/notifications/count`,
    {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
    }
  );

  return parseResponse(response);
}

export async function acknowledgeNotification(
  notificationId: string
) {
  requireApiUrl();

  const response = await fetch(
    `${API_URL}/admin/notifications/${encodeURIComponent(
      notificationId
    )}`,
    {
      method: "PATCH",
      headers: await authHeaders(),
      body: JSON.stringify({
        status: "ACKNOWLEDGED",
      }),
    }
  );

  return parseResponse(response);
}

// =========================================================
// ADMIN ANALYTICS
// =========================================================

export async function getAdminAnalytics(
  params?: {
    type?: string;
    town?: string;
    status?: string;
    period?: string;
  }
): Promise<AdminAnalytics> {
  requireApiUrl();

  const searchParams =
    new URLSearchParams();

  if (params?.type) {
    searchParams.set(
      "type",
      params.type
    );
  }

  if (params?.town) {
    searchParams.set(
      "town",
      params.town
    );
  }

  if (params?.status) {
    searchParams.set(
      "status",
      params.status
    );
  }

  if (params?.period) {
    searchParams.set(
      "period",
      params.period
    );
  }

  const query =
    searchParams.toString();

  const response = await fetch(
    `${API_URL}/admin/analytics${
      query ? `?${query}` : ""
    }`,
    {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
    }
  );

  return parseResponse<AdminAnalytics>(
    response
  );
}