// Mirrors schemas/*.schema.json. Keep both in sync.
export type Stage = "storyboard" | "final";
export type Rect = [number, number, number, number];
export interface Source { file: string; pointer?: string }

export interface PanelImage { src: string; label?: string; t?: number }
export interface Panel {
  id: string; title: string; kind?: string; chapter?: string;
  start?: number; end?: number; images?: (string | PanelImage)[];
  description?: string; excerpt?: string; data?: unknown; source?: Source;
  clip?: { src?: string; start: number; end: number };
}

export interface Item {
  id: string; label?: string; text?: string; kind?: string;
  start: number; end?: number; bbox?: Rect; rid?: string;
  data?: unknown; source?: Source; children?: Item[];
}
export type TrackKind = "segment" | "component" | "word" | "marker" | "audio-cue" | "audio" | "region";
export interface Track { id: string; label?: string; kind: TrackKind; color?: string; src?: string; items?: Item[] }
export interface Layer { kind: "html"; src: string; timeline?: string; offset?: number; size?: [number, number]; crop?: Rect; rect: Rect; track?: string; start?: number; end?: number }
export interface Chapter { id: string; title: string; start: number; end: number }

export interface Manifest {
  schema: 1; project: string; title?: string; round: number; stage: Stage;
  canvas: { w: number; h: number; fps?: number };
  duration?: number;
  media?: { video?: string; audio?: string };
  chapters?: Chapter[]; panels?: Panel[]; tracks?: Track[]; layers?: Layer[]; notes?: string;
}

export type PanelState = "pending" | "approved" | "changes";
export interface Target {
  panel?: string; image?: number; track?: string; item?: string; sub?: string; label?: string; source?: Source;
}
export interface Comment {
  id: string; round: number; stage: Stage; created?: string; target: Target;
  t?: number; frame?: number; range?: [number, number]; point?: { x: number; y: number };
  shot?: string; text: string; status: "open" | "resolved" | "wontfix"; resolution?: string | null; recheck?: boolean; checked?: boolean;
}
export interface Review {
  schema: 1; project?: string; round: number; stage: Stage;
  status: "in_review" | "changes_requested" | "approved"; updated?: string;
  panels: Record<string, PanelState>; comments: Comment[]; approved_round?: number;
  stages?: Partial<Record<Stage, { round: number; status: Review["status"] }>>;
}

export interface State {
  manifest: Manifest | null; errors: string[]; review: Review | null; version?: string; root?: string;
  gateStage?: Stage; stages?: Stage[];
}
