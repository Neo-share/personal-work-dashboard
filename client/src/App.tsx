import { Navigate, Route, Routes } from 'react-router-dom';
import PersonalWorkbenchPage from './pages/PersonalWorkbenchPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PersonalWorkbenchPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
