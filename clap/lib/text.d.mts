import type { Manifest, Review } from "../src/types";
export function fmtTime(t?: number): string;
export function reviewToText(r: Review, m: Manifest, opts?: { onlyOpen?: boolean }): string;
