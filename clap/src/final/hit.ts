import type { Item, Manifest, Rect, Target } from "../types";
import type { HtmlLayer } from "./layer";
import type { Located } from "../util";

export interface Candidate { target: Target; rect?: Rect; kind: string; area: number }
export type Index = { byId: Map<string, Located>; byRid: Map<string, Located> };

const active = (it: Item, t: number) => it.start <= t && t < (it.end ?? it.start + 0.04);

export function targetOf(loc: Located, sub?: string): Target {
  const parent = loc.parent;
  const item = parent ? parent : loc.item;
  const leaf = sub ? undefined : parent ? loc.item : undefined;
  return {
    track: loc.track.id,
    item: item.id,
    sub: sub ?? leaf?.id,
    label: (leaf || loc.item).label || (leaf || loc.item).text || item.label || item.text,
    source: (leaf || loc.item).source || item.source,
  };
}

/** Everything under a canvas point at time t, smallest (most precise) first. */
export function hitTest(m: Manifest, idx: Index, layers: HtmlLayer[], t: number, cx: number, cy: number): Candidate[] {
  const out: Candidate[] = [];
  const inside = (r: Rect) => cx >= r[0] && cy >= r[1] && cx <= r[0] + r[2] && cy <= r[1] + r[3];

  for (const L of layers) {
    if (!L.activeAt(t)) continue;
    L.seek(t);
    const hits = L.hit(cx, cy);
    hits.forEach((h, i) => {
      let loc = idx.byRid.get(h.rid) || idx.byId.get(h.rid);
      let sub: string | undefined;
      if (!loc) {
        // An element the manifest does not list: attach it to the nearest listed ancestor.
        for (const a of hits.slice(i + 1)) {
          loc = idx.byRid.get(a.rid) || idx.byId.get(a.rid);
          if (loc) break;
        }
        sub = h.rid;
      }
      const target: Target = loc ? targetOf(loc, sub) : { track: L.layer.track, sub: h.rid, label: h.rid };
      out.push({ target, rect: h.rect, kind: "layer", area: h.rect[2] * h.rect[3] });
    });
  }

  for (const track of m.tracks || []) {
    const walk = (items: Item[] | undefined, parent?: Item) => items?.forEach((it) => {
      if (it.bbox && active(it, t) && inside(it.bbox)) {
        out.push({ target: targetOf({ track, item: it, parent }), rect: it.bbox, kind: track.kind, area: it.bbox[2] * it.bbox[3] });
      }
      walk(it.children, it);
    });
    walk(track.items);
  }

  const seen = new Set<string>();
  return out
    .sort((a, b) => a.area - b.area)
    .filter((c) => {
      const k = `${c.target.track}|${c.target.item}|${c.target.sub}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}
