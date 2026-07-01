import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { api, ApiError } from "../lib/api";
import { Button, Field, Input, Modal, cn } from "./ui";

type Source =
  | { kind: "none" }
  | { kind: "recorded"; blob: Blob; seconds: number }
  | { kind: "file"; file: File };

export function NewMeetingModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (meetingId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<Source>({ kind: "none" });
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    stopTimer();
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    chunksRef.current = [];
    setTitle("");
    setSource({ kind: "none" });
    setRecording(false);
    setElapsed(0);
    setError(null);
    setSubmitting(false);
  }

  function stopTimer() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setSource({ kind: "recorded", blob, seconds: elapsed });
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError("Microphone access was blocked. Allow it, or upload a file instead.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    stopTimer();
  }

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setSource({ kind: "file", file });
  }

  const hasAudio = source.kind !== "none";

  async function onSubmit() {
    if (!title.trim() || !hasAudio) return;
    setSubmitting(true);
    setError(null);
    try {
      const meeting = await api.createMeeting(title.trim());
      if (source.kind === "recorded") {
        await api.uploadAudio(meeting.id, source.blob, "recording.webm");
      } else if (source.kind === "file") {
        await api.uploadAudio(meeting.id, source.file, source.file.name);
      }
      onCreated(meeting.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  const mmss = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, "0")}`;

  return (
    <Modal open={open} onClose={onClose} title="New meeting">
      <div className="space-y-5">
        <Field label="Meeting title" htmlFor="mtitle">
          <Input
            id="mtitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q3 Sprint Planning"
            autoFocus
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Audio</span>

          {/* Record */}
          <div
            className={cn(
              "rounded-xl border p-4 transition-colors",
              recording ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-slate-50",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  {recording && (
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-red-500" />
                  )}
                  <span
                    className={cn(
                      "relative inline-flex h-3 w-3 rounded-full",
                      recording ? "bg-red-500" : "bg-slate-300",
                    )}
                  />
                </span>
                <span className="text-sm font-semibold text-ink">
                  {recording ? `Recording… ${mmss}` : "Record from your mic"}
                </span>
              </div>
              {recording ? (
                <Button variant="outline" onClick={stopRecording}>
                  Stop
                </Button>
              ) : (
                <Button variant="primary" onClick={startRecording}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="3" width="6" height="12" rx="3" />
                    <path d="M5 11a7 7 0 0014 0M12 18v3" strokeLinecap="round" />
                  </svg>
                  Record
                </Button>
              )}
            </div>
          </div>

          <div className="my-3 flex items-center gap-3 text-xs font-medium text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Upload */}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-brand-400 hover:text-brand-700">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Upload an audio file
            <input type="file" accept="audio/*" className="hidden" onChange={onPickFile} />
          </label>

          {source.kind === "recorded" && (
            <p className="mt-2 text-sm font-medium text-brand-700">
              ✓ Recorded {source.seconds}s of audio
            </p>
          )}
          {source.kind === "file" && (
            <p className="mt-2 truncate text-sm font-medium text-brand-700">✓ {source.file.name}</p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={submitting} disabled={!title.trim() || !hasAudio}>
            Create &amp; process
          </Button>
        </div>
      </div>
    </Modal>
  );
}
