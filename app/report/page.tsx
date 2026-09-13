"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "aws-amplify/auth";

import { configureAmplify } from "../../lib/amplify";
import {
  createReport,
  getUploadUrl,
  uploadEvidence,
} from "../../lib/api";

import SignOutButton from "../../components/SignOutButton";

const incidentTypes = [
  {
    value: "CHILD_ABUSE",
    label: "Child abuse",
    description: "Abuse or harm involving a child",
    critical: true,
  },
  {
    value: "FIGHT",
    label: "Fight / assault",
    description: "Physical violence or assault",
    critical: false,
  },
  {
    value: "THEFT",
    label: "Theft",
    description: "Property or belongings taken",
    critical: false,
  },
  {
    value: "OTHER",
    label: "Other incident",
    description: "Another incident requiring attention",
    critical: false,
  },
];

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const MAX_FILES = 10;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

type EvidenceFile = {
  id: string;
  file: File;
  previewUrl: string;
};

export default function ReportPage() {
  const router = useRouter();

  const [incidentType, setIncidentType] = useState("");
  const [description, setDescription] = useState("");
  const [town, setTown] = useState("");
  const [quarter, setQuarter] = useState("");

  const [evidenceFiles, setEvidenceFiles] = useState<
    EvidenceFile[]
  >([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reportId, setReportId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        configureAmplify();
        await getCurrentUser();
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  function validateFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(
        `${file.name}: unsupported file type.`
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `${file.name}: file is larger than 100 MB.`
      );
    }
  }

  function addFiles(files: FileList | File[]) {
    setError("");

    const incomingFiles = Array.from(files);

    if (
      evidenceFiles.length + incomingFiles.length >
      MAX_FILES
    ) {
      setError(
        `You can attach a maximum of ${MAX_FILES} evidence files.`
      );
      return;
    }

    try {
      const newEvidence = incomingFiles.map((file) => {
        validateFile(file);

        return {
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        };
      });

      setEvidenceFiles((current) => [
        ...current,
        ...newEvidence,
      ]);
    } catch (err: any) {
      setError(
        err?.message ||
          "One or more selected files are invalid."
      );
    }
  }

  function handleFileSelection(
    e: ChangeEvent<HTMLInputElement>
  ) {
    if (e.target.files) {
      addFiles(e.target.files);
    }

    e.target.value = "";
  }

  function removeFile(id: string) {
    setEvidenceFiles((current) => {
      const fileToRemove = current.find(
        (item) => item.id === id
      );

      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
      }

      return current.filter(
        (item) => item.id !== id
      );
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setError("");

    if (evidenceFiles.length === 0) {
      setError(
        "Please attach at least one photo or video as evidence."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      configureAmplify();

      let currentReportId: string | undefined;

      const uploadedEvidence: {
        key: string;
        contentType: string;
        mediaType: "image" | "video";
      }[] = [];

      for (let i = 0; i < evidenceFiles.length; i++) {
        const evidenceFile = evidenceFiles[i];

        const upload = await getUploadUrl(
          evidenceFile.file,
          currentReportId
        );

        if (!currentReportId) {
          currentReportId = upload.reportId;
        }

        await uploadEvidence(
          upload.uploadUrl,
          evidenceFile.file
        );

        uploadedEvidence.push({
          key:
            upload.evidenceKey ||
            upload.photoKey,
          contentType: upload.contentType,
          mediaType: upload.mediaType,
        });
      }

      if (!currentReportId) {
        throw new Error(
          "Could not create a report ID."
        );
      }

      await createReport({
        reportId: currentReportId,
        incidentType,
        description,
        evidence: uploadedEvidence,
        town,
        quarter,
      });

      setReportId(currentReportId);
      setSubmitted(true);
    } catch (err: any) {
      setError(
        err?.message ||
          "Could not submit report."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">

        <header className="border-b border-white/10 bg-slate-950/95">
          <div className="mx-auto flex max-w-6xl items-center px-5 py-5 sm:px-8">
            <Link
              href="/"
              className="flex items-center gap-3"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 font-black">
                S
              </span>

              <span className="font-bold">
                SOS<span className="text-red-500">-Kamer</span>
              </span>
            </Link>
          </div>
        </header>

        <section className="flex min-h-[calc(100vh-81px)] items-center justify-center px-5 py-12">

          <div className="w-full max-w-xl text-center">

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
              <span className="text-3xl font-bold text-emerald-400">
                ✓
              </span>
            </div>

            <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">
              Submission successful
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Your report has been received.
            </h1>

            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-slate-400">
              The incident information and evidence were
              submitted successfully to the SOS-Kamer response
              system.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left">

              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                Report reference
              </p>

              <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-200">
                {reportId}
              </p>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Keep this reference for your records.
              </p>

            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/reports"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-red-600 px-6 text-sm font-bold shadow-lg shadow-red-950/30 transition hover:bg-red-500"
              >
                View my reports
              </Link>

              <Link
                href="/"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-6 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08]"
              >
                Return home
              </Link>
            </div>

          </div>

        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">

      {/* HEADER */}

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">

        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">

          <Link
            href="/"
            className="flex items-center gap-3"
          >
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
              href="/"
              className="hidden rounded-lg px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:block"
            >
              ← Home
            </Link>

            <Link
              href="/reports"
              className="rounded-lg px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            >
              My reports
            </Link>

            <SignOutButton />

          </div>

        </div>

      </header>

      {/* PAGE */}

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">

        {/* INTRO */}

        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">

          <div>

            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-red-700">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Incident reporting
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Tell us what happened.
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Provide the incident details and supporting
              evidence below. Accurate information helps the
              response team understand what happened.
            </p>

          </div>

          <div className="hidden rounded-xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm lg:block">

            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Report status
            </p>

            <p className="mt-1 flex items-center justify-end gap-2 text-xs font-bold text-slate-700">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Ready to submit
            </p>

          </div>

        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">

            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-black text-red-700">
              !
            </span>

            <div>
              <p className="text-sm font-bold text-red-800">
                We need your attention
              </p>

              <p className="mt-1 text-xs leading-5 text-red-700">
                {error}
              </p>
            </div>

          </div>
        )}

        <form onSubmit={handleSubmit}>

          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">

            {/* MAIN FORM */}

            <div className="space-y-6">

              {/* INCIDENT */}

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                <div className="border-b border-slate-100 px-5 py-5 sm:px-6">

                  <div className="flex items-start gap-4">

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
                      01
                    </span>

                    <div>
                      <h2 className="text-sm font-bold text-slate-950">
                        What happened?
                      </h2>

                      <p className="mt-1 text-xs text-slate-500">
                        Select the incident type that best
                        describes the situation.
                      </p>
                    </div>

                  </div>

                </div>

                <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">

                  {incidentTypes.map((type) => {
                    const selected =
                      incidentType === type.value;

                    return (
                      <label
                        key={type.value}
                        className={`relative cursor-pointer rounded-xl border p-4 transition ${
                          selected
                            ? type.critical
                              ? "border-red-500 bg-red-50 ring-2 ring-red-100"
                              : "border-slate-950 bg-slate-50 ring-2 ring-slate-100"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >

                        <input
                          type="radio"
                          name="incidentType"
                          value={type.value}
                          checked={selected}
                          onChange={(e) =>
                            setIncidentType(
                              e.target.value
                            )
                          }
                          required
                          className="sr-only"
                        />

                        <div className="flex items-start justify-between gap-3">

                          <div>

                            <p
                              className={`text-sm font-bold ${
                                type.critical && selected
                                  ? "text-red-700"
                                  : "text-slate-800"
                              }`}
                            >
                              {type.label}
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {type.description}
                            </p>

                          </div>

                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? type.critical
                                  ? "border-red-500 bg-red-500"
                                  : "border-slate-950 bg-slate-950"
                                : "border-slate-300"
                            }`}
                          >
                            {selected && (
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            )}
                          </span>

                        </div>

                      </label>
                    );
                  })}

                </div>

              </section>

              {/* DESCRIPTION */}

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                <div className="border-b border-slate-100 px-5 py-5 sm:px-6">

                  <div className="flex items-start gap-4">

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
                      02
                    </span>

                    <div>
                      <h2 className="text-sm font-bold">
                        Describe the incident
                      </h2>

                      <p className="mt-1 text-xs text-slate-500">
                        Include the important facts: what happened,
                        when it happened, and anything else that
                        may help.
                      </p>
                    </div>

                  </div>

                </div>

                <div className="p-5 sm:p-6">

                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) =>
                      setDescription(e.target.value)
                    }
                    required
                    rows={7}
                    placeholder="Describe what you saw or what happened..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-500 focus:bg-white focus:ring-4 focus:ring-slate-100"
                  />

                  <p className="mt-2 text-[11px] text-slate-400">
                    Be factual and specific. Avoid assumptions
                    where possible.
                  </p>

                </div>

              </section>

              {/* LOCATION */}

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                <div className="border-b border-slate-100 px-5 py-5 sm:px-6">

                  <div className="flex items-start gap-4">

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
                      03
                    </span>

                    <div>
                      <h2 className="text-sm font-bold">
                        Where did it happen?
                      </h2>

                      <p className="mt-1 text-xs text-slate-500">
                        Give the town and neighborhood where
                        the incident occurred.
                      </p>
                    </div>

                  </div>

                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">

                  <div>
                    <label
                      htmlFor="town"
                      className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      Town / City
                    </label>

                    <input
                      id="town"
                      required
                      value={town}
                      onChange={(e) =>
                        setTown(e.target.value)
                      }
                      placeholder="e.g. Douala"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:bg-white focus:ring-4 focus:ring-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="quarter"
                      className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      Quarter / Neighborhood
                    </label>

                    <input
                      id="quarter"
                      required
                      value={quarter}
                      onChange={(e) =>
                        setQuarter(e.target.value)
                      }
                      placeholder="e.g. Bonanjo"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:bg-white focus:ring-4 focus:ring-slate-100"
                    />
                  </div>

                </div>

              </section>

              {/* EVIDENCE */}

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                <div className="border-b border-slate-100 px-5 py-5 sm:px-6">

                  <div className="flex items-start justify-between gap-4">

                    <div className="flex items-start gap-4">

                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
                        04
                      </span>

                      <div>
                        <h2 className="text-sm font-bold">
                          Add evidence
                        </h2>

                        <p className="mt-1 text-xs text-slate-500">
                          At least one photo or video is required.
                        </p>
                      </div>

                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                      {evidenceFiles.length}/{MAX_FILES}
                    </span>

                  </div>

                </div>

                <div className="p-5 sm:p-6">

                  <div className="grid gap-3 sm:grid-cols-3">

                    {/* FILES */}

                    <label className="group cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-slate-500 hover:bg-slate-100">

                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                        <span className="text-sm font-bold">
                          +
                        </span>
                      </div>

                      <p className="mt-3 text-xs font-bold text-slate-800">
                        Choose files
                      </p>

                      <p className="mt-1 text-[10px] text-slate-400">
                        Photos or videos
                      </p>

                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        onChange={handleFileSelection}
                        className="hidden"
                        disabled={
                          evidenceFiles.length >=
                          MAX_FILES
                        }
                      />

                    </label>

                    {/* PHOTO */}

                    <label className="group cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-slate-500 hover:bg-slate-100">

                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                        <span className="text-sm">
                          ◉
                        </span>
                      </div>

                      <p className="mt-3 text-xs font-bold text-slate-800">
                        Take a photo
                      </p>

                      <p className="mt-1 text-[10px] text-slate-400">
                        Use your camera
                      </p>

                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileSelection}
                        className="hidden"
                        disabled={
                          evidenceFiles.length >=
                          MAX_FILES
                        }
                      />

                    </label>

                    {/* VIDEO */}

                    <label className="group cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-slate-500 hover:bg-slate-100">

                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                        <span className="text-xs font-bold">
                          REC
                        </span>
                      </div>

                      <p className="mt-3 text-xs font-bold text-slate-800">
                        Record video
                      </p>

                      <p className="mt-1 text-[10px] text-slate-400">
                        Use your camera
                      </p>

                      <input
                        type="file"
                        accept="video/*"
                        capture="environment"
                        onChange={handleFileSelection}
                        className="hidden"
                        disabled={
                          evidenceFiles.length >=
                          MAX_FILES
                        }
                      />

                    </label>

                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
                    <span>Up to 10 files</span>
                    <span>•</span>
                    <span>100 MB maximum per file</span>
                    <span>•</span>
                    <span>Images & video supported</span>
                  </div>

                  {/* PREVIEWS */}

                  {evidenceFiles.length > 0 && (
                    <div className="mt-6">

                      <div className="mb-3 flex items-center justify-between">

                        <p className="text-xs font-bold text-slate-700">
                          Selected evidence
                        </p>

                        <p className="text-[10px] text-slate-400">
                          Review before submitting
                        </p>

                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">

                        {evidenceFiles.map(
                          (item, index) => (
                            <div
                              key={item.id}
                              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                            >

                              <div className="relative aspect-video bg-slate-900">

                                {item.file.type.startsWith(
                                  "video/"
                                ) ? (
                                  <video
                                    src={item.previewUrl}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <img
                                    src={item.previewUrl}
                                    alt={`Evidence ${index + 1}`}
                                    className="h-full w-full object-cover"
                                  />
                                )}

                                <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 text-[9px] font-bold text-white backdrop-blur">
                                  {index + 1}
                                </span>

                              </div>

                              <div className="flex items-center justify-between gap-3 p-3">

                                <div className="min-w-0">

                                  <p className="truncate text-xs font-semibold text-slate-700">
                                    {item.file.name}
                                  </p>

                                  <p className="mt-1 text-[10px] text-slate-400">
                                    {item.file.type.startsWith(
                                      "video/"
                                    )
                                      ? "Video"
                                      : "Image"}{" "}
                                    ·{" "}
                                    {(
                                      item.file.size /
                                      (1024 * 1024)
                                    ).toFixed(1)}{" "}
                                    MB
                                  </p>

                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    removeFile(item.id)
                                  }
                                  className="shrink-0 rounded-lg px-2.5 py-2 text-[10px] font-bold text-red-600 transition hover:bg-red-50"
                                >
                                  Remove
                                </button>

                              </div>

                            </div>
                          )
                        )}

                      </div>

                    </div>
                  )}

                </div>

              </section>

            </div>

            {/* SIDE REVIEW */}

            <aside className="lg:sticky lg:top-24 lg:h-fit">

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                <div className="border-b border-slate-100 p-5">

                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    Before you submit
                  </p>

                  <h2 className="mt-2 text-lg font-bold text-slate-950">
                    Review your report
                  </h2>

                </div>

                <div className="space-y-4 p-5">

                  <div className="flex items-start gap-3">

                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        incidentType
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {incidentType ? "✓" : "—"}
                    </span>

                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        Incident type
                      </p>

                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {incidentType
                          ? incidentTypes.find(
                              (item) =>
                                item.value ===
                                incidentType
                            )?.label
                          : "Not selected"}
                      </p>
                    </div>

                  </div>

                  <div className="flex items-start gap-3">

                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        description.trim()
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {description.trim()
                        ? "✓"
                        : "—"}
                    </span>

                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        Description
                      </p>

                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {description.trim()
                          ? "Information provided"
                          : "Not provided"}
                      </p>
                    </div>

                  </div>

                  <div className="flex items-start gap-3">

                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        town.trim() &&
                        quarter.trim()
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {town.trim() &&
                      quarter.trim()
                        ? "✓"
                        : "—"}
                    </span>

                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        Location
                      </p>

                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {town.trim() &&
                        quarter.trim()
                          ? `${town}, ${quarter}`
                          : "Not provided"}
                      </p>
                    </div>

                  </div>

                  <div className="flex items-start gap-3">

                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        evidenceFiles.length > 0
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {evidenceFiles.length > 0
                        ? "✓"
                        : "!"}
                    </span>

                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        Evidence
                      </p>

                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {evidenceFiles.length > 0
                          ? `${evidenceFiles.length} file${
                              evidenceFiles.length ===
                              1
                                ? ""
                                : "s"
                            } attached`
                          : "At least one file required"}
                      </p>
                    </div>

                  </div>

                </div>

                <div className="border-t border-slate-100 p-5">

                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">

                    <p className="text-[11px] font-semibold leading-5 text-amber-800">
                      Only submit genuine incidents. False
                      reports can delay assistance and affect
                      people who need help.
                    </p>

                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group flex h-13 w-full items-center justify-center gap-3 rounded-xl bg-red-600 px-5 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-white" />
                        Submitting report...
                      </>
                    ) : (
                      <>
                        Submit incident
                        <span className="transition-transform group-hover:translate-x-0.5">
                          →
                        </span>
                      </>
                    )}
                  </button>

                  <p className="mt-3 text-center text-[10px] leading-4 text-slate-400">
                    Your evidence will be securely uploaded before
                    the report is submitted.
                  </p>

                </div>

              </div>

            </aside>

          </div>

        </form>

        <footer className="py-8 text-center">

          <p className="text-[10px] text-slate-400">
            SOS-Kamer · Citizen Incident Reporting
          </p>

        </footer>

      </div>

    </main>
  );
}