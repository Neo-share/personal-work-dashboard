import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import ChatPanel from './components/ChatPanel';
import GraphPage from './pages/GraphPage';
import MyWorkbenchPage from './pages/MyWorkbenchPage';
import PeoplePage from './pages/PeoplePage';
import RepositoriesPage from './pages/RepositoriesPage';
import RequirementDetailPage from './pages/RequirementDetailPage';
import RequirementsPage from './pages/RequirementsPage';
import ScanCenterPage from './pages/ScanCenterPage';
import WeeklyReportPage from './pages/WeeklyReportPage';

const navItems = [
  { to: '/', label: '驾驶舱' },
  { to: '/requirements', label: '工作列表' },
  { to: '/weekly-report', label: '周报' },
  { to: '/repositories', label: '仓库' },
  { to: '/scan', label: '扫描' },
  { to: '/graph', label: '关系图谱' },
  { to: '/people', label: '协作联系人' },
];

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="brand-title">个人驾驶舱</h1>
          <p className="brand-subtitle">管理个人工作项、协作联系人与上下文资源</p>
        </div>
        <nav className="app-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<MyWorkbenchPage />} />
          <Route path="/requirements" element={<RequirementsPage />} />
          <Route path="/requirements/:id" element={<RequirementDetailPage />} />
          <Route path="/weekly-report" element={<WeeklyReportPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/repositories" element={<RepositoriesPage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/scan" element={<ScanCenterPage />} />
          <Route path="/settings" element={<Navigate to="/scan" replace />} />
        </Routes>
      </main>
      <ChatPanel />
    </div>
  );
}
