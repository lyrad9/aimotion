import { useLayoutEffect, useRef, useState } from "react";

/** A box of the given aspect ratio, as large as fits its container (letterboxed, centred). */
export function FitBox({ w, h, className, children, onClick }: {
  w: number; h: number; className?: string; children: React.ReactNode; onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = outer.current!;
    const fit = () => {
      const k = Math.min(el.clientWidth / w, el.clientHeight / h);
      setSize({ w: Math.floor(w * k), h: Math.floor(h * k) });
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
    return () => ro.disconnect();
  }, [w, h]);
  return (
    <div className="fit-outer" ref={outer}>
      <div className={className} style={{ width: size.w, height: size.h, position: "relative" }} onClick={onClick}>{children}</div>
    </div>
  );
}
