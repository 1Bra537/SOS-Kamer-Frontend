import { fetchAuthSession } from "aws-amplify/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  console.warn("NEXT_PUBLIC_API_URL is not configured.");
}

async function authHeaders() {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();

  if (!token) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  return {
    Authorization: token,
    "Content-Type": "application/json",
  };
}

async function parseResponse(response: Response) {
  const text = await response.text();

  let body: any = {};

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text };
  }

  if (!response.ok) {
    throw new Error(
      body?.error ||
        body?.message ||
        `Request failed (${response.status})`
    );
  }

  return body;
}

/* =========================================================
   UPLOADS
   ========================================================= */

export type UploadType =
  | "evidence"
  | "voice";

export async function getUploadUrl(
  file: File,
  reportId?: string,
  uploadType: UploadType = "evidence"
) {
  if (!API_URL) {
    throw new Error(
      "API URL is not configured."
    );
  }

  const response = await fetch(
    `${API_URL}/uploads/presign`,
    {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        uploadType,
        ...(reportId ? { reportId } : {}),
      }),
    }
  );

  return parseResponse(response);
}

export async function uploadEvidence(
  uploadUrl: string,
  file: File,
  contentType?: string
) {
  const uploadContentType =
    contentType ||
    file.type ||
    "application/octet-stream";

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": uploadContentType,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(
      "Evidence upload failed. Please try again."
    );
  }
}

/* =========================================================
   REPORTS
   ========================================================= */

export type ReportDescriptionType =
  | "TEXT"
  | "VOICE";

export type CreateReportPayload = {
  reportId: string;
  incidentType: string;

  description: string;

  descriptionType: ReportDescriptionType;

  audioKey?: string;

  audioContentType?: string;

  evidence: {
    key: string;
    contentType: string;
    mediaType: "image" | "video";
  }[];

  town: string;
  quarter: string;
};

export async function createReport(
  payload: CreateReportPayload
) {
  if (!API_URL) {
    throw new Error(
      "API URL is not configured."
    );
  }

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

/* =========================================================
   ADMIN REPORTS
   ========================================================= */

export async function getAdminReports() {
  if (!API_URL) {
    throw new Error(
      "API URL is not configured."
    );
  }

  const response = await fetch(
    `${API_URL}/admin/reports`,
    {
      method: "GET",
      headers: await authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function getAdminNotificationCount(): Promise<{
  count: number;
}> {
  if (!API_URL) {
    throw new Error(
      "API URL is not configured."
    );
  }

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

export async function getAdminNotifications() {
  if (!API_URL) {
    throw new Error(
      "API URL is not configured."
    );
  }

  const response = await fetch(
    `${API_URL}/admin/notifications`,
    {
      method: "GET",
      headers: await authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function acknowledgeNotification(
  notificationId: string
) {
  if (!API_URL) {
    throw new Error(
      "API URL is not configured."
    );
  }

  const response = await fetch(
    `${API_URL}/admin/notifications/${notificationId}`,
    {
      method: "PATCH",
      headers: await authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function resolveReport(
  reportId: string
) {
  if (!API_URL) {
    throw new Error(
      "API URL is not configured."
    );
  }

  const response = await fetch(
    `${API_URL}/admin/reports/${reportId}`,
    {
      method: "PATCH",
      headers: await authHeaders(),
    }
  );

  return parseResponse(response);
}

/* =========================================================
   EVIDENCE
   ========================================================= */

export async function getEvidenceUrl(
  reportId: string
) {
  if (!API_URL) {
    throw new Error(
      "API URL is not configured."
    );
  }

  const response = await fetch(
    `${API_URL}/admin/reports/${reportId}/evidence`,
    {
      method: "GET",
      headers: await authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function getEvidenceDownloadUrl(
  reportId: string,
  index: number
) {
  if (!API_URL) {
    throw new Error(
      "API URL is not configured."
    );
  }

  const response = await fetch(
    `${API_URL}/admin/reports/${encodeURIComponent(
      reportId
    )}/evidence/${index}`,
    {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
    }
  );

  return parseResponse(response);
}

/* =========================================================
   REPORT PDF
   ========================================================= */

export async function getReportPdfUrl(
  reportId: string
) {
  if (!API_URL) {
    throw new Error(
      "API URL is not configured."
    );
  }

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

/* =========================================================
   ADMIN ANALYTICS
   ========================================================= */

export type AdminAnalytics = {
  summary: {
    totalReports: number;
    newReports: number;
    acknowledgedReports: number;
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

  reportsByTown: {
    town: string;
    count: number;
  }[];

  availableTowns: string[];

  reportsOverTime: {
    date: string;
    count: number;
  }[];

  filter?: {
    type: string;
    town: string;
    status: string;
    period: string;
  };

  averageAcknowledgementTimeMinutes: number;

  averageResolutionTimeMinutes: number;
};

export type AdminAnalyticsFilters = {
  type?: string;
  town?: string;
  status?: string;
  period?: string;
};

export async function getAdminAnalytics(
  filters: AdminAnalyticsFilters = {}
): Promise<AdminAnalytics> {
  if (!API_URL) {
    throw new Error(
      "API URL is not configured."
    );
  }

  const params = new URLSearchParams();

  if (
    filters.type &&
    filters.type !== "ALL"
  ) {
    params.set(
      "type",
      filters.type
    );
  }

  if (
    filters.town &&
    filters.town !== "ALL"
  ) {
    params.set(
      "town",
      filters.town
    );
  }

  if (
    filters.status &&
    filters.status !== "ALL"
  ) {
    params.set(
      "status",
      filters.status
    );
  }

  if (
    filters.period &&
    filters.period !== "all"
  ) {
    params.set(
      "period",
      filters.period
    );
  }

  const query = params.toString();

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

  return parseResponse(response);
}

/* =========================================================
   CITIZEN REPORTS
   ========================================================= */

export type CitizenReport = {
  reportId: string;

  incidentType: string;

  description: string;

  descriptionType?: ReportDescriptionType;

  audioKey?: string;

  audioContentType?: string;

  audioUrl?: string;

  town: string;

  quarter: string;

  status: string;

  createdAt: string;

  updatedAt?: string;

  resolvedAt?: string;

  evidenceCount: number;

  statusHistory: {
    status: string;
    timestamp: string;
    actor: string;
  }[];
};

export async function getMyReports(): Promise<{
  reports: CitizenReport[];
  count: number;
}> {
  if (!API_URL) {
    throw new Error(
      "API URL is not configured."
    );
  }

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
  if (!API_URL) {
    throw new Error(
      "API URL is not configured."
    );
  }

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

/* =========================================================
   ADMIN VOICE DESCRIPTION
   ========================================================= */

export async function getReportDescriptionAudioUrl(
  reportId: string
) {
  if (!API_URL) {
    throw new Error(
      "API URL is not configured."
    );
  }

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