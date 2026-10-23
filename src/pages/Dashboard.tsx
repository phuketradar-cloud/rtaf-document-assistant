import { useMemo } from 'react';
import { useAppData } from '../state/AppData';
import { formatThaiDate, formatTimestamp } from '../lib/thaiDate';
import { storageUsageBytes } from '../lib/storage';
import { resolveTemplate } from '../lib/templates';
import { validateMemo } from '../lib/validation';
import { MonthBars, RadialGauge } from '../components/Telemetry';

const MONTH_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
/** ขีดจำกัดทั่วไปของ Local Storage ในเบราว์เซอร์ส่วนใหญ่ (ค่าประมาณ) */
const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;

export default function Dashboard() {
  const { documents, templates } = useAppData();
  const drafts = documents.filter((d) => d.status === 'draft').length;
  const exported = documents.length - drafts;
  const recent = [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  const withErrors = useMemo(
    () =>
      documents.filter((d) => {
        const others = documents.filter((o) => o.id !== d.id);
        return validateMemo(d.fields, resolveTemplate(templates, d.templateId).template, { otherDocuments: others }).some(
          (i) => i.severity === 'error',
        );
      }).length,
    [documents, templates],
  );

  // จำนวนเอกสารที่สร้างในแต่ละเดือน 6 เดือนล่าสุด (นับจากวันที่สร้างในโปรแกรม)
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const count = documents.filter((doc) => {
        const c = new Date(doc.createdAt);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
      }).length;
      return { label: MONTH_ABBR[d.getMonth()], count };
    });
  }, [documents]);

  let usage = 0;
  try {
    usage = storageUsageBytes();
  } catch {
    usage = 0;
  }
  const total = documents.length;
  const exportedPct = total ? Math.round((exported / total) * 100) : null;
  const usagePct = Math.round((usage / STORAGE_LIMIT_BYTES) * 1000) / 10;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Dashboard</h1>
        <a className="btn btn-primary" href="#/new">
          + สร้างบันทึกข้อความใหม่
        </a>
      </div>

      <div className="stats">
        <a className="stat" href="#/documents">
          <div className="stat-num">{documents.length}</div>
          <div className="stat-label">เอกสารทั้งหมด</div>
        </a>
        <div className="stat">
          <div className="stat-num">{drafts}</div>
          <div className="stat-label">ฉบับร่าง</div>
        </div>
        <div className="stat">
          <div className="stat-num">{exported}</div>
          <div className="stat-label">ส่งออกแล้ว</div>
        </div>
      </div>

      <section className="telemetry" aria-label="ภาพรวมข้อมูล">
        <div className="card">
          <h3 className="panel-title">สัดส่วนที่ส่งออกแล้ว</h3>
          <div className="gauge">
            <RadialGauge
              value={total ? exported : null}
              max={total}
              display={exportedPct === null ? '—' : String(exportedPct)}
              unit={exportedPct === null ? undefined : '%'}
              ariaLabel={total ? `ส่งออกแล้ว ${exported} จาก ${total} ฉบับ` : 'ยังไม่มีเอกสาร'}
            />
            <div className="gauge-caption">
              {total ? (
                <>
                  ส่งออกแล้ว <strong>{exported}</strong> จาก <strong>{total}</strong> ฉบับ
                </>
              ) : (
                'ยังไม่มีเอกสาร'
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="panel-title">เอกสารที่ยังมีข้อผิดพลาด</h3>
          <div className="gauge">
            <RadialGauge
              value={total ? withErrors : null}
              max={total}
              display={total ? String(withErrors) : '—'}
              unit={total ? 'ฉบับ' : undefined}
              tone={withErrors > 0 ? 'warning' : 'normal'}
              ariaLabel={total ? `มีข้อผิดพลาด ${withErrors} จาก ${total} ฉบับ` : 'ยังไม่มีเอกสาร'}
            />
            <div className="gauge-caption">
              {total ? (
                withErrors ? (
                  <>
                    <strong>{withErrors}</strong> จาก <strong>{total}</strong> ฉบับ ยังมีข้อผิดพลาดจากการตรวจเบื้องต้น
                  </>
                ) : (
                  'ไม่พบข้อผิดพลาดจากการตรวจเบื้องต้น'
                )
              ) : (
                'ยังไม่มีเอกสาร'
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="panel-title">เอกสารที่สร้าง 6 เดือนล่าสุด</h3>
          <MonthBars data={months} ariaLabel={months.map((m) => `${m.label} ${m.count} ฉบับ`).join(', ')} />
        </div>

        <div className="card">
          <h3 className="panel-title">พื้นที่จัดเก็บในเบราว์เซอร์</h3>
          <div className="gauge">
            <RadialGauge
              value={usage}
              max={STORAGE_LIMIT_BYTES}
              display={usagePct < 10 ? usagePct.toFixed(1) : String(Math.round(usagePct))}
              unit="%"
              tone={usagePct >= 80 ? 'critical' : usagePct >= 60 ? 'warning' : 'normal'}
              ariaLabel={`ใช้พื้นที่ประมาณ ${(usage / 1024).toFixed(1)} KB จากประมาณ 5 MB`}
            />
            <div className="gauge-caption">
              ใช้ประมาณ <strong>{(usage / 1024).toFixed(1)} KB</strong> จากขีดจำกัดทั่วไปราว 5 MB (ค่าประมาณ)
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>เอกสารที่แก้ไขล่าสุด</h2>
        {recent.length === 0 ? (
          <p className="empty">
            ยังไม่มีเอกสาร — กด <a href="#/new">สร้างบันทึกข้อความใหม่</a> เพื่อเริ่มต้น
          </p>
        ) : (
          <ul className="recent-list">
            {recent.map((d) => (
              <li key={d.id}>
                <a href={`#/edit/${encodeURIComponent(d.id)}`}>
                  <span className="recent-title">{d.fields.subject.trim() || '(ยังไม่มีชื่อเรื่อง)'}</span>
                  <span className="recent-meta">
                    {d.fields.date ? `ลงวันที่ ${formatThaiDate(d.fields.date, 'abbr', false)} · ` : ''}
                    แก้ไข {formatTimestamp(d.updatedAt)}
                  </span>
                  <span className={`status ${d.status}`}>{d.status === 'draft' ? 'ฉบับร่าง' : 'ส่งออกแล้ว'}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
