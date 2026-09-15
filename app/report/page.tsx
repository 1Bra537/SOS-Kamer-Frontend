"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
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

const VOICE_ALLOWED_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
];

const MAX_FILES = 10;
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_VOICE_SIZE = 25 * 1024 * 1024;

type EvidenceFile = {
  id: string;
  file: File;
  previewUrl: string;
};

type DescriptionType = "TEXT" | "VOICE";

export default function ReportPage() {
  const router = useRouter();

  const [incidentType, setIncidentType] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionType, setDescriptionType] =
    useState<DescriptionType>("TEXT");

  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparingVoice, setIsPreparingVoice] = useState(false);

  const [town, setTown] = useState("");
  const [quarter, setQuarter] = useState("");

  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>(
    []
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reportId, setReportId] = useState("");
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);

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

  useEffect(() => {
    return () => {
      if (voicePreviewUrl) {
        URL.revokeObjectURL(voicePreviewUrl);
      }

      evidenceFiles.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, [voicePreviewUrl, evidenceFiles]);

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

  function clearVoiceRecording() {
    if (voicePreviewUrl) {
      URL.revokeObjectURL(voicePreviewUrl);
    }

    setVoicePreviewUrl("");
    setVoiceFile(null);
  }

  function getSupportedRecordingMimeType() {
    if (
      typeof MediaRecorder === "undefined"
    ) {
      return "";
    }

    const supportedTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
    ];

    return (
      supportedTypes.find((type) =>
        MediaRecorder.isTypeSupported(type)
      ) || ""
    );
  }

  async function startVoiceRecording() {
    setError("");
    setIsPreparingVoice(true);

    try {
      if (
        typeof window === "undefined" ||
        typeof navigator === "undefined"
      ) {
        throw new Error(
          "Voice recording is not available in this environment."
        );
      }

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          "Your browser does not support microphone recording."
        );
      }

      if (typeof MediaRecorder === "undefined") {
        throw new Error(
          "Your browser does not support voice recording."
        );
      }

      clearVoiceRecording();

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      mediaStreamRef.current = stream;
      voiceChunksRef.current = [];

      const mimeType =
        getSupportedRecordingMimeType();

      const recorder = mimeType
        ? new MediaRecorder(stream, {
            mimeType,
          })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError(
          "Something went wrong while recording the voice message."
        );

        setIsRecording(false);

        if (mediaStreamRef.current) {
          mediaStreamRef.current
            .getTracks()
            .forEach((track) => track.stop());
        }
      };

      recorder.onstop = () => {
        const actualMimeType =
          recorder.mimeType ||
          mimeType ||
          "audio/webm";

        const blob = new Blob(
          voiceChunksRef.current,
          {
            type: actualMimeType,
          }
        );

        if (blob.size === 0) {
          setError(
            "No audio was recorded. Please try again."
          );
        } else if (blob.size > MAX_VOICE_SIZE) {
          setError(
            "The voice message is larger than 25 MB. Please record a shorter message."
          );
        } else {
          const extension =
            actualMimeType.includes("ogg")
              ? "ogg"
              : actualMimeType.includes("mp4")
              ? "mp4"
              : "webm";

          const file = new File(
            [blob],
            `voice-description-${Date.now()}.${extension}`,
            {
              type: actualMimeType,
            }
          );

          if (voicePreviewUrl) {
            URL.revokeObjectURL(voicePreviewUrl);
          }

          const previewUrl =
            URL.createObjectURL(blob);

          setVoiceFile(file);
          setVoicePreviewUrl(previewUrl);
        }

        voiceChunksRef.current = [];

        if (mediaStreamRef.current) {
          mediaStreamRef.current
            .getTracks()
            .forEach((track) => track.stop());

          mediaStreamRef.current = null;
        }

        mediaRecorderRef.current = null;
        setIsRecording(false);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      if (mediaStreamRef.current) {
        mediaStreamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        mediaStreamRef.current = null;
      }

      setError(
        err?.name === "NotAllowedError"
          ? "Microphone access was denied. Please allow microphone access and try again."
          : err?.message ||
              "Could not start voice recording."
      );

      setIsRecording(false);
    } finally {
      setIsPreparingVoice(false);
    }
  }

  function stopVoiceRecording() {
    const recorder = mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  function handleDescriptionTypeChange(
    type: DescriptionType
  ) {
    setError("");
    setDescriptionType(type);

    if (type === "TEXT") {
      if (isRecording) {
        stopVoiceRecording();
      }

      clearVoiceRecording();
    } else {
      setDescription("");
    }
  }

  function handleVoiceInput(
    e: ChangeEvent<HTMLInputElement>
  ) {
    setError("");

    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!VOICE_ALLOWED_TYPES.includes(file.type)) {
      setError(
        "Unsupported audio format. Please choose a WebM, OGG, MP4, MP3, or WAV audio file."
      );
      e.target.value = "";
      return;
    }

    if (file.size > MAX_VOICE_SIZE) {
      setError(
        "The voice message is larger than 25 MB."
      );
      e.target.value = "";
      return;
    }

    if (voicePreviewUrl) {
      URL.revokeObjectURL(voicePreviewUrl);
    }

    setVoiceFile(file);
    setVoicePreviewUrl(
      URL.createObjectURL(file)
    );
    setDescriptionType("VOICE");

    e.target.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setError("");

    if (!incidentType) {
      setError(
        "Please select an incident type."
      );
      return;
    }

    if (descriptionType === "TEXT") {
      if (!description.trim()) {
        setError(
          "Please provide a description of the incident."
        );
        return;
      }
    }

    if (descriptionType === "VOICE") {
      if (!voiceFile) {
        setError(
          "Please record or upload a voice description."
        );
        return;
      }
    }

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

      /*
       * Upload evidence first.
       *
       * The existing backend creates/returns the report ID
       * through the first presigned upload request.
       */
      for (
        let i = 0;
        i < evidenceFiles.length;
        i++
      ) {
        const evidenceFile =
          evidenceFiles[i];

        const upload = await getUploadUrl(
          evidenceFile.file,
          currentReportId
        );

        if (!currentReportId) {
          currentReportId =
            upload.reportId;
        }

        await uploadEvidence(
          upload.uploadUrl,
          evidenceFile.file
        );

        uploadedEvidence.push({
          key:
            upload.evidenceKey ||
            upload.photoKey,
          contentType:
            upload.contentType,
          mediaType:
            upload.mediaType,
        });
      }

      if (!currentReportId) {
        throw new Error(
          "Could not create a report ID."
        );
      }

      /*
       * Voice description.
       *
       * The backend has been updated to accept
       * uploadType = "voice".
       *
       * lib/api.ts will be updated next so that
       * getUploadUrl() accepts the third argument.
       */
      let uploadedVoiceKey:
        | string
        | undefined;

      let uploadedVoiceContentType:
        | string
        | undefined;

      if (
        descriptionType === "VOICE" &&
        voiceFile
      ) {
        const voiceUpload =
          await getUploadUrl(
            voiceFile,
            currentReportId,
            "voice"
          );

        await uploadEvidence(
          voiceUpload.uploadUrl,
          voiceFile,
          voiceUpload.contentType
        );

        uploadedVoiceKey =
          voiceUpload.voiceKey ||
          voiceUpload.audioKey;

        uploadedVoiceContentType =
          voiceUpload.contentType ||
          voiceFile.type;

        if (!uploadedVoiceKey) {
          throw new Error(
            "The voice upload completed, but no audio key was returned."
          );
        }
      }

      await createReport({
        reportId: currentReportId,
        incidentType,

        description:
          descriptionType === "TEXT"
            ? description.trim()
            : "",

        descriptionType,

        ...(descriptionType === "VOICE" &&
        uploadedVoiceKey
          ? {
              audioKey:
                uploadedVoiceKey,
              audioContentType:
                uploadedVoiceContentType ||
                voiceFile?.type ||
                "audio/webm",
            }
          : {}),

        evidence: uploadedEvidence,

        town: town.trim(),
        quarter: quarter.trim(),
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
                SOS
                <span className="text-red-500">
                  -Kamer
                </span>
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
              The incident information and
              evidence were submitted successfully
              to the SOS-Kamer response system.
            </p>

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
                SOS
                <span className="text-red-600">
                  -Kamer
                </span>
              </p>

              <p className="hidden text-[10px] font-medium text-slate-400 sm:block">
                Citizen Reporting
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
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
              Provide the incident details and
              supporting evidence below. Accurate
              information helps the response team
              understand what happened.
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
                        Select the incident type that
                        best describes the situation.
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
                                type.critical &&
                                selected
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
                        Describe what happened using
                        text or a voice message.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  {/* DESCRIPTION TYPE SELECTOR */}

                  <div className="mb-5 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleDescriptionTypeChange(
                          "TEXT"
                        )
                      }
                      className={`rounded-xl border p-4 text-left transition ${
                        descriptionType === "TEXT"
                          ? "border-slate-950 bg-slate-50 ring-2 ring-slate-100"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            Text message
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Type a description of what
                            happened.
                          </p>
                        </div>

                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            descriptionType ===
                            "TEXT"
                              ? "border-slate-950 bg-slate-950"
                              : "border-slate-300"
                          }`}
                        >
                          {descriptionType ===
                            "TEXT" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDescriptionTypeChange(
                          "VOICE"
                        )
                      }
                      className={`rounded-xl border p-4 text-left transition ${
                        descriptionType === "VOICE"
                          ? "border-red-500 bg-red-50 ring-2 ring-red-100"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            Voice message
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Record or select an audio
                            description.
                          </p>
                        </div>

                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            descriptionType ===
                            "VOICE"
                              ? "border-red-500 bg-red-500"
                              : "border-slate-300"
                          }`}
                        >
                          {descriptionType ===
                            "VOICE" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* TEXT DESCRIPTION */}

                  {descriptionType === "TEXT" && (
                    <>
                      <textarea
                        id="description"
                        value={description}
                        onChange={(e) =>
                          setDescription(
                            e.target.value
                          )
                        }
                        required
                        rows={7}
                        placeholder="Describe what you saw or what happened..."
                        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-500 focus:bg-white focus:ring-4 focus:ring-slate-100"
                      />

                      <p className="mt-2 text-[11px] text-slate-400">
                        Be factual and specific. Avoid
                        assumptions where possible.
                      </p>
                    </>
                  )}

                  {/* VOICE DESCRIPTION */}

                  {descriptionType ===
                    "VOICE" && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-bold text-slate-700">
                          Record your description
                        </p>

                        <p className="mt-1 text-[11px] leading-5 text-slate-400">
                          Speak clearly and describe
                          what happened, when it
                          happened, and anything
                          important for the response
                          team.
                        </p>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                          {!isRecording ? (
                            <button
                              type="button"
                              onClick={
                                startVoiceRecording
                              }
                              disabled={
                                isPreparingVoice ||
                                isSubmitting
                              }
                              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isPreparingVoice ? (
                                <>
                                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-white" />
                                  Starting microphone...
                                </>
                              ) : (
                                <>
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[8px]">
                                    ●
                                  </span>
                                  {voiceFile
                                    ? "Record again"
                                    : "Start recording"}
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={
                                stopVoiceRecording
                              }
                              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800"
                            >
                              <span className="h-3 w-3 rounded-sm bg-red-500" />
                              Stop recording
                            </button>
                          )}

                          <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                            Choose audio file

                            <input
                              type="file"
                              accept="audio/webm,audio/ogg,audio/mp4,audio/mpeg,audio/wav"
                              onChange={
                                handleVoiceInput
                              }
                              className="hidden"
                              disabled={
                                isRecording ||
                                isSubmitting
                              }
                            />
                          </label>
                        </div>

                        {isRecording && (
                          <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                            <span className="relative flex h-3 w-3">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
                            </span>

                            <div>
                              <p className="text-xs font-bold text-red-800">
                                Recording in progress
                              </p>

                              <p className="mt-0.5 text-[10px] text-red-600">
                                Speak clearly, then press
                                Stop recording.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {voiceFile && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-emerald-800">
                                Voice description ready
                              </p>

                              <p className="mt-1 truncate text-[10px] text-emerald-700">
                                {voiceFile.name}
                              </p>

                              <p className="mt-1 text-[10px] text-emerald-600">
                                {(
                                  voiceFile.size /
                                  (1024 * 1024)
                                ).toFixed(2)}{" "}
                                MB
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={
                                clearVoiceRecording
                              }
                              disabled={
                                isRecording ||
                                isSubmitting
                              }
                              className="shrink-0 rounded-lg px-2.5 py-2 text-[10px] font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>

                          {voicePreviewUrl && (
                            <audio
                              className="mt-4 w-full"
                              controls
                              preload="metadata"
                              src={
                                voicePreviewUrl
                              }
                            />
                          )}
                        </div>
                      )}

                      <p className="text-[11px] text-slate-400">
                        Supported audio formats: WebM,
                        OGG, MP4, MP3, and WAV. Maximum
                        size: 25 MB.
                      </p>
                    </div>
                  )}
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
                        Give the town and neighborhood
                        where the incident occurred.
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
                          At least one photo or video is
                          required.
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                      {evidenceFiles.length}/
                      {MAX_FILES}
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
                        onChange={
                          handleFileSelection
                        }
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
                        onChange={
                          handleFileSelection
                        }
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
                        onChange={
                          handleFileSelection
                        }
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
                    <span>
                      100 MB maximum per file
                    </span>
                    <span>•</span>
                    <span>
                      Images & video supported
                    </span>
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
                                    src={
                                      item.previewUrl
                                    }
                                    controls
                                    playsInline
                                    preload="metadata"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <img
                                    src={
                                      item.previewUrl
                                    }
                                    alt={`Evidence ${
                                      index + 1
                                    }`}
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
                                      item.file
                                        .size /
                                      (1024 * 1024)
                                    ).toFixed(1)}{" "}
                                    MB
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    removeFile(
                                      item.id
                                    )
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
                  {/* INCIDENT TYPE */}

                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        incidentType
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {incidentType
                        ? "✓"
                        : "—"}
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

                  {/* DESCRIPTION */}

                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        descriptionType ===
                        "VOICE"
                          ? voiceFile
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-400"
                          : description.trim()
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {descriptionType ===
                      "VOICE"
                        ? voiceFile
                          ? "✓"
                          : "—"
                        : description.trim()
                        ? "✓"
                        : "—"}
                    </span>

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700">
                        Description
                      </p>

                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {descriptionType ===
                        "VOICE"
                          ? voiceFile
                            ? "Voice message ready"
                            : "Voice message not provided"
                          : description.trim()
                          ? "Text description provided"
                          : "Text description not provided"}
                      </p>
                    </div>
                  </div>

                  {/* LOCATION */}

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

                  {/* EVIDENCE */}

                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        evidenceFiles.length >
                        0
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {evidenceFiles.length >
                      0
                        ? "✓"
                        : "!"}
                    </span>

                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        Evidence
                      </p>

                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {evidenceFiles.length >
                        0
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
                      Only submit genuine incidents.
                      False reports can delay
                      assistance and affect people who
                      need help.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      isRecording ||
                      isPreparingVoice
                    }
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
                    Your evidence and voice
                    description, if provided, will be
                    securely uploaded before the report
                    is submitted.
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