import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CitizenForm from './pages/CitizenForm';
import CitizenList from './pages/CitizenList';
import DuplicateCheck from './pages/DuplicateCheck';
import Settings from './pages/Settings';
import AddressManagement from './pages/AddressManagement';
import ImportExport from './pages/ImportExport';
import UserManagement from './pages/UserManagement';
import StakeholdersDirectory from './pages/StakeholdersDirectory';
import AuditTrail from './pages/AuditTrail';
import NotFound from './pages/NotFound';
import Login from './pages/Login';
import Register from './pages/Register';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="citizens/new" element={<CitizenForm />} />
          <Route path="citizens/list" element={<CitizenList />} />
          <Route path="citizens/duplicates" element={<DuplicateCheck />} />
          <Route path="stakeholders" element={<StakeholdersDirectory />} />
         
          <Route path="settings" element={<Settings />}>
            <Route index element={<Navigate to="address" replace />} />
            <Route path="address" element={<AddressManagement />} />
            <Route path="import-export" element={<ImportExport />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="audit" element={<AuditTrail />} />
          </Route>
          <Route path="404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;