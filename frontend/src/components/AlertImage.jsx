import { useEffect, useState } from "react";
import { API_BASE, apiFetch } from "../api/client";
export default function AlertImage({ path, ...props }) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let objectUrl;
    async function load() {
      try {
        const target = new URL(path, API_BASE);
        if (target.origin !== new URL(API_BASE).origin)
          throw new Error("Untrusted evidence origin");
        const response = await apiFetch(target.href, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Evidence unavailable");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setResult({ path, source: objectUrl });
      } catch {
        if (!controller.signal.aborted) setResult({ path, error: true });
      }
    }
    load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  if (result?.path !== path)
    return (
      <div className="evidence-error" style={props.style}>
        Loading evidence…
      </div>
    );
  return result?.source ? (
    <img
      loading="lazy"
      {...props}
      src={result.source}
      alt={props.alt || "Incident evidence"}
    />
  ) : (
    <div className="evidence-error" style={props.style}>
      Evidence unavailable
    </div>
  );
}
