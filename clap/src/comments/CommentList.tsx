import { useState } from "react";
import type { Comment, Review } from "../types";
import { fileUrl, fmtTime, targetLabel } from "../util";

export function CommentList({ round, comments, activeId, onSelect, update }: {
  round: number; comments: Comment[]; activeId?: string;
  onSelect?: (c: Comment) => void; update: (fn: (r: Review) => void) => void;
}) {
  const [filter, setFilter] = useState<"open" | "all">("all");
  const shown = comments.filter((c) => filter === "all" || c.status === "open");
  const set = (id: string, patch: Partial<Comment>) =>
    update((r) => { const c = r.comments.find((x) => x.id === id); if (c) Object.assign(c, patch); });
  const remove = (id: string) => update((r) => { r.comments = r.comments.filter((x) => x.id !== id); });
  const open = comments.filter((c) => c.status === "open").length;

  return (
    <div className="comments">
      <div className="comments-head">
        <span>Comments <b>{open}</b> open / {comments.length}</span>
        <div className="seg">
          <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All</button>
          <button className={filter === "open" ? "on" : ""} onClick={() => setFilter("open")}>Open</button>
        </div>
      </div>
      {!shown.length && <div className="empty">No comments yet. Click in the image to add one.</div>}
      <ol className="comment-list">
        {shown.map((c) => (
          <li key={c.id} className={`comment ${c.status} ${activeId === c.id ? "active" : ""}`} onClick={() => onSelect?.(c)}>
            <div className="comment-meta">
              <span className="tgt">{targetLabel(c.target)}</span>
              {c.t != null && <span className="time">{fmtTime(c.t)}{c.range ? ` → ${fmtTime(c.range[1])}` : ""}</span>}
              {c.round !== round && <span className="badge">R{c.round}</span>}
              {c.recheck && <span className="badge warn" title="Fixed by Claude in the previous round: check it again">recheck</span>}
            </div>
            <div className="comment-text">{c.text}</div>
            {c.resolution && <div className="resolution">↳ {c.resolution}</div>}
            <div className="comment-actions" onClick={(e) => e.stopPropagation()}>
              <span className={`status ${c.status}`}>{c.status === "open" ? "open" : c.status === "resolved" ? "resolved" : "won't fix"}</span>
              {c.shot && <a href={fileUrl(c.shot)} target="_blank" rel="noreferrer">screenshot</a>}
              {c.status === "open" && c.round === round && <button className="link" onClick={() => remove(c.id)}>delete</button>}
              {c.status !== "open" && <button className="link" onClick={() => set(c.id, { status: "open", recheck: false })}>reopen</button>}
              {c.recheck && <button className="link" onClick={() => set(c.id, { recheck: false, checked: true })}>OK, checked</button>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
