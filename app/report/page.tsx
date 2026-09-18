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
  createAnonymousReport,
  createReport,
  getAnonymousUploadUrl,
  getUploadUrl,
  uploadEvidence,
} from "../../lib/api";

import SignOutButton from "../../components/SignOutButton";

// =========================================================
// CONSTANTS
// =========================================================

const incidentTypes = [
  {
    value: "CHILD_ABUSE",
    label: "Child abuse",
    description:
      "Abuse or harm involving a child",
    critical: true,
  },
  {
    value: "FIGHT",
    label: "Fight / assault",
    description:
      "Physical violence or assault",
    critical: false,
  },
  {
    value: "THEFT",
    label: "Theft",
    description:
      "Property or belongings taken",
    critical: false,
  },
  {
    value: "OTHER",
    label: "Other incident",
    description:
      "Another incident requiring attention",
    critical: false,
  },
];

const ALLOWED_EVIDENCE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const MAX_FILES = 10;

const MAX_FILE_SIZE =
  100 * 1024 * 1024;

type EvidenceFile = {
  id: string;
  file: File;
  previewUrl: string;
};

type DescriptionType =
  | "TEXT"
  | "VOICE";

type ReportMode =
  | "AUTHENTICATED"
  | "ANONYMOUS";

type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};

// =========================================================
// COMPONENT
// =========================================================

export default function ReportPage() {
  const router = useRouter();

  // -------------------------------------------------------
  // Authentication / report mode
  // -------------------------------------------------------

  const [
    isAuthenticated,
    setIsAuthenticated,
  ] = useState(false);

  const [
    authChecked,
    setAuthChecked,
  ] = useState(false);

  const [
    reportMode,
    setReportMode,
  ] = useState<ReportMode>(
    "ANONYMOUS"
  );

  // -------------------------------------------------------
  // Report state
  // -------------------------------------------------------

  const [
    incidentType,
    setIncidentType,
  ] = useState("");

  const [
    descriptionType,
    setDescriptionType,
  ] = useState<DescriptionType>(
    "TEXT"
  );

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    town,
    setTown,
  ] = useState("");

  const [
    quarter,
    setQuarter,
  ] = useState("");

  // -------------------------------------------------------
  // Automatic device location
  // -------------------------------------------------------

  const [
    deviceLocation,
    setDeviceLocation,
  ] = useState<DeviceLocation | null>(
    null
  );

  const [
    locationLoading,
    setLocationLoading,
  ] = useState(true);

  const [
    locationError,
    setLocationError,
  ] = useState("");

  const locationWatchIdRef =
    useRef<number | null>(null);

  const latestLocationRef =
    useRef<DeviceLocation | null>(null);

  // -------------------------------------------------------
  // Evidence
  // -------------------------------------------------------

  const [
    evidenceFiles,
    setEvidenceFiles,
  ] = useState<EvidenceFile[]>(
    []
  );

  // -------------------------------------------------------
  // Voice recording
  // -------------------------------------------------------

  const [
    voiceFile,
    setVoiceFile,
  ] = useState<File | null>(null);

  const [
    voicePreviewUrl,
    setVoicePreviewUrl,
  ] = useState("");

  const [
    isRecording,
    setIsRecording,
  ] = useState(false);

  const [
    recordingSeconds,
    setRecordingSeconds,
  ] = useState(0);

  const mediaRecorderRef =
    useRef<MediaRecorder | null>(
      null
    );

  const mediaStreamRef =
    useRef<MediaStream | null>(
      null
    );

  const recordingChunksRef =
    useRef<Blob[]>([]);

  const recordingTimerRef =
    useRef<ReturnType<
      typeof setInterval
    > | null>(null);

  // -------------------------------------------------------
  // Submission
  // -------------------------------------------------------

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    submitted,
    setSubmitted,
  ] = useState(false);

  const [
    reportId,
    setReportId,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  // =======================================================
  // AUTHENTICATION CHECK
  // =======================================================

  useEffect(() => {
    async function checkAuthentication() {
      try {
        configureAmplify();

        await getCurrentUser();

        setIsAuthenticated(true);

        // Existing signed-in users default to
        // their normal authenticated reporting mode.
        setReportMode(
          "AUTHENTICATED"
        );
      } catch {
        // Not signed in is perfectly valid now.
        // Anonymous reporting is available.
        setIsAuthenticated(false);
        setReportMode("ANONYMOUS");
      } finally {
        setAuthChecked(true);
      }
    }

    checkAuthentication();
  }, []);

  // =======================================================
  // AUTOMATIC DEVICE LOCATION
  // =======================================================

  function getLocationErrorMessage(
    error: GeolocationPositionError
  ) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return "Location access was denied. Please enable location permission in your browser.";

      case error.POSITION_UNAVAILABLE:
        return "Your device location is currently unavailable. Please try again.";

      case error.TIMEOUT:
        return "Location detection timed out. Please try again.";

      default:
        return "Unable to determine your current location.";
    }
  }

  function applyLocation(
    position: GeolocationPosition
  ) {
    const nextLocation: DeviceLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      capturedAt: new Date(
        position.timestamp
      ).toISOString(),
    };

    latestLocationRef.current =
      nextLocation;

    setDeviceLocation(
      nextLocation
    );

    setLocationError("");
    setLocationLoading(false);
  }

