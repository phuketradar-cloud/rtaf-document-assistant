import { useEffect, useRef, useState } from 'react';
import { useAppData } from './state/AppData';
import Sidebar from './components/Sidebar';
import Notices from './components/Notices';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import DocumentList from './pages/DocumentList';
import Templates from './pages/Templates';
import Settings from './pages/Settings';
import Learn from './pages/Learn';
import { parseRoute, type Route } from './router';

const LEAVE_MESSAGE = 'มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้โดยไม่บันทึกหรือไม่?';

export default function App() {
  const { leaveGuardRef } = useAppData();
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [menuOpen, setMenuOpen] = useState(false);
  const lastHash = useRef(window.location.hash);
  const skipNext = useRef(false);

  useEffect(() => {
    const onHash = () => {
      if (skipNext.current) {
        skipNext.current = false;
        return;
      }
      const guard = leaveGuardRef.current;
      if (guard && guard() && !window.confirm(LEAVE_MESSAGE)) {
        skipNext.current = true;
        window.location.hash = lastHash.current;
        return;
      }
      lastHash.current = window.location.hash;
      setRoute(parseRoute(window.location.hash));
      setMenuOpen(false);
      window.scrollTo(0, 0);
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (leaveGuardRef.current?.()) {
        e.preventDefault();
        e.returnValue = LEAVE_MESSAGE;
      }
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [leaveGuardRef]);

  let page;
  switch (route.name) {
    case 'dashboard':
      page = <Dashboard />;
      break;
    case 'new':
      page = <Editor key="new" />;
      break;
    case 'edit':
      page = <Editor key={route.id} docId={route.id} />;
      break;
    case 'documents':
      page = <DocumentList />;
      break;
    case 'templates':
      page = <Templates />;
      break;
    case 'learn':
      page = <Learn />;
      break;
    case 'settings':
      page = <Settings />;
      break;
    default:
      page = (
        <div className="page">
          <h1>ไม่พบหน้าที่ต้องการ</h1>
          <p>
            <a href="#/">กลับไปหน้า Dashboard</a>
          </p>
        </div>
      );
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="btn btn-ghost menu-toggle" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
          ☰ เมนู
        </button>
        <span className="topbar-title">RTAF Document Assistant</span>
      </header>
      <Sidebar route={route} open={menuOpen} />
      <main className="main">{page}</main>
      <Notices />
    </div>
  );
}
