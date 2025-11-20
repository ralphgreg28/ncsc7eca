import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import BroadcastMessageAlert from './components/BroadcastMessageAlert';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import CitizenForm from './pages/CitizenForm';
import CitizenList from './pages/CitizenList';
import DuplicateCheck from './pages/DuplicateCheck';
import Settings from './pages/Settings';
import AddressManagement from './pages/AddressManagement';
import ImportExport from './pages/ImportExport';
import UserManagement from './pages/UserManagement';
import BroadcastMessages from './pages/BroadcastMessages';
import StakeholdersDirectory from './pages/StakeholdersDirectory';
import AuditTrail from './pages/AuditTrail';
import EncodedStatusMonitor from './pages/EncodedStatusMonitor';
import Summary from './pages/Summary';
import NotFoundRedirect from './components/NotFoundRedirect';
import Login from './pages/Login';
import Register from './pages/Register';
import About from './pages/About';

function App() {
  return (
    <AuthProvider>
      <BroadcastMessageAlert />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="summary" element={<Summary />} />
          <Route path="citizens/new" element={<CitizenForm />} />
          <Route path="citizens/list" element={<CitizenList />} />
          <Route path="citizens/duplicates" element={<DuplicateCheck />} />
          <Route path="citizens/encoded-monitor" element={<EncodedStatusMonitor />} />
          <Route path="stakeholders" element={<StakeholdersDirectory />} />
          <Route path="about" element={<About />} />
         
          <Route path="settings" element={<Settings />}>
            <Route index element={<Navigate to="broadcast" replace />} />
            <Route path="broadcast" element={<BroadcastMessages />} />
            <Route path="address" element={<AddressManagement />} />
            <Route path="import-export" element={<ImportExport />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="audit" element={<AuditTrail />} />
          </Route>
          <Route path="*" element={<NotFoundRedirect />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
