import { useMemo, useState } from 'react';
import { useAppData } from '../state/AppData';
import { navigate } from '../router';
import { formatThaiDate, formatTimestamp } from '../lib/thaiDate';

export default function DocumentList() {
  const { documents, deleteDocument, duplicateDocument, notify } = useAppData();
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents
      .filter((d) => {
        if (q && !`${d.fields.subject} ${d.fields.docNumber}`.toLowerCase().includes(q)) return false;
        if ((from || to) && !d.fields.date) return false;
        if (from && d.fields.date < from) return false;
        if (to && d.fields.date > to) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [documents, query, from, to]);

  const onDuplicate = (id: string) => {
    const copy = duplicateDocument(id);
    if (!copy) return;
    notify('info', 'ทำสำเนาแล้ว — สำเนามีข้อมูลเหมือนต้นฉบับทุกช่อง โปรดตรวจและแก้ไขเลขที่หนังสือและวันที่');
    navigate(`/edit/${encodeURIComponent(copy.id)}`);
  };

  const onDelete = (id: string, subject: string) => {
    const name = subject.trim() || '(ยังไม่มีชื่อเรื่อง)';
    if (!window.confirm(`ลบเอกสาร “${name}” หรือไม่?\nการลบไม่สามารถกู้คืนได้ (ยกเว้นมีไฟล์สำรองข้อมูล)`)) return;
    if (deleteDocument(id)) notify('success', `ลบเอกสาร “${name}” แล้ว`);
  };

  const filtering = query || from || to;

  return (
    <div className="page">
      <div className="page-head">
        <h1>เอกสารทั้งหมด</h1>
        <a className="btn btn-primary" href="#/new">
          + สร้างบันทึกข้อความใหม่
        </a>
      </div>

      <div className="card filters">
        <label>
          ค้นหาจากชื่อเรื่องหรือเลขที่
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="พิมพ์คำค้นหา" />
        </label>
        <label>
          วันที่ในเอกสาร ตั้งแต่
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          ถึง
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {filtering && (
          <button
            className="btn"
            onClick={() => {
              setQuery('');
              setFrom('');
              setTo('');
            }}
          >
            ล้างการค้นหา
          </button>
        )}
      </div>

      <p className="meta">
        พบ {results.length} จาก {documents.length} ฉบับ
      </p>

      {results.length === 0 ? (
        <p className="empty card">{documents.length === 0 ? 'ยังไม่มีเอกสาร' : 'ไม่พบเอกสารที่ตรงกับการค้นหา'}</p>
      ) : (
        <table className="doc-table">
          <thead>
            <tr>
              <th>เรื่อง</th>
              <th>ที่</th>
              <th>วันที่ในเอกสาร</th>
              <th>แก้ไขล่าสุด</th>
              <th>สถานะ</th>
              <th>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {results.map((d) => (
              <tr key={d.id}>
                <td data-label="เรื่อง">
                  <a href={`#/edit/${encodeURIComponent(d.id)}`}>{d.fields.subject.trim() || '(ยังไม่มีชื่อเรื่อง)'}</a>
                  {d.copiedFromId && <span className="tag">สำเนา</span>}
                </td>
                <td data-label="ที่">{d.fields.docNumber || '-'}</td>
                <td data-label="วันที่ในเอกสาร">{d.fields.date ? formatThaiDate(d.fields.date, 'abbr', false) : '-'}</td>
                <td data-label="แก้ไขล่าสุด">{formatTimestamp(d.updatedAt)}</td>
                <td data-label="สถานะ">
                  <span className={`status ${d.status}`}>{d.status === 'draft' ? 'ฉบับร่าง' : 'ส่งออกแล้ว'}</span>
                </td>
                <td data-label="การจัดการ" className="actions">
                  <a className="btn btn-small" href={`#/edit/${encodeURIComponent(d.id)}`}>
                    เปิดแก้ไข
                  </a>
                  <button className="btn btn-small" onClick={() => onDuplicate(d.id)}>
                    ทำสำเนา
                  </button>
                  <button className="btn btn-small btn-danger" onClick={() => onDelete(d.id, d.fields.subject)}>
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
