"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import {
  LIVE_RECORDING_COUNTDOWN_SECONDS,
  LIVE_RECORDING_MAX_SECONDS,
  LIVE_RECORDING_MIN_SECONDS,
  bindRecordedPlaybackElement,
  classifyGetUserMediaError,
  detachLivePreviewElement,
  messageForLiveRecordingError,
  pickSupportedLivenessMimeType,
  resolveLivenessUploadContentType,
  stopMediaStream,
  type LivenessUploadContentType,
} from "@/lib/verification/liveness-recording";

type RecorderPhase = "preview" | "countdown" | "recording" | "review";

interface LiveLivenessRecorderProps {
  stream: MediaStream;
  challengeDisplayCode: string;
  uploading?: boolean;
  onRecorded: (blob: Blob, contentType: LivenessUploadContentType) => void;
  onCancel: () => void;
  onError: (message: string) => void;
  onReacquireCamera: () => void;
}

function LivePreviewVideo({
  stream,
  videoRef,
}: {
  stream: MediaStream;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}): React.ReactElement {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    const playAttempt = video.play();
    if (playAttempt) {
      void playAttempt.catch(() => undefined);
    }

    return () => {
      detachLivePreviewElement(video);
    };
  }, [stream, videoRef]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      data-testid="liveness-live-preview"
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}

function RecordedPlaybackVideo({
  objectUrl,
}: {
  objectUrl: string;
}): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    bindRecordedPlaybackElement(videoRef.current, objectUrl);
  }, [objectUrl]);

  return (
    <video
      ref={videoRef}
      src={objectUrl}
      controls
      playsInline
      data-testid="liveness-playback"
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}

