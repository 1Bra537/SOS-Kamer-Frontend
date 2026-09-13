import { fetchAuthSession } from "aws-amplify/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  console.warn("NEXT_PUBLIC_API_URL is not configured.");
}

async function authHeaders() {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return {
    Authorization: token,
    "Content-Type": "application/json",
  };
}

async function parseResponse(response: Response) {
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text }; }
  if (!response.ok) {
    throw new Error(body?.error || body?.message || `Request failed (${response.status})`);
  }
  return body;
}

export async function getUploadUrl(
  file: File,
  reportId?: string
) {
  if (!API_URL) {
    throw new Error("API URL is not configured.");
  }

  const response = await fetch(`${API_URL}/uploads/presign`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      ...(reportId ? { reportId } : {}),
    }),
  });

  return parseResponse(response);
}


export async function uploadEvidence(
  uploadUrl: string,
  file: File
) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(
      "Evidence upload failed. Please try again."
    );
  }
}


export async function createReport(payload: {
  reportId: string;
  incidentType: string;
  description: string;
  evidence: {
    key: string;
    contentType: string;
    mediaType: "image" | "video";
  }[];
  town: string;
  quarter: string;
}) {
  if (!API_URL) {
    throw new Error("API URL is not configured.");
  }

  const response = await fetch(`${API_URL}/reports`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function getAdminReports() {
  if (!API_URL) throw new Error("API URL is not configured.");

  const response = await fetch(`${API_URL}/admin/reports`, {
    method: "GET",
    headers: await authHeaders(),
  });

  return parseResponse(response);
}

export async function getAdminNotifications() {
  if (!API_URL) throw new Error("API URL is not configured.");

  const response = await fetch(`${API_URL}/admin/notifications`, {
    method: "GET",
    headers: await authHeaders(),
  });

  return parseResponse(response);
}

export async function acknowledgeNotification(
  notificationId: string
) {
  if (!API_URL) throw new Error("API URL is not configured.");

  const response = await fetch(
    `${API_URL}/admin/notifications/${notificationId}`,
    {
      method: "PATCH",
      headers: await authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function resolveReport(reportId: string) {
  if (!API_URL) throw new Error("API URL is not configured.");

  const response = await fetch(
    `${API_URL}/admin/reports/${reportId}`,
    {
      method: "PATCH",
      headers: await authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function getEvidenceUrl(reportId: string) {
  if (!API_URL) {
    throw new Error("API URL is not configured.");
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

export type CitizenReport = {
  reportId: string;
  incidentType: string;
  description: string;
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
  if (!API_URL) throw new Error("API URL is not configured.");

  const response = await fetch(`${API_URL}/reports/my`, {
    method: "GET",
    headers: await authHeaders(),
    cache: "no-store",
  });

  return parseResponse(response);
}

export async function getMyReport(
  reportId: string
): Promise<{ report: CitizenReport }> {
  if (!API_URL) throw new Error("API URL is not configured.");

  const response = await fetch(
    `${API_URL}/reports/my/${encodeURIComponent(reportId)}`,
    {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
    }
  );

  return parseResponse(response);
}
