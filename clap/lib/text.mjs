// Plain-text formatting shared by the CLI and the browser bundle (no dependencies).

export const fmtTime = (t) => {
  if (t == null || Number.isNaN(t)) return "";
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
};

/** Plain-text export, the "copy all comments" fallback from the video. */
export function reviewToText(r, m, { onlyOpen = true } = {}) {
  const status = r.stages?.[m.stage]?.status ?? r.status;
  const list = r.comments.filter((c) => c.stage === m.stage && (!onlyOpen || c.status === "open"));
  const head = `Review ${m.project} — ${m.stage}, round ${m.round} — ${status} — ${list.length} comment(s)`;
  const lines = list.map((c, i) => {
    const tg = c.target || {};
    const where = [
      tg.panel && `panel ${tg.panel}${tg.image != null ? ` img ${tg.image + 1}` : ""}`,
      tg.track && `track ${tg.track}`,
      tg.item && `item ${tg.item}`,
      tg.sub && `element ${tg.sub}`,
      c.t != null && `@ ${fmtTime(c.t)}${c.frame != null ? ` (frame ${c.frame})` : ""}`,
      c.range && `range ${fmtTime(c.range[0])}–${fmtTime(c.range[1])}`,
      c.point && `point x=${c.point.x.toFixed(3)} y=${c.point.y.toFixed(3)}`,
    ].filter(Boolean).join(", ");
    return `${i + 1}. [${c.id}] ${where}\n   ${c.text}${c.shot ? `\n   shot: review/${c.shot}` : ""}`;
  });
  if (m.stage === "storyboard") {
    const ps = (m.panels || []).map((p) => `${r.panels[p.id] === "approved" ? "✓" : r.panels[p.id] === "changes" ? "✗" : "·"} ${p.id}`);
    lines.push(`Panels: ${ps.join("  ")}`);
  }
  return [head, ...lines].join("\n");
}
