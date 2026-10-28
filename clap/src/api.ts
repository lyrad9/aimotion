import { useCallback, useEffect, useRef, useState } from "react";
import type { Comment, Review, Stage, State } from "./types";

async function getState(stage?: Stage): Promise<State> {
  const r = await fetch(stage ? `/api/state?stage=${stage}` : "/api/state");
  if (!r.ok) throw new Error(`state: HTTP ${r.status}`);
  return r.json();
}

/**
 * Merge after a conflict: the skill may have resolved comments on disk while the user kept editing.
 * Comments the skill closed keep the skill's status/resolution; everything else stays as edited locally.
 */
function merge(local: Review, disk: Review, deleted: Set<string>): Review {
  const byId = new Map(disk.comments.map((c) => [c.id, c]));
  const comments: Comment[] = [];
  for (const c of local.comments) {
    const d = byId.get(c.id);
    comments.push(d && d.status !== "open" && c.status === "open" ? { ...c, status: d.status, resolution: d.resolution } : c);
    byId.delete(c.id);
  }
  for (const d of byId.values()) if (!deleted.has(d.id)) comments.push(d);
  return { ...local, round: disk.round, stage: disk.stage, comments };
}

export function useStore(stage?: Stage) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "error">("idle");
  const version = useRef<string | undefined>(undefined);
  const dirty = useRef(false);
  const deleted = useRef(new Set<string>());
  const timer = useRef<number | undefined>(undefined);
  const current = useRef<State | null>(null);
  current.current = state;
  const stageRef = useRef(stage);
  stageRef.current = stage;

  const load = useCallback(async () => {
    try {
      const s = await getState(stageRef.current);
      version.current = s.version;
      setState(s);
      setError(null);
    } catch (e) { setError(String(e)); }
  }, []);

  const save = useCallback(async () => {
    const s = current.current;
    if (!s?.review) return;
    setSaving("saving");
    const put = (review: Review) => fetch("/api/review", {
      method: "PUT", headers: { "content-type": "application/json", "if-match": version.current || "0" }, body: JSON.stringify(review),
    });
    let res = await put(s.review);
    if (res.status === 409) {
      const disk = await getState(stageRef.current);
      version.current = disk.version;
      if (disk.review) {
        const merged = merge(s.review, disk.review, deleted.current);
        res = await put(merged);
      }
    }
    if (!res.ok) { setSaving("error"); return; }
    const out = await res.json();
    version.current = out.version;
    dirty.current = false;
    setState((prev) => (prev ? { ...prev, review: out.review, version: out.version } : prev));
    setSaving("idle");
  }, []);

  const update = useCallback((fn: (r: Review) => Review | void) => {
    setState((prev) => {
      if (!prev?.review) return prev;
      const draft = structuredClone(prev.review);
      const next = fn(draft) || draft;
      const before = new Set(prev.review.comments.map((c) => c.id));
      for (const c of next.comments) before.delete(c.id);
      before.forEach((id) => deleted.current.add(id));
      return { ...prev, review: next };
    });
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = window.setTimeout(save, 250);
  }, [save]);

  useEffect(() => {
    load();
    const es = new EventSource("/api/events");
    es.addEventListener("change", (ev) => {
      const { kind, self } = JSON.parse((ev as MessageEvent).data);
      if (kind === "manifest") load();
      else if (kind === "review" && !self && !dirty.current) load();
    });
    return () => es.close();
  }, [load]);

  // switching stage only changes which manifest is shown; the review state is shared
  useEffect(() => { load(); }, [stage, load]);

  return { state, error, saving, update, reload: load };
}

export async function uploadShot(id: string, blob: Blob): Promise<string | undefined> {
  const r = await fetch(`/api/shot/${id}`, { method: "POST", body: blob });
  return r.ok ? (await r.json()).shot : undefined;
}

export async function fetchPeaks(src: string, per = 50): Promise<{ duration: number; perSecond: number; peaks: number[] } | null> {
  const r = await fetch(`/api/peaks?src=${encodeURIComponent(src)}&per=${per}`);
  return r.ok ? r.json() : null;
}
