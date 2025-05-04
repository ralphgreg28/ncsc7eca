import { ChevronRight, Database, FileText, Home, MessageSquare, Users } from 'lucide-react';
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Settings() {
  const location = useLocation();
  const { user } = useAuth();

  // Redirect non-administrators away from settings
  if (!user || user.position !== 'Administrator') {
    return <Navigate to="/" replace />;
  }

  const menuItems = [
    {
      title: 'Broadcast Messages',
      path: '/settings/broadcast',
      icon: <MessageSquare className="w-5 h-5" />,
      description: 'Manage temporary messages shown to users after login.',
    },
    {
      title: 'Address Management',
      path: '/settings/address',
      icon: <Database className="w-5 h-5" />,
      description: 'Manage regions, provinces, cities, and barangays.',
    },
    {
      title: 'Import / Export',
      path: '/settings/import-export',
      icon: <FileText className="w-5 h-5" />,
      description: 'Import and export senior citizen records.',
    },
    {
      title: 'User Management',
      path: '/settings/users',
      icon: <Users className="w-5 h-5" />,
      description: 'Manage system users and their roles.',
    },
{
      title: 'Audit Trail',
      path: '/settings/audit',
       icon: <Users className="w-5 h-5" />,
      description: 'To monitor changes in the database.',
    },
    
  ];

  const getCurrentPageTitle = () => {
    const currentItem = menuItems.find((item) =>
      location.pathname.startsWith(item.path)
    );
    return currentItem?.title || 'Settings';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center text-sm text-gray-600">
        <Link to="/" className="flex items-center hover:text-gray-900">
          <Home className="w-4 h-4 mr-2" />
          Home
        </Link>
        <ChevronRight className="w-4 h-4 mx-2" />
        <Link to="/settings" className="hover:text-gray-900">
          Settings
        </Link>
        {location.pathname !== '/settings' && (
          <>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span className="text-gray-900">{getCurrentPageTitle()}</span>
          </>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-64 flex-shrink-0 bg-white shadow-lg rounded-lg">
          <nav>
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
              <p className="text-sm text-gray-500">Manage system configuration</p>
            </div>
            <div className="space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block p-4 rounded-md transition-all duration-200 ease-in-out ${
                    location.pathname.startsWith(item.path)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    {item.icon}
                    <div className="ml-4">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-sm text-gray-500">{item.description}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 bg-white rounded-lg shadow-lg">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default Settings;
