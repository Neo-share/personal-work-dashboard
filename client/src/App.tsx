import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import ChatPanel from './components/ChatPanel';
import GraphPage from './pages/GraphPage';
import MyWorkbenchPage from './pages/MyWorkbenchPage';
import PeoplePage from './pages/PeoplePage';
import PersonalWorkbenchPage from './pages/PersonalWorkbenchPage';
import RepositoriesPage from './pages/RepositoriesPage';
import RequirementDetailPage from './pages/RequirementDetailPage';
import RequirementsPage from './pages/RequirementsPage';
import ScanCenterPage from './pages/ScanCenterPage';
import WeeklyReportPage from './pages/WeeklyReportPage';

const devNavItems = [
  { to: '/dev-dashboard', label: '驾驶舱' },
  { to: '/requirements', label: '工作列表' },
  { to: '/weekly-report', label: '周报' },
  { to: '/repositories', label: '仓库' },
  { to: '/scan', label: '扫描' },
  { to: '/graph', label: '关系图谱' },
  { to: '/people', label: '协作联系人' },
];

function DevShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="brand-title">个人驾驶舱</h1>
          <p className="brand-subtitle">管理个人工作项、协作联系人与上下文资源</p>
        </div>
        <nav className="app-nav">
          {devNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dev-dashboard'}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/">个人工作台</NavLink>
        </nav>
      </header>
      <main className="app-main">{children}</main>
      <ChatPanel />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PersonalWorkbenchPage />} />
      <Route
        path="/dev-dashboard"
        element={
          <DevShell>
            <MyWorkbenchPage />
          </DevShell>
        }
      />
      <Route
        path="/requirements"
        element={
          <DevShell>
            <RequirementsPage />
          </DevShell>
        }
      />
      <Route
        path="/requirements/:id"
        element={
          <DevShell>
            <RequirementDetailPage />
          </DevShell>
        }
      />
      <Route
        path="/weekly-report"
        element={
          <DevShell>
            <WeeklyReportPage />
          </DevShell>
        }
      />
      <Route
        path="/graph"
        element={
          <DevShell>
            <GraphPage />
          </DevShell>
        }
      />
      <Route
        path="/repositories"
        element={
          <DevShell>
            <RepositoriesPage />
          </DevShell>
        }
      />
      <Route
        path="/people"
        element={
          <DevShell>
            <PeoplePage />
          </DevShell>
        }
      />
      <Route
        path="/scan"
        element={
          <DevShell>
            <ScanCenterPage />
          </DevShell>
        }
      />
      <Route path="/settings" element={<Navigate to="/scan" replace />} />
    </Routes>
  );
}
