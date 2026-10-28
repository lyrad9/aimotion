import { useEffect, useRef, useState } from "react";

/** Inline comment box. Enter submits, Shift+Enter is a new line, Escape cancels. */
export function Composer({ title, onSubmit, onCancel, style }: {
  title: string; onSubmit: (text: string) => void; onCancel: () => void; style?: React.CSSProperties;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const submit = () => { if (text.trim()) onSubmit(text.trim()); };
  return (
    <div className="composer" style={style} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <div className="composer-title">{title}</div>
      <textarea
        ref={ref} value={text} rows={3} placeholder="Your comment…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="composer-actions">
        <button className="ghost" onClick={onCancel}>Cancel</button>
        <button className="primary" disabled={!text.trim()} onClick={submit}>Comment ↵</button>
      </div>
    </div>
  );
}
