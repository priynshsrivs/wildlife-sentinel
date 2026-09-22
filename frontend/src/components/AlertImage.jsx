import { useEffect, useState } from 'react';
import { API_BASE, apiFetch } from '../api/client';
export default function AlertImage({ path, ...props }) {
  const [source, setSource] = useState(null);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let objectUrl;
    apiFetch(new URL(path, API_BASE).href, {signal:controller.signal}).then(async response => {
      if (!response.ok) return;
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob); setSource(objectUrl);
    }).catch(() => {});
    return () => {controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl);};
  }, [path]);
  return source ? <img loading="lazy" {...props} src={source} alt={props.alt || 'Incident evidence'}/> : null;
}