export function LiveLivenessRecorder({
  stream,
  challengeDisplayCode,
  uploading = false,
  onRecorded,
  onCancel,
  onError,
  onReacquireCamera,
}: LiveLivenessRecorderProps): React.ReactElement {
  const t = useTranslations("worker.verificationFlow");
  const livePreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const streamRef = useRef(stream);
  const liveReleasedRef = useRef(false);

  const [phase, setPhase] = useState<RecorderPhase>("preview");
  const [countdown, setCountdown] = useState(LIVE_RECORDING_COUNTDOWN_SECONDS);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedContentType, setRecordedContentType] =
    useState<LivenessUploadContentType | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const clearTimers = useCallback((): void => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (elapsedTimerRef.current !== null) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  const revokeObjectUrl = useCallback((): void => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const releaseLiveStream = useCallback((): void => {
    detachLivePreviewElement(livePreviewRef.current);
    if (!liveReleasedRef.current) {
      stopMediaStream(streamRef.current);
      liveReleasedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (streamRef.current !== stream) {
      streamRef.current = stream;
      liveReleasedRef.current = false;
      setPhase("preview");
      setElapsedSeconds(0);
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      clearTimers();
      revokeObjectUrl();
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (!liveReleasedRef.current) {
        stopMediaStream(streamRef.current);
        liveReleasedRef.current = true;
      }
    };
  }, [clearTimers, revokeObjectUrl]);

  const finalizeRecording = useCallback(
    (chunks: Blob[], recorderMimeType: string): void => {
      const blob = new Blob(chunks, {
        type: chunks[0]?.type || recorderMimeType.split(";")[0],
      });
      const contentType = resolveLivenessUploadContentType(
        blob.type,
        recorderMimeType
      );

      if (!contentType || blob.size === 0) {
        onError(messageForLiveRecordingError("incompatible_output"));
        setPhase("preview");
        return;
      }

      releaseLiveStream();
      revokeObjectUrl();
      objectUrlRef.current = URL.createObjectURL(blob);
      setPlaybackUrl(objectUrlRef.current);
      setRecordedBlob(blob);
      setRecordedContentType(contentType);
      setPhase("review");
    },
    [onError, releaseLiveStream, revokeObjectUrl]
  );

  const stopRecording = useCallback((): void => {
    clearTimers();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, [clearTimers]);

  const startMediaRecorder = useCallback((): void => {
    chunksRef.current = [];
    const mimeType = pickSupportedLivenessMimeType();
    let recorder: MediaRecorder;

    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      onError(messageForLiveRecordingError("unsupported"));
      setPhase("preview");
      return;
    }

    const recorderMimeType = recorder.mimeType || mimeType || "";

    recorder.ondataavailable = (event: BlobEvent): void => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onerror = (): void => {
      clearTimers();
      onError(messageForLiveRecordingError("recording_failed"));
      setPhase("preview");
    };

    recorder.onstop = (): void => {
      clearTimers();
      finalizeRecording(chunksRef.current, recorderMimeType);
    };

    mediaRecorderRef.current = recorder;

    try {
      recorder.start(250);
    } catch {
      try {
        recorder.start();
      } catch (error) {
        onError(
          messageForLiveRecordingError(classifyGetUserMediaError(error))
        );
        setPhase("preview");
        return;
      }
    }

    setElapsedSeconds(0);
    setPhase("recording");
    elapsedTimerRef.current = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    stopTimerRef.current = window.setTimeout(() => {
      stopRecording();
    }, LIVE_RECORDING_MAX_SECONDS * 1000);
  }, [
    clearTimers,
    finalizeRecording,
    onError,
    stopRecording,
    stream,
  ]);

  const handleStartRecording = useCallback((): void => {
    setRecordedBlob(null);
    setRecordedContentType(null);
    setCountdown(LIVE_RECORDING_COUNTDOWN_SECONDS);
    setPhase("countdown");

    let remaining = LIVE_RECORDING_COUNTDOWN_SECONDS;
    countdownTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (countdownTimerRef.current !== null) {
          window.clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        startMediaRecorder();
      }
    }, 1000);
  }, [startMediaRecorder]);

  const handleRecordAgain = useCallback((): void => {
    clearTimers();
    revokeObjectUrl();
    setPlaybackUrl(null);
    setRecordedBlob(null);
    setRecordedContentType(null);
    setElapsedSeconds(0);
    onReacquireCamera();
  }, [clearTimers, onReacquireCamera, revokeObjectUrl]);

  const handleUseVideo = useCallback((): void => {
    if (!recordedBlob || !recordedContentType) {
      return;
    }
    onRecorded(recordedBlob, recordedContentType);
  }, [onRecorded, recordedBlob, recordedContentType]);

  const handleCancel = useCallback((): void => {
    releaseLiveStream();
    onCancel();
  }, [onCancel, releaseLiveStream]);

  const remainingSeconds = Math.max(
    LIVE_RECORDING_MAX_SECONDS - elapsedSeconds,
    0
  );
  const canStopEarly =
    phase === "recording" && elapsedSeconds >= LIVE_RECORDING_MIN_SECONDS;

  return (
    <div className="space-y-4" data-testid="liveness-recorder">
      <div className="relative w-full aspect-[3/4] max-w-[280px] mx-auto bg-charcoal-900 rounded-2xl overflow-hidden border-2 border-charcoal-700">
        {phase === "review" ? (
          playbackUrl ? (
            <RecordedPlaybackVideo
              key={playbackUrl}
              objectUrl={playbackUrl}
            />
          ) : (
            <div
              className="absolute inset-0 bg-charcoal-900"
              data-testid="liveness-reacquiring"
            />
          )
        ) : (
          <LivePreviewVideo
            key={stream.id}
            stream={stream}
            videoRef={livePreviewRef}
          />
        )}

        <div className="absolute top-4 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <div className="bg-charcoal-950/95 border border-primary-500 rounded-lg px-5 py-3 shadow-lg">
            <p className="text-charcoal-400 text-[10px] text-center uppercase tracking-wider mb-1">
              {t("sayThisCode")}
            </p>
            <p
              className="text-3xl font-mono font-bold text-primary-400 tracking-[0.2em] text-center"
              data-testid="live-challenge-code"
            >
              {challengeDisplayCode}
            </p>
          </div>
        </div>

        {phase === "countdown" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-charcoal-950/40">
            <p className="text-6xl font-bold text-white">{countdown}</p>
          </div>
        )}

        {phase === "recording" && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center">
            <div className="flex items-center gap-2 bg-red-500/90 text-white text-xs font-medium rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Recording {remainingSeconds}s
            </div>
          </div>
        )}
      </div>

      {phase === "preview" && (
        <div className="space-y-3">
          <Button fullWidth onClick={handleStartRecording}>
            Start recording
          </Button>
          <button
            type="button"
            onClick={handleCancel}
            className="block w-full text-center text-xs text-charcoal-500 hover:text-charcoal-300"
          >
            Cancel
          </button>
        </div>
      )}

      {phase === "countdown" && (
        <p className="text-center text-sm text-charcoal-400">
          Get ready to hold your ID and say the code.
        </p>
      )}

      {phase === "recording" && (
        <Button
          fullWidth
          variant="outline"
          onClick={stopRecording}
          disabled={!canStopEarly}
        >
          Stop recording
        </Button>
      )}

      {phase === "review" && (
        <div className="space-y-3">
          <p className="text-center text-green-300 text-sm">
            ✓ Video recorded
          </p>
          <Button fullWidth onClick={handleUseVideo} loading={uploading}>
            Use this video
          </Button>
          <Button
            fullWidth
            variant="outline"
            onClick={handleRecordAgain}
            disabled={uploading}
          >
            Record again
          </Button>
        </div>
      )}
    </div>
  );
}
