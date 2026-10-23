import { useAppData } from '../state/AppData';
import { formatThaiDate, formatTimestamp } from '../lib/thaiDate';

export default function Dashboard() {
  const { documents } = useAppData();
  const drafts = documents.filter((d) => d.status === 'draft').length;
  const exported = documents.length - drafts;
  const recent = [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

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
