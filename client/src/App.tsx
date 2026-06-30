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
import SalesPipelinePage from './pages/sales/SalesPipelinePage';
import SalesCustomersPage from './pages/sales/SalesCustomersPage';
import SalesCustomerDetailPage from './pages/sales/SalesCustomerDetailPage';
import SalesOpportunityDetailPage from './pages/sales/SalesOpportunityDetailPage';

const devNavItems = [
  { to: '/dev-dashboard', label: '驾驶舱' },
  { to: '/requirements', label: '工作列表' },
  { to: '/weekly-report', label: '周报' },
  { to: '/repositories', label: '仓库' },
  { to: '/scan', label: '扫描' },
  { to: '/graph', label: '关系图谱' },
  { to: '/people', label: '协作联系人' },
];

const salesNavItems = [
  { to: '/sales', label: '销售管线', end: true },
  { to: '/sales/customers', label: '客户管理' },
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
          <NavLink to="/sales">销售驾驶舱</NavLink>
          <NavLink to="/">个人工作台</NavLink>
        </nav>
      </header>
      <main className="app-main">{children}</main>
      <ChatPanel />
    </div>
  );
}

function SalesShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="brand-title">销售驾驶舱</h1>
          <p className="brand-subtitle">金融 B2C 销售管线 · 客户 · 合规 · 跟进</p>
        </div>
        <nav className="app-nav">
          {salesNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/">个人工作台</NavLink>
          <NavLink to="/dev-dashboard">开发驾驶舱</NavLink>
        </nav>
      </header>
      <main className="app-main">{children}</main>
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
      <Route
        path="/sales"
        element={
          <SalesShell>
            <SalesPipelinePage />
          </SalesShell>
        }
      />
      <Route
        path="/sales/customers"
        element={
          <SalesShell>
            <SalesCustomersPage />
          </SalesShell>
        }
      />
      <Route
        path="/sales/customers/:id"
        element={
          <SalesShell>
            <SalesCustomerDetailPage />
          </SalesShell>
        }
      />
      <Route
        path="/sales/opportunities/:id"
        element={
          <SalesShell>
            <SalesOpportunityDetailPage />
          </SalesShell>
        }
      />
      <Route path="/settings" element={<Navigate to="/scan" replace />} />
    </Routes>
  );
}