async function requestFreshLocation(): Promise<DeviceLocation> {
  if (!navigator.geolocation) {
    const message =
      "Location services are not supported by this browser.";

    setLocationLoading(false);
    setLocationError(message);

    throw new Error(message);
  }

  setLocationLoading(true);
  setLocationError("");

  const latestLocation =
    latestLocationRef.current;

  // -------------------------------------------------------
  // Use a very recent location already captured by
  // watchPosition().
  // -------------------------------------------------------

  if (latestLocation) {
    const capturedTime = new Date(
      latestLocation.capturedAt
    ).getTime();

    const age =
      Date.now() - capturedTime;

    if (
      Number.isFinite(age) &&
      age >= 0 &&
      age <= 30_000
    ) {
      setDeviceLocation(
        latestLocation
      );

      setLocationLoading(false);
      setLocationError("");

      return latestLocation;
    }
  }

  // -------------------------------------------------------
  // Helper for getCurrentPosition()
  // -------------------------------------------------------

  const getPosition = (
    options: PositionOptions
  ): Promise<GeolocationPosition> => {
    return new Promise(
      (resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          options
        );
      }
    );
  };

  // -------------------------------------------------------
  // First attempt:
  // Normal accuracy / faster browser location lookup.
  // This is more reliable on laptops and desktops.
  // -------------------------------------------------------

  try {
    const position =
      await getPosition({
        enableHighAccuracy: false,
        maximumAge: 15_000,
        timeout: 20_000,
      });

    const nextLocation: DeviceLocation = {
      latitude:
        position.coords.latitude,

      longitude:
        position.coords.longitude,

      accuracy:
        position.coords.accuracy,

      capturedAt:
        new Date(
          position.timestamp
        ).toISOString(),
    };

    latestLocationRef.current =
      nextLocation;

    setDeviceLocation(
      nextLocation
    );

    setLocationLoading(false);
    setLocationError("");

    return nextLocation;
  } catch (normalAccuracyError) {
    console.warn(
      "Normal-accuracy location lookup failed:",
      normalAccuracyError
    );
  }

  // -------------------------------------------------------
  // Second attempt:
  // High accuracy for devices that can provide GPS.
  // -------------------------------------------------------

  try {
    const position =
      await getPosition({
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 20_000,
      });

    const nextLocation: DeviceLocation = {
      latitude:
        position.coords.latitude,

      longitude:
        position.coords.longitude,

      accuracy:
        position.coords.accuracy,

      capturedAt:
        new Date(
          position.timestamp
        ).toISOString(),
    };

    latestLocationRef.current =
      nextLocation;

    setDeviceLocation(
      nextLocation
    );

    setLocationLoading(false);
    setLocationError("");

    return nextLocation;
  } catch (highAccuracyError) {
    console.warn(
      "High-accuracy location lookup failed:",
      highAccuracyError
    );
  }

  // -------------------------------------------------------
  // Final fallback:
  // Use the most recent watcher position when it is
  // reasonably recent.
  // -------------------------------------------------------

  const fallbackLocation =
    latestLocationRef.current;

  if (fallbackLocation) {
    const capturedTime =
      new Date(
        fallbackLocation.capturedAt
      ).getTime();

    const age =
      Date.now() - capturedTime;

    if (
      Number.isFinite(age) &&
      age >= 0 &&
      age <= 120_000
    ) {
      setDeviceLocation(
        fallbackLocation
      );

      setLocationLoading(false);
      setLocationError("");

      return fallbackLocation;
    }
  }

  // -------------------------------------------------------
  // Nothing usable was available.
  // -------------------------------------------------------

  const message =
    "We could not determine your current device location. Please enable location services and try again.";

  setLocationLoading(false);
  setLocationError(message);

  throw new Error(message);
}

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      setLocationLoading(false);
      setLocationError(
        "Location services are not supported by this browser."
      );

      return;
    }

    setLocationLoading(true);

   locationWatchIdRef.current =
  navigator.geolocation.watchPosition(
    applyLocation,
    (error) => {
      console.warn(
        "Location watcher error:",
        error
      );

      // Do not destroy an already valid location
      // just because a later watcher attempt failed.
      if (!latestLocationRef.current) {
        setLocationLoading(false);
        setLocationError(
          getLocationErrorMessage(
            error
          )
        );
      }
    },
    {
      enableHighAccuracy: false,
      maximumAge: 10_000,
      timeout: 30_000,
    }
  );

    return () => {
      if (
        locationWatchIdRef.current !==
        null
      ) {
        navigator.geolocation.clearWatch(
          locationWatchIdRef.current
        );

        locationWatchIdRef.current =
          null;
      }
    };
  }, []);

  // =======================================================
  // CLEANUP
  // =======================================================

  useEffect(() => {
    return () => {
      evidenceFiles.forEach(
        (item) => {
          URL.revokeObjectURL(
            item.previewUrl
          );
        }
      );

      if (voicePreviewUrl) {
        URL.revokeObjectURL(
          voicePreviewUrl
        );
      }

      if (
        recordingTimerRef.current
      ) {
        clearInterval(
          recordingTimerRef.current
        );
      }

      mediaStreamRef.current
        ?.getTracks()
        .forEach((track) =>
          track.stop()
        );
    };
  }, []);

  // =======================================================
  // EVIDENCE VALIDATION
  // =======================================================

  function validateEvidenceFile(
    file: File
  ) {
    if (
      !ALLOWED_EVIDENCE_TYPES.includes(
        file.type
      )
    ) {
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

  // =======================================================
  // ADD EVIDENCE
  // =======================================================

  function addFiles(
    files: FileList | File[]
  ) {
    setError("");

    const incomingFiles =
      Array.from(files);

    if (
      evidenceFiles.length +
        incomingFiles.length >
      MAX_FILES
    ) {
      setError(
        `You can attach a maximum of ${MAX_FILES} evidence files.`
      );

      return;
    }

    try {
      const newEvidence =
        incomingFiles.map(
          (file) => {
            validateEvidenceFile(
              file
            );

            return {
              id: crypto.randomUUID(),
              file,
              previewUrl:
                URL.createObjectURL(
                  file
                ),
            };
          }
        );

      setEvidenceFiles(
        (current) => [
          ...current,
          ...newEvidence,
        ]
      );
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

  // =======================================================
  // REMOVE EVIDENCE
  // =======================================================

  function removeFile(
    id: string
  ) {
    setEvidenceFiles(
      (current) => {
        const fileToRemove =
          current.find(
            (item) =>
              item.id === id
          );

        if (fileToRemove) {
          URL.revokeObjectURL(
            fileToRemove.previewUrl
          );
        }

        return current.filter(
          (item) =>
            item.id !== id
        );
      }
    );
  }

  // =======================================================
  // VOICE MIME TYPE
  // =======================================================

  function getSupportedRecordingMimeType() {
    if (
      typeof MediaRecorder ===
      "undefined"
    ) {
      return "";
    }

    const mimeTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
    ];

    for (const mimeType of mimeTypes) {
      if (
        MediaRecorder.isTypeSupported(
          mimeType
        )
      ) {
        return mimeType;
      }
    }

    return "";
  }

  // =======================================================
  // START VOICE RECORDING
  // =======================================================

  async function startVoiceRecording() {
    setError("");

    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    if (
      typeof MediaRecorder ===
      "undefined"
    ) {
      setError(
        "Voice recording is not supported by this browser."
      );

      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true,
          }
        );

      const mimeType =
        getSupportedRecordingMimeType();

      const recorder =
        mimeType
          ? new MediaRecorder(
              stream,
              {
                mimeType,
              }
            )
          : new MediaRecorder(
              stream
            );

      recordingChunksRef.current =
        [];

      mediaStreamRef.current =
        stream;

      mediaRecorderRef.current =
        recorder;

      recorder.ondataavailable = (
        event
      ) => {
        if (
          event.data &&
          event.data.size > 0
        ) {
          recordingChunksRef.current.push(
            event.data
          );
        }
      };

      recorder.onstop = () => {
        const actualMimeType =
          recorder.mimeType ||
          mimeType ||
          "audio/webm";

        const blob =
          new Blob(
            recordingChunksRef.current,
            {
              type: actualMimeType,
            }
          );

        const extension =
          actualMimeType.includes(
            "ogg"
          )
            ? "ogg"
            : actualMimeType.includes(
                "mp4"
              )
              ? "mp4"
              : "webm";

        const file =
          new File(
            [blob],
            `voice-description-${Date.now()}.${extension}`,
            {
              type: actualMimeType,
            }
          );

        if (
          voicePreviewUrl
        ) {
          URL.revokeObjectURL(
            voicePreviewUrl
          );
        }

        const previewUrl =
          URL.createObjectURL(
            blob
          );

        setVoiceFile(file);
        setVoicePreviewUrl(
          previewUrl
        );

        setIsRecording(false);

        if (
          recordingTimerRef.current
        ) {
          clearInterval(
            recordingTimerRef.current
          );

          recordingTimerRef.current =
            null;
        }

        stream
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );

        mediaStreamRef.current =
          null;
      };

      recorder.start();

      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current =
        setInterval(() => {
          setRecordingSeconds(
            (current) =>
              current + 1
          );
        }, 1000);
    } catch (err: any) {
      console.error(err);

      setError(
        "Microphone access was not granted. Please allow microphone access and try again."
      );
    }
  }

  // =======================================================
  // STOP VOICE RECORDING
  // =======================================================

  function stopVoiceRecording() {
    const recorder =
      mediaRecorderRef.current;

    if (
      recorder &&
      recorder.state !==
        "inactive"
    ) {
      recorder.stop();
    }
  }

  // =======================================================
  // REMOVE VOICE
  // =======================================================

  function removeVoiceRecording() {
    if (voicePreviewUrl) {
      URL.revokeObjectURL(
        voicePreviewUrl
      );
    }

    setVoiceFile(null);
    setVoicePreviewUrl("");
    setRecordingSeconds(0);
  }

  // =======================================================
  // FORMAT RECORDING TIME
  // =======================================================

  function formatRecordingTime(
    seconds: number
  ) {
    const minutes =
      Math.floor(seconds / 60);

    const remaining =
      seconds % 60;

    return `${String(
      minutes
    ).padStart(2, "0")}:${String(
      remaining
    ).padStart(2, "0")}`;
  }

  // =======================================================
  // DESCRIPTION VALIDATION
  // =======================================================

  function validateDescription() {
    if (
      descriptionType ===
      "TEXT"
    ) {
      if (
        !description.trim()
      ) {
        return "Please describe the incident.";
      }

      return "";
    }

    if (
      descriptionType ===
      "VOICE"
    ) {
      if (!voiceFile) {
        return "Please record a voice description.";
      }

      return "";
    }

    return "";
  }

  // =======================================================
  // SUBMIT REPORT
  // =======================================================

  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    setError("");

    if (!incidentType) {
      setError(
        "Please select the incident type."
      );

      return;
    }

    const descriptionError =
      validateDescription();

    if (descriptionError) {
      setError(
        descriptionError
      );

      return;
    }

    if (!town.trim()) {
      setError(
        "Please provide the town or city."
      );

      return;
    }

    if (!quarter.trim()) {
      setError(
        "Please provide the quarter or neighborhood."
      );

      return;
    }

    if (
      evidenceFiles.length ===
      0
    ) {
      setError(
        "Please attach at least one photo or video as evidence."
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const submissionLocation =
        await requestFreshLocation();

      if (
        reportMode ===
        "AUTHENTICATED"
      ) {
        configureAmplify();
      }

      let currentReportId:
        | string
        | undefined;

      const uploadedEvidence: {
        key: string;
        contentType: string;
        mediaType:
          | "image"
          | "video";
      }[] = [];

      // ---------------------------------------------------
      // Upload evidence
      // ---------------------------------------------------

      for (
        let i = 0;
        i < evidenceFiles.length;
        i++
      ) {
        const evidenceFile =
          evidenceFiles[i];

        const upload =
          reportMode ===
          "ANONYMOUS"
            ? await getAnonymousUploadUrl(
                evidenceFile.file,
                currentReportId,
                "evidence"
              )
            : await getUploadUrl(
                evidenceFile.file,
                currentReportId,
                "evidence"
              );

        if (
          !currentReportId
        ) {
          currentReportId =
            upload.reportId;
        }

        await uploadEvidence(
          upload.uploadUrl,
          evidenceFile.file,
          upload.contentType
        );

        uploadedEvidence.push(
          {
            key:
              upload.evidenceKey ||
              upload.photoKey ||
              "",
            contentType:
              upload.contentType,
            mediaType:
              upload.mediaType ===
              "video"
                ? "video"
                : "image",
          }
        );
      }

      if (
        !currentReportId
      ) {
        throw new Error(
          "Could not create a report ID."
        );
      }

      // ---------------------------------------------------
      // Upload voice description
      // ---------------------------------------------------

      let audioKey:
        | string
        | undefined;

      let audioContentType:
        | string
        | undefined;

      if (
        descriptionType ===
        "VOICE"
      ) {
        if (!voiceFile) {
          throw new Error(
            "Voice description is missing."
          );
        }

        const voiceUpload =
          reportMode ===
          "ANONYMOUS"
            ? await getAnonymousUploadUrl(
                voiceFile,
                currentReportId,
                "voice"
              )
            : await getUploadUrl(
                voiceFile,
                currentReportId,
                "voice"
              );

        if (
          voiceUpload.reportId !==
          currentReportId
        ) {
          throw new Error(
            "Voice upload returned an unexpected report ID."
          );
        }

        await uploadEvidence(
          voiceUpload.uploadUrl,
          voiceFile,
          voiceUpload.contentType
        );

        audioKey =
          voiceUpload.audioKey;

        audioContentType =
          voiceUpload.contentType;
      }

      // ---------------------------------------------------
      // Create final report
      // ---------------------------------------------------

      const payload = {
        reportId:
          currentReportId,

        incidentType,

        description:
          descriptionType ===
          "TEXT"
            ? description.trim()
            : undefined,

        descriptionType,

        audioKey,
        audioContentType,

        evidence:
          uploadedEvidence,

        town: town.trim(),
        quarter:
          quarter.trim(),

        latitude:
          submissionLocation.latitude,
        longitude:
          submissionLocation.longitude,
        locationAccuracy:
          submissionLocation.accuracy,
        locationCapturedAt:
          submissionLocation.capturedAt,
      };

      if (
        reportMode ===
        "ANONYMOUS"
      ) {
        await createAnonymousReport(
          payload
        );
      } else {
        await createReport(
          payload
        );
      }

      setReportId(
        currentReportId
      );

      setSubmitted(true);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Could not submit report."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // =======================================================
  // LOADING STATE
  // =======================================================

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-950">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />

          <p className="mt-4 text-xs font-semibold text-slate-500">
            Preparing secure reporting...
          </p>
        </div>
      </main>
    );
  }

  // =======================================================
  // SUCCESS SCREEN
  // =======================================================

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
              The incident information
              and evidence were submitted
              successfully to the
              SOS-Kamer response system.
            </p>

            {/* ------------------------------------------------
                REPORT REFERENCE
            ------------------------------------------------ */}

            {/* <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                Report reference
              </p>

              <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-200">
                {reportId}
              </p>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Keep this reference for your
                records.
              </p>
            </div> */}

            {reportMode ===
              "ANONYMOUS" && (
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-left">
                <p className="text-xs font-semibold leading-5 text-amber-300">
                  This report was submitted
                  anonymously. It will not appear
                  in a personal My Reports account.
                  Keep the report reference above
                  for your records.
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              {reportMode ===
                "AUTHENTICATED" && (
                <Link
                  href="/reports"
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-red-600 px-6 text-sm font-bold shadow-lg shadow-red-950/30 transition hover:bg-red-500"
                >
                  View my reports
                </Link>
              )}

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

  // =======================================================
  // MAIN REPORT FORM
  // =======================================================

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      {/* ===================================================
          HEADER
      =================================================== */}

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
            {isAuthenticated &&
              reportMode ===
                "AUTHENTICATED" && (
                <>
                  <Link
                    href="/reports"
                    className="rounded-lg px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                  >
                    My reports
                  </Link>

                  <SignOutButton />
                </>
              )}

            {isAuthenticated &&
              reportMode ===
                "ANONYMOUS" && (
                <span className="rounded-lg bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-700">
                  Anonymous mode
                </span>
              )}
          </div>
        </div>
      </header>

      {/* ===================================================
          PAGE
      =================================================== */}

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
        {/* =================================================
            INTRO
        ================================================= */}

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

        {/* =================================================
            REPORT MODE
        ================================================= */}

        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
                00
              </span>

              <div>
                <h2 className="text-sm font-bold text-slate-950">
                  How would you like to report?
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  You can submit using your account or
                  report anonymously without linking the
                  incident to your account.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
            {/* AUTHENTICATED */}

            <label
              className={`cursor-pointer rounded-xl border p-4 transition ${
                reportMode ===
                "AUTHENTICATED"
                  ? "border-slate-950 bg-slate-50 ring-2 ring-slate-100"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              } ${
                !isAuthenticated
                  ? "cursor-not-allowed opacity-50"
                  : ""
              }`}
            >
              <input
                type="radio"
                name="reportMode"
                value="AUTHENTICATED"
                checked={
                  reportMode ===
                  "AUTHENTICATED"
                }
                disabled={
                  !isAuthenticated
                }
                onChange={() =>
                  setReportMode(
                    "AUTHENTICATED"
                  )
                }
                className="sr-only"
              />

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Submit with my account
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Your report will be linked to
                    your account and available in
                    My Reports.
                  </p>

                  {!isAuthenticated && (
                    <p className="mt-2 text-[10px] font-bold text-amber-600">
                      Sign in to use this option.
                    </p>
                  )}
                </div>

                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    reportMode ===
                    "AUTHENTICATED"
                      ? "border-slate-950 bg-slate-950"
                      : "border-slate-300"
                  }`}
                >
                  {reportMode ===
                    "AUTHENTICATED" && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
              </div>
            </label>

            {/* ANONYMOUS */}

            <label
              className={`cursor-pointer rounded-xl border p-4 transition ${
                reportMode ===
                "ANONYMOUS"
                  ? "border-red-500 bg-red-50 ring-2 ring-red-100"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="reportMode"
                value="ANONYMOUS"
                checked={
                  reportMode ===
                  "ANONYMOUS"
                }
                onChange={() =>
                  setReportMode(
                    "ANONYMOUS"
                  )
                }
                className="sr-only"
              />

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-red-700">
                    Report anonymously
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    No account is required and the
                    report will not be linked to your
                    citizen account.
                  </p>
                </div>

                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    reportMode ===
                    "ANONYMOUS"
                      ? "border-red-500 bg-red-500"
                      : "border-slate-300"
                  }`}
                >
                  {reportMode ===
                    "ANONYMOUS" && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
              </div>
            </label>
          </div>

          {reportMode ===
            "ANONYMOUS" && (
            <div className="border-t border-amber-100 bg-amber-50 px-5 py-4 sm:px-6">
              <p className="text-xs leading-5 text-amber-800">
                <span className="font-bold">
                  Anonymous reporting:
                </span>{" "}
                your report will still be visible to
                authorized SOS-Kamer administrators,
                but it will not be associated with
                your account.
              </p>
            </div>
          )}
        </section>

        {/* =================================================
            ERROR
        ================================================= */}

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

        {/* =================================================
            FORM
        ================================================= */}

        <form
          onSubmit={handleSubmit}
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* =================================================
                MAIN FORM
            ================================================= */}

            <div className="space-y-6">
              {/* =================================================
                  INCIDENT
              ================================================= */}

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
                  {incidentTypes.map(
                    (type) => {
                      const selected =
                        incidentType ===
                        type.value;

                      return (
                        <label
                          key={
                            type.value
                          }
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
                            value={
                              type.value
                            }
                            checked={
                              selected
                            }
                            onChange={(
                              e
                            ) =>
                              setIncidentType(
                                e
                                  .target
                                  .value
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
                                {
                                  type.label
                                }
                              </p>

                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {
                                  type.description
                                }
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
                    }
                  )}
                </div>
              </section>

              {/* =================================================
                  DESCRIPTION
              ================================================= */}

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
                        You can describe what happened
                        using text or your voice.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  {/* -------------------------------------------
                      DESCRIPTION TYPE
                  ------------------------------------------- */}

                  <div className="mb-5 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDescriptionType(
                          "TEXT"
                        )
                      }
                      className={`rounded-xl border p-4 text-left transition ${
                        descriptionType ===
                        "TEXT"
                          ? "border-slate-950 bg-slate-50 ring-2 ring-slate-100"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <p className="text-sm font-bold text-slate-800">
                        Text description
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Type the details of what
                        happened.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDescriptionType(
                          "VOICE"
                        )
                      }
                      className={`rounded-xl border p-4 text-left transition ${
                        descriptionType ===
                        "VOICE"
                          ? "border-red-500 bg-red-50 ring-2 ring-red-100"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <p className="text-sm font-bold text-slate-800">
                        Voice description
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Record yourself describing
                        what happened.
                      </p>
                    </button>
                  </div>

                  {/* -------------------------------------------
                      TEXT DESCRIPTION
                  ------------------------------------------- */}

                  {descriptionType ===
                    "TEXT" && (
                    <>
                      <textarea
                        id="description"
                        value={
                          description
                        }
                        onChange={(e) =>
                          setDescription(
                            e.target
                              .value
                          )
                        }
                        required
                        rows={7}
                        placeholder="Describe what you saw or what happened..."
                        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-500 focus:bg-white focus:ring-4 focus:ring-slate-100"
                      />

                      <p className="mt-2 text-[11px] text-slate-400">
                        Be factual and specific.
                        Avoid assumptions where
                        possible.
                      </p>
                    </>
                  )}

                  {/* -------------------------------------------
                      VOICE DESCRIPTION
                  ------------------------------------------- */}

                  {descriptionType ===
                    "VOICE" && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="text-center">
                        <div
                          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
                            isRecording
                              ? "bg-red-100"
                              : "bg-white"
                          }`}
                        >
                          <span
                            className={`text-xl ${
                              isRecording
                                ? "text-red-600"
                                : "text-slate-700"
                            }`}
                          >
                            {isRecording
                              ? "●"
                              : "🎙"}
                          </span>
                        </div>

                        <p className="mt-4 text-sm font-bold text-slate-800">
                          {isRecording
                            ? "Recording your description..."
                            : voiceFile
                              ? "Voice description recorded"
                              : "Record your description"}
                        </p>

                        {isRecording && (
                          <p className="mt-2 font-mono text-lg font-bold text-red-600">
                            {formatRecordingTime(
                              recordingSeconds
                            )}
                          </p>
                        )}

                        {!isRecording &&
                          !voiceFile && (
                            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
                              Explain what happened
                              clearly.
                            </p>
                          )}
                      </div>

                      {/* RECORD */}

                      <div className="mt-5 flex justify-center">
                        {!isRecording &&
                          !voiceFile && (
                            <button
                              type="button"
                              onClick={
                                startVoiceRecording
                              }
                              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-6 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition hover:bg-red-500"
                            >
                              <span>
                                ●
                              </span>
                              Start recording
                            </button>
                          )}

                        {isRecording && (
                          <button
                            type="button"
                            onClick={
                              stopVoiceRecording
                            }
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-bold text-white transition hover:bg-slate-800"
                          >
                            <span>
                              ■
                            </span>
                            Stop recording
                          </button>
                        )}

                        {!isRecording &&
                          voiceFile && (
                            <div className="flex flex-col gap-3 sm:flex-row">
                              <button
                                type="button"
                                onClick={
                                  startVoiceRecording
                                }
                                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                              >
                                Record again
                              </button>

                              <button
                                type="button"
                                onClick={
                                  removeVoiceRecording
                                }
                                className="inline-flex h-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-5 text-xs font-bold text-red-600 transition hover:bg-red-100"
                              >
                                Remove recording
                              </button>
                            </div>
                          )}
                      </div>

                      {/* AUDIO PREVIEW */}

                      {voicePreviewUrl &&
                        !isRecording && (
                          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Preview
                            </p>

                            <audio
                              controls
                              src={
                                voicePreviewUrl
                              }
                              className="w-full"
                            />
                          </div>
                        )}

                      <p className="mt-4 text-center text-[10px] leading-4 text-slate-400">
                        Audio formats supported by the
                        reporting system include WebM,
                        OGG and MP4.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* =================================================
                  LOCATION
              ================================================= */}

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
                        setTown(
                          e.target.value
                        )
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
                        setQuarter(
                          e.target.value
                        )
                      }
                      placeholder="e.g. Bonanjo"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:bg-white focus:ring-4 focus:ring-slate-100"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 px-5 py-5 sm:px-6">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          deviceLocation
                            ? "bg-emerald-100 text-emerald-700"
                            : locationError
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800">
                          Device location
                        </p>

                        {locationLoading &&
                        !deviceLocation ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Detecting your current location...
                          </p>
                        ) : deviceLocation ? (
                          <>
                            <p className="mt-1 text-xs font-semibold text-emerald-700">
                              Location detected automatically
                            </p>

                            <p className="mt-1 text-[11px] text-slate-500">
                              Accuracy: approximately {Math.round(
                                deviceLocation.accuracy
                              )} m
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="mt-1 text-xs font-semibold text-red-700">
                              Location unavailable
                            </p>

                            <p className="mt-1 text-[11px] leading-5 text-red-600">
                              {locationError}
                            </p>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          void requestFreshLocation();
                        }}
                        disabled={locationLoading}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {locationLoading
                          ? "Detecting..."
                          : "Retry"}
                      </button>
                    </div>

                    <p className="mt-3 text-[11px] leading-5 text-slate-500">
                      Your coordinates are captured automatically from your device.
                    </p>
                  </div>
                </div>
              </section>

              {/* =================================================
                  EVIDENCE
              ================================================= */}

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
                    <span>
                      Up to 10 files
                    </span>

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

                  {evidenceFiles.length >
                    0 && (
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
                          (
                            item,
                            index
                          ) => (
                            <div
                              key={
                                item.id
                              }
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
                                      index +
                                      1
                                    }`}
                                    className="h-full w-full object-cover"
                                  />
                                )}

                                <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 text-[9px] font-bold text-white backdrop-blur">
                                  {index +
                                    1}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-3 p-3">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold text-slate-700">
                                    {
                                      item
                                        .file
                                        .name
                                    }
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
                                      (1024 *
                                        1024)
                                    ).toFixed(
                                      1
                                    )}{" "}
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

            {/* =================================================
                SIDE REVIEW
            ================================================= */}

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
                  {/* MODE */}

                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[9px] font-black text-white">
                      {reportMode ===
                      "ANONYMOUS"
                        ? "A"
                        : "U"}
                    </span>

                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        Reporting mode
                      </p>

                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {reportMode ===
                        "ANONYMOUS"
                          ? "Anonymous"
                          : "Linked to your account"}
                      </p>
                    </div>
                  </div>

                  {/* INCIDENT */}

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
                              (
                                item
                              ) =>
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

                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        Description
                      </p>

                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {descriptionType ===
                        "VOICE"
                          ? voiceFile
                            ? "Voice recording ready"
                            : "Voice recording required"
                          : description.trim()
                            ? "Information provided"
                            : "Not provided"}
                      </p>
                    </div>
                  </div>

                  {/* LOCATION */}

                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        town.trim() &&
                        quarter.trim() &&
                        deviceLocation
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {town.trim() &&
                      quarter.trim() &&
                      deviceLocation
                        ? "✓"
                        : "—"}
                    </span>

                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        Location
                      </p>

                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {town.trim() &&
                        quarter.trim() &&
                        deviceLocation
                          ? `${town}, ${quarter} · GPS ready`
                          : "Location information incomplete"}
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

                {/* SUBMIT */}

                <div className="border-t border-slate-100 p-5">
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[11px] font-semibold leading-5 text-amber-800">
                      Only submit genuine incidents.
                      False reports can delay
                      assistance and affect people
                      who need help.
                    </p>
                  </div>

                  {reportMode ===
                    "ANONYMOUS" && (
                    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[11px] leading-5 text-slate-600">
                        This report will be submitted
                        without your account identity.
                        Keep your report reference after
                        submission.
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      isRecording ||
                      !deviceLocation
                    }
                    className="group flex h-13 w-full items-center justify-center gap-3 rounded-xl bg-red-600 px-5 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-white" />

                        Submitting report...
                      </>
                    ) : !deviceLocation ? (
                      <>
                        Waiting for location...
                      </>
                    ) : (
                      <>
                        {reportMode ===
                        "ANONYMOUS"
                          ? "Submit anonymously"
                          : "Submit incident"}

                        <span className="transition-transform group-hover:translate-x-0.5">
                          →
                        </span>
                      </>
                    )}
                  </button>

                  <p className="mt-3 text-center text-[10px] leading-4 text-slate-400">
                    Your evidence will be securely
                    uploaded before the report is
                    submitted.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </form>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="py-8 text-center">
          <p className="text-[10px] text-slate-400">
            SOS-Kamer · Citizen Incident Reporting
          </p>
        </footer>
      </div>
    </main>
  );
}