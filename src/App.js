import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminApp from './admin/AdminApp';
import FamilyViewer from './viewer/FamilyViewer';
import AdminGate from './admin/AdminGate';
import PasswordGate from './viewer/PasswordGate';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Family Viewer with password */}
        <Route path="/" element={
          <PasswordGate>
            <FamilyViewer />
          </PasswordGate>
        } />
        
        {/* Admin with different password */}
        <Route path="/admin/*" element={
          <AdminGate>
            <AdminApp />
          </AdminGate>
        } />
      </Routes>
    </BrowserRouter>
  );
}