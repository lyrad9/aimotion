// Pure helpers shared by the server, the CLI and the tests. No I/O here.
import Ajv from "ajv/dist/2020.js";
import manifestSchema from "../schemas/manifest.schema.json" with { type: "json" };
import reviewSchema from "../schemas/review.schema.json" with { type: "json" };

const ajv = new Ajv({ allErrors: true, strict: false });
const checkManifest = ajv.compile(manifestSchema);
const checkReview = ajv.compile(reviewSchema);

const fmtErrors = (errs) =>
  (errs || []).map((e) => `${e.instancePath || "/"} ${e.message}${e.params?.allowedValues ? " " + JSON.stringify(e.params.allowedValues) : ""}`);

/** Schema validation plus the checks JSON Schema cannot express (unique ids). */
export function validateManifest(m) {
  const errors = checkManifest(m) ? [] : fmtErrors(checkManifest.errors);
  if (errors.length) return errors;
  const seen = new Set();
  const dup = (id, where) => {
    if (seen.has(id)) errors.push(`${where} duplicate id "${id}"`);
    seen.add(id);
  };
  (m.panels || []).forEach((p, i) => dup(p.id, `/panels/${i}`));
  const walk = (items, where) =>
    (items || []).forEach((it, i) => {
      dup(it.id, `${where}/${i}`);
      walk(it.children, `${where}/${i}/children`);
    });
  (m.tracks || []).forEach((t, i) => {
    dup(`track:${t.id}`, `/tracks/${i}`);
    walk(t.items, `/tracks/${i}/items`);
  });
  return errors;
}

export function validateReview(r) {
  return checkReview(r) ? [] : fmtErrors(checkReview.errors);
}

export function emptyReview(m) {
  return { schema: 1, project: m.project, round: m.round, stage: m.stage, status: "in_review", panels: {}, comments: [], stages: {} };
}

/** Status of one stage: approved only when every panel is approved (storyboard) or the round was approved (final), and no comment is open. */
export function computeStatus(r, m) {
  const open = r.comments.some((c) => c.status === "open" && c.stage === m.stage);
  if (open) return "changes_requested";
  if (m.stage === "storyboard") {
    const ids = (m.panels || []).map((p) => p.id);
    if (ids.some((id) => r.panels?.[id] === "changes")) return "changes_requested";
    return ids.length && ids.every((id) => r.panels?.[id] === "approved") ? "approved" : "in_review";
  }
  return r.approved_round === m.round ? "approved" : "in_review";
}

/**
 * Bring the review in line with one stage's manifest. Each stage keeps its own round, so switching
 * between storyboard and final never resets anything. On a new round of a stage: comments resolved
 * since are flagged "recheck" (until the user confirms them), storyboard panels that asked for changes
 * go back to pending, approved panels stay approved, removed panels are dropped.
 */
function reconcileStage(r, m) {
  const prev = r.stages[m.stage]?.round ?? (r.stage === m.stage ? r.round : undefined);
  const roundChanged = prev !== undefined && prev !== m.round;
  if (m.stage === "storyboard") {
    const panels = { ...r.panels };
    for (const id of Object.keys(panels)) if (!(m.panels || []).some((p) => p.id === id)) delete panels[id];
    for (const p of m.panels || []) {
      const st = panels[p.id];
      panels[p.id] = !st ? "pending" : roundChanged && st === "changes" ? "pending" : st;
    }
    r.panels = panels;
  }
  if (roundChanged) {
    for (const c of r.comments) {
      if (c.stage === m.stage && c.status === "resolved" && c.round < m.round && !c.checked) c.recheck = true;
    }
  }
  r.stages[m.stage] = { round: m.round, status: computeStatus(r, m) };
}

/**
 * Reconcile the saved review with every stage manifest present. The top-level stage/round/status
 * mirror the gate manifest (review/manifest.json, the stage the skill is waiting on).
 */
export function reconcile(saved, gate, others = []) {
  const r = saved ? structuredClone(saved) : emptyReview(gate);
  r.stages = r.stages || {};
  r.panels = r.panels || {};
  for (const m of [...others.filter((o) => o.stage !== gate.stage), gate]) reconcileStage(r, m);
  r.project = gate.project;
  r.stage = gate.stage;
  r.round = gate.round;
  r.status = r.stages[gate.stage].status;
  return r;
}

/** Recompute every stage status after an edit (no round bookkeeping). */
export function restatus(r, gate, others = []) {
  r.stages = r.stages || {};
  for (const m of [...others.filter((o) => o.stage !== gate.stage), gate]) {
    r.stages[m.stage] = { round: m.round, status: computeStatus(r, m) };
  }
  r.stage = gate.stage;
  r.round = gate.round;
  r.status = r.stages[gate.stage].status;
  return r;
}

export { fmtTime, reviewToText } from "./text.mjs";

/** Bucketed min/max peaks from mono float samples. */
export function computePeaks(samples, buckets) {
  const n = Math.max(1, Math.min(buckets, samples.length));
  const size = samples.length / n;
  const out = new Array(n * 2);
  for (let b = 0; b < n; b++) {
    let lo = 0, hi = 0;
    const a = Math.floor(b * size), z = Math.floor((b + 1) * size);
    for (let i = a; i < z; i++) {
      const v = samples[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    out[2 * b] = Math.round(lo * 1000) / 1000;
    out[2 * b + 1] = Math.round(hi * 1000) / 1000;
  }
  return out;
}
