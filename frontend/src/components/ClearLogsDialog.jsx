import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import GlassButton from "./GlassButton";

export default function ClearLogsDialog({ busy, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      previousFocus?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="clear-logs-dialog"
      aria-labelledby="clear-logs-title"
      aria-describedby="clear-logs-description"
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <Trash2 size={24} color="#f87171" />
      <h2 id="clear-logs-title">Clear security logs?</h2>
      <p id="clear-logs-description">
        This permanently deletes all alert records and their feedback, including
        alerts outside the current filter. Pending dispatches will also be removed.
      </p>
      {error && <p className="clear-logs-error" role="alert">{error}</p>}
      <div className="clear-logs-actions">
        <GlassButton autoFocus disabled={busy} onClick={onCancel}>Cancel</GlassButton>
        <GlassButton danger disabled={busy} onClick={onConfirm}>
          {busy ? "Clearing…" : "Clear logs"}
        </GlassButton>
      </div>
    </dialog>
  );
}
