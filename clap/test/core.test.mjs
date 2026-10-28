import test from "node:test";
import assert from "node:assert/strict";
import { validateManifest, validateReview, reconcile, computeStatus, reviewToText, computePeaks } from "../lib/core.mjs";

const sb = {
  schema: 1, project: "demo", round: 1, stage: "storyboard", canvas: { w: 1080, h: 1920, fps: 30 },
  panels: [{ id: "a", title: "A" }, { id: "b", title: "B" }],
};
const fin = {
  schema: 1, project: "demo", round: 1, stage: "final", canvas: { w: 1920, h: 1080, fps: 25 }, media: { video: "v.mp4" },
  tracks: [{ id: "cards", kind: "component", items: [{ id: "x", start: 0, end: 1, children: [{ id: "x.1", start: 0.2 }] }] }],
};

test("valid manifests pass, both orientations", () => {
  assert.deepEqual(validateManifest(sb), []);
  assert.deepEqual(validateManifest(fin), []);
});

test("storyboard needs panels, final needs media.video and tracks", () => {
  assert.ok(validateManifest({ ...sb, panels: undefined }).length);
  assert.ok(validateManifest({ ...fin, media: {} }).length);
});

test("duplicate ids are rejected, including nested children", () => {
  const m = structuredClone(fin);
  m.tracks[0].items.push({ id: "x.1", start: 3 });
  assert.match(validateManifest(m).join(), /duplicate id "x.1"/);
});

test("status: approved only when all panels approved and no open comment", () => {
  const r = reconcile(null, sb);
  assert.equal(computeStatus(r, sb), "in_review");
  r.panels = { a: "approved", b: "approved" };
  assert.equal(computeStatus(r, sb), "approved");
  r.comments.push({ id: "c1", round: 1, stage: "storyboard", text: "x", status: "open", target: { panel: "a" } });
  assert.equal(computeStatus(r, sb), "changes_requested");
  assert.deepEqual(validateReview({ ...r, status: computeStatus(r, sb) }), []);
});

test("final stage approved via approved_round", () => {
  const r = reconcile(null, fin);
  assert.equal(computeStatus(r, fin), "in_review");
  r.approved_round = 1;
  assert.equal(computeStatus(r, fin), "approved");
});

test("new round keeps history, flags resolved for recheck, resets 'changes' panels", () => {
  const r = reconcile(null, sb);
  r.panels = { a: "approved", b: "changes" };
  r.comments.push({ id: "c1", round: 1, stage: "storyboard", text: "x", status: "resolved", resolution: "done", target: { panel: "b" } });
  const r2 = reconcile(r, { ...sb, round: 2, panels: [...sb.panels, { id: "c", title: "C" }] });
  assert.equal(r2.round, 2);
  assert.deepEqual(r2.panels, { a: "approved", b: "pending", c: "pending" });
  assert.equal(r2.comments[0].recheck, true);
});

test("a comment the user confirmed is not flagged again", () => {
  const r = reconcile(null, sb);
  r.comments.push({ id: "c1", round: 1, stage: "storyboard", text: "x", status: "resolved", checked: true, target: {} });
  assert.equal(reconcile(r, { ...sb, round: 2 }).comments[0].recheck, undefined);
});

test("same round keeps panel states as saved", () => {
  const r = reconcile(null, sb);
  r.panels = { a: "approved", b: "changes" };
  assert.deepEqual(reconcile(r, sb).panels, { a: "approved", b: "changes" });
});

test("switching storyboard <-> final keeps both stages intact", () => {
  let r = reconcile(null, sb, [fin]);
  r.panels = { a: "approved", b: "approved" };
  r.approved_round = 1;
  r = reconcile(r, fin, [sb]);        // the skill moved the gate to final
  assert.deepEqual(r.panels, { a: "approved", b: "approved" });
  assert.equal(r.stages.storyboard.status, "approved");
  assert.equal(r.stages.final.status, "approved");
  r = reconcile(r, sb, [fin]);        // and back
  assert.deepEqual(r.panels, { a: "approved", b: "approved" });
  assert.equal(r.status, "approved");
});

test("each stage keeps its own round", () => {
  let r = reconcile(null, sb, [fin]);
  r.comments.push({ id: "c1", round: 1, stage: "final", text: "x", status: "resolved", target: {} });
  r = reconcile(r, { ...sb, round: 3 }, [fin]);   // storyboard round bump must not touch final comments
  assert.equal(r.comments[0].recheck, undefined);
  r = reconcile(r, { ...fin, round: 2 }, [{ ...sb, round: 3 }]);
  assert.equal(r.comments[0].recheck, true);
  assert.deepEqual(r.stages, { storyboard: { round: 3, status: "in_review" }, final: { round: 2, status: "in_review" } });
});

test("text export lists open comments with where and when", () => {
  const r = reconcile(null, fin);
  r.comments.push({ id: "c1", round: 1, stage: "final", text: "Plus gros", status: "open",
    target: { track: "cards", item: "x", sub: "x.1" }, t: 61.5, frame: 1538, point: { x: 0.5, y: 0.25 } });
  const t = reviewToText(r, fin);
  assert.match(t, /element x\.1/);
  assert.match(t, /@ 1:01\.50 \(frame 1538\)/);
  assert.match(t, /Plus gros/);
});

test("peaks are min/max pairs per bucket", () => {
  const p = computePeaks(new Float32Array([0, 0.5, -0.25, 1, -1, 0]), 2);
  assert.deepEqual(p, [-0.25, 0.5, -1, 1]);
});
