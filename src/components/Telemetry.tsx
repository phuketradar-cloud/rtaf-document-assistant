/**
 * ส่วนแสดงข้อมูลแบบเกจ/มิเตอร์ — แสดงเฉพาะค่าจริงที่ส่งเข้ามา ไม่มีภาพเคลื่อนไหวจำลองข้อมูล
 * สีมาจาก token ของธีม (--chart-track, --chart-fill) จึงใช้ได้ทุกธีม
 */

const TAU = Math.PI * 2;

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const p = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x1, y1] = p(start);
  const [x2, y2] = p(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

interface RadialGaugeProps {
  /** ค่าปัจจุบัน — null = ยังไม่มีข้อมูล */
  value: number | null;
  max: number;
  /** ข้อความกลางวง เช่น "67" */
  display: string;
  unit?: string;
  /** คำอธิบายสำหรับโปรแกรมอ่านหน้าจอ */
  ariaLabel: string;
  segments?: number;
  size?: number;
  /** ใช้ warning/critical เฉพาะเมื่อค่านั้นเป็นสถานะที่ต้องระวังจริง */
  tone?: 'normal' | 'warning' | 'critical';
}

/** เกจวงกลมแบบแบ่งช่อง */
export function RadialGauge({ value, max, display, unit, ariaLabel, segments = 24, size = 104, tone = 'normal' }: RadialGaugeProps) {
  const c = size / 2;
  const r = c - 8;
  const gap = 0.05;
  const step = TAU / segments;
  const ratio = value === null || max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  const filled = Math.round(ratio * segments);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
      {Array.from({ length: segments }, (_, i) => (
        <path
          key={i}
          d={arcPath(c, c, r, i * step + gap, (i + 1) * step - gap)}
          className={i < filled ? `gauge-fill tone-${tone}` : 'gauge-track'}
          strokeWidth={7}
          fill="none"
        />
      ))}
      <circle cx={c} cy={c} r={r - 9} fill="none" className="gauge-track" strokeWidth={1} />
      <text x={c} y={c + (unit ? 2 : 6)} textAnchor="middle" className="gauge-value" fontSize={size * 0.22}>
        {display}
      </text>
      {unit && (
        <text x={c} y={c + size * 0.18} textAnchor="middle" className="gauge-unit" fontSize={size * 0.1}>
          {unit}
        </text>
      )}
    </svg>
  );
}

interface MonthBarsProps {
  data: { label: string; count: number }[];
  ariaLabel: string;
  /** จำนวนช่องในแต่ละแท่ง */
  levels?: number;
}

/** มิเตอร์แนวตั้งแบบแบ่งช่อง (เช่น จำนวนเอกสารต่อเดือน) */
export function MonthBars({ data, ariaLabel, levels = 10 }: MonthBarsProps) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="month-bars" role="img" aria-label={ariaLabel}>
      {data.map((d) => {
        const on = d.count === 0 ? 0 : Math.max(1, Math.round((d.count / max) * levels));
        return (
          <div className="month-bar" key={d.label}>
            <span className="month-bar-count">{d.count}</span>
            <div className="month-bar-meter" aria-hidden="true">
              {Array.from({ length: levels }, (_, i) => (
                <span key={i} className={`month-bar-seg${i < on ? ' on' : ''}`} />
              ))}
            </div>
            <span className="month-bar-label">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
