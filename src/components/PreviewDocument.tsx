import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { MemoFields, MemoTemplate } from '../types';
import { buildMemoLayout, type LayoutParagraph, type LayoutRun } from '../lib/layout';

const PX_PER_CM = 96 / 2.54;
const PAGE_WIDTH_CM = 21;

function renderRuns(runs: LayoutRun[]) {
  return runs.map((r, i) =>
    r.kind === 'text' ? (
      <span key={i} style={r.bold ? { fontWeight: 700 } : undefined}>
        {r.text}
      </span>
    ) : null,
  );
}

function ParagraphView({ p, t }: { p: LayoutParagraph; t: MemoTemplate }) {
  const style: CSSProperties = {
    fontSize: `${p.sizePt}pt`,
    textAlign: p.align === 'thaiDistribute' ? 'justify' : p.align,
    textIndent: p.firstLineIndentCm ? `${p.firstLineIndentCm}cm` : undefined,
    paddingLeft: p.leftIndentCm ? `${p.leftIndentCm}cm` : undefined,
    marginBottom: `${t.paragraphSpacingAfterPt}pt`,
    lineHeight: p.role === 'title' ? 1.2 : 1.25 * t.lineSpacing,
  };
  if (!p.runs.length) return <p style={style}>&nbsp;</p>;
  const tabAt = p.runs.findIndex((r) => r.kind === 'tab');
  if (tabAt >= 0 && p.tabStopCm) {
    // จำลองแท็บด้วยกล่องกว้างเท่าตำแหน่งแท็บ (ใกล้เคียงกับ Word แต่ไม่เหมือนทุกพิกเซล)
    return (
      <p style={style}>
        <span style={{ display: 'inline-block', minWidth: `${p.tabStopCm - (p.leftIndentCm ?? 0)}cm` }}>
          {renderRuns(p.runs.slice(0, tabAt))}
        </span>
        {renderRuns(p.runs.slice(tabAt + 1))}
      </p>
    );
  }
  return <p style={style}>{renderRuns(p.runs)}</p>;
}

/** ตัวอย่างเอกสารก่อนส่งออก — ใช้แบบจำลองการจัดวางเดียวกับไฟล์ Word */
export default function PreviewDocument({ fields, template }: { fields: MemoFields; template: MemoTemplate }) {
  const layout = useMemo(() => buildMemoLayout(fields, template), [fields, template]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // ตอนแท็บตัวอย่างถูกซ่อน (กว้าง 0) ไม่ต้องปรับขนาด รอจนแสดงผลจริง
    const update = () => {
      if (el.clientWidth > 0) setScale(Math.max(0.2, Math.min(1, (el.clientWidth - 2) / (PAGE_WIDTH_CM * PX_PER_CM))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const t = template;
  return (
    <div ref={wrapRef} className="preview-wrap">
      <div
        className="preview-page"
        style={{
          zoom: scale,
          padding: `${t.marginTopCm}cm ${t.marginRightCm}cm ${t.marginBottomCm}cm ${t.marginLeftCm}cm`,
          fontFamily: `"${t.fontName}", "TH Sarabun New", "TH SarabunPSK", "Leelawadee UI", Tahoma, sans-serif`,
          fontSize: `${t.fontSizePt}pt`,
        }}
      >
        {layout.map((p, i) => (
          <Fragment key={i}>
            {p.pageBreakBefore && <div className="preview-pagebreak">ขึ้นหน้าใหม่</div>}
            <ParagraphView p={p} t={t} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
