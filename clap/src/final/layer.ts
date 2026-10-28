// An HTML/GSAP layer loaded in an off-screen same-origin iframe. Seeking its paused timeline to the
// video time and asking the DOM what is under the cursor gives element-precise picking (data-rid).
import type { Layer, Rect } from "../types";
import { fileUrl } from "../util";

type GsapTimeline = { seek: (t: number, suppressEvents?: boolean) => unknown };
type LayerWindow = Window & { __timelines?: Record<string, GsapTimeline> };

export interface LayerHit { rid: string; rect: Rect }

export class HtmlLayer {
  readonly iframe: HTMLIFrameElement;
  readonly ready: Promise<void>;
  private w: number;
  private h: number;

  constructor(readonly layer: Layer) {
    [this.w, this.h] = layer.size || [layer.rect[2], layer.rect[3]];
    const f = document.createElement("iframe");
    // Off-screen but laid out and visible, otherwise elementsFromPoint ignores everything.
    Object.assign(f.style, { position: "fixed", left: "-100000px", top: "0", width: `${this.w}px`, height: `${this.h}px`, border: "0" });
    f.setAttribute("aria-hidden", "true");
    f.tabIndex = -1;
    f.src = fileUrl(layer.src);
    this.ready = new Promise((ok) => f.addEventListener("load", () => {
      const doc = f.contentDocument;
      if (doc) {
        const st = doc.createElement("style");
        st.textContent = "*{pointer-events:auto!important}";
        doc.head.appendChild(st);
      }
      ok();
    }, { once: true }));
    document.body.appendChild(f);
    this.iframe = f;
  }

  dispose() { this.iframe.remove(); }

  /** A timed layer (start/end) only exists on screen inside its window. */
  activeAt(t: number) {
    const { start, end } = this.layer;
    return start == null || end == null || (t >= start - 1e-3 && t <= end + 1e-3);
  }

  private get win() { return this.iframe.contentWindow as LayerWindow | null; }
  private get doc() { return this.iframe.contentDocument; }

  get hasTimeline() { return !!this.win?.__timelines?.[this.layer.timeline || "main"]; }

  seek(videoT: number) {
    const tl = this.win?.__timelines?.[this.layer.timeline || "main"];
    if (tl) tl.seek(Math.max(0, videoT - (this.layer.offset || 0)), true);
  }

  /** Page region shown in the rect: the whole page unless the layer is cropped (e.g. the top band). */
  private get crop(): Rect { return this.layer.crop || [0, 0, this.w, this.h]; }

  private toLayer(cx: number, cy: number): [number, number] | null {
    const [x, y, w, h] = this.layer.rect;
    const [px, py, pw, ph] = this.crop;
    if (cx < x || cy < y || cx > x + w || cy > y + h) return null;
    return [px + ((cx - x) * pw) / w, py + ((cy - y) * ph) / h];
  }

  private toCanvas(r: DOMRect): Rect {
    const [x, y, w, h] = this.layer.rect;
    const [px, py, pw, ph] = this.crop;
    const kx = w / pw, ky = h / ph;
    // clip to the visible crop so an element half outside the band is outlined where it shows
    const l = Math.max(r.left, px), t = Math.max(r.top, py);
    const rr = Math.min(r.right, px + pw), b = Math.min(r.bottom, py + ph);
    return [x + (l - px) * kx, y + (t - py) * ky, Math.max(0, rr - l) * kx, Math.max(0, b - t) * ky];
  }

  private visible(el: Element): boolean {
    const win = this.win;
    if (!win) return false;
    let o = 1;
    for (let e: Element | null = el; e && e !== this.doc?.documentElement; e = e.parentElement) {
      const cs = win.getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      o *= parseFloat(cs.opacity || "1");
      if (o < 0.05) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /** Does this element draw anything itself (text, media, background, border, shadow)? */
  private paints(el: Element): boolean {
    if (!el.children.length) return true;
    if (/^(svg|img|canvas|video|path|circle|rect|line|polyline|polygon|use|text)$/i.test(el.tagName)) return true;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent!.trim()) return true;
    const cs = this.win!.getComputedStyle(el);
    const bgAlpha = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor)?.[1].split(",")[3];
    return (cs.backgroundColor !== "transparent" && (bgAlpha === undefined || parseFloat(bgAlpha) > 0.02))
      || cs.backgroundImage !== "none" || cs.boxShadow !== "none"
      || (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none");
  }

  /** Every visible data-rid element under the point, deepest first (sub-element, then its card). */
  hit(cx: number, cy: number): LayerHit[] {
    const p = this.toLayer(cx, cy);
    const doc = this.doc;
    if (!p || !doc) return [];
    const out: LayerHit[] = [];
    const seen = new Set<string>();
    for (const el of doc.elementsFromPoint(p[0], p[1])) {
      // Only something actually painted under the cursor counts: an empty wrapper of a card that already
      // left (its content faded out, the wrapper itself still opaque) must not be picked.
      if (!this.visible(el) || !this.paints(el)) continue;
      for (let e: Element | null = el.closest("[data-rid]"); e; e = e.parentElement?.closest("[data-rid]") ?? null) {
        const rid = e.getAttribute("data-rid")!;
        if (seen.has(rid)) continue;
        seen.add(rid);
        if (this.visible(e)) out.push({ rid, rect: this.toCanvas(e.getBoundingClientRect()) });
      }
    }
    return out;
  }

  /** Canvas rect of an element at the current seek position, or null when it is not on screen. */
  rectOf(rid: string): Rect | null {
    const el = this.doc?.querySelector(`[data-rid="${CSS.escape(rid)}"]`);
    return el && this.visible(el) ? this.toCanvas(el.getBoundingClientRect()) : null;
  }
}
