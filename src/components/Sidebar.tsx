import type { Route } from '../router';

const ITEMS: { href: string; label: string; match: Route['name'][] }[] = [
  { href: '#/', label: 'Dashboard', match: ['dashboard'] },
  { href: '#/new', label: 'สร้างเอกสาร', match: ['new', 'edit'] },
  { href: '#/documents', label: 'เอกสารทั้งหมด', match: ['documents'] },
  { href: '#/templates', label: 'แม่แบบ', match: ['templates'] },
  { href: '#/settings', label: 'ตั้งค่า', match: ['settings'] },
];

export default function Sidebar({ route, open }: { route: Route; open: boolean }) {
  return (
    <nav className={`sidebar${open ? ' open' : ''}`} aria-label="เมนูหลัก">
      <div className="brand">
        <div className="brand-name">RTAF Document Assistant</div>
        <div className="brand-sub">ผู้ช่วยจัดทำเอกสาร รุ่น 0.1</div>
      </div>
      <ul>
        {ITEMS.map((item, i) => (
          <li key={item.href}>
            <a href={item.href} className={item.match.includes(route.name) ? 'active' : ''}>
              <span className="nav-num">{i + 1}</span>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="sidebar-note">ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น ไม่ส่งออกไปภายนอก</p>
    </nav>
  );
}
