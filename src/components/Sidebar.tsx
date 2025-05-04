import { X, Home, Users, Settings, AlertTriangle, UserPlus, ChevronRight, Info } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}

interface NavItemsProps {
  items: NavItem[];
  onItemClick?: () => void;
}

function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();

  const items: NavItem[] = [
    { to: '/', icon: <Home size={18} />, label: 'Dashboard' },
    { 
      to: '/citizens/new', 
      icon: <Users size={18} />, 
      label: 'SC Registration',
      badge: 'Hot!'
    },
    { to: '/citizens/list', icon: <Users size={18} />, label: 'Senior Citizens Records' },
    { to: '/stakeholders', icon: <UserPlus size={18} />, label: 'Stakeholders Directory' },
    { to: '/citizens/duplicates', icon: <AlertTriangle size={18} />, label: 'Duplicate Check' },
    ...(user?.position === 'Administrator' ? [
      { to: '/settings', icon: <Settings size={18} />, label: 'Settings' }
    ] : []),
    { to: '/about', icon: <Info size={18} />, label: 'About' }
  ];

  return (
    <>
      {/* Mobile sidebar backdrop */}
      {open && (
        <div 
          className="fixed inset-0 z-20 bg-gray-600 bg-opacity-75 transition-opacity md:hidden backdrop-blur-sm" 
          onClick={onClose}
        />
      )}

      {/* Mobile sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white transform transition-transform duration-300 ease-in-out md:hidden
        ${open ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between h-14 px-4 border-b border-gray-100">
            <span className="font-bold text-base text-blue-800">Navigation</span>
            <button
              className="p-1.5 rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors duration-200"
              onClick={onClose}
            >
              <span className="sr-only">Close sidebar</span>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto py-4">
            <NavItems onItemClick={onClose} items={items} />
          </div>
          
          <div className="p-4 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
            <p>NCSC 7 ECA_IMS v1.0</p>
          </div>
        </div>
      </aside>
      
      {/* Desktop sidebar */}
      <aside 
        className={`hidden md:block fixed top-14 left-0 h-[calc(100vh-3.5rem)] transition-all duration-300 ease-in-out ${
          open ? 'translate-x-0 w-64' : '-translate-x-64 w-0'
        }`}
      >
        <div className="w-64 h-full bg-white border-r border-gray-100 shadow-sm flex flex-col">
          <div className="flex-1 overflow-y-auto py-4">
            <NavItems items={items} />
          </div>
          
          <div className="p-4 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
            <p>NCSC 7 ECA_IMS v1.0</p>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavItems({ items, onItemClick = () => {} }: NavItemsProps) {
  return (
    <nav className="px-3 space-y-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 
            ${isActive 
              ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500' 
              : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50 border-l-4 border-transparent'
            }`
          }
          onClick={onItemClick}
          end={item.to === '/'}
        >
          {({ isActive }) => (
            <>
              <div className="flex items-center">
                <span className={`mr-3 ${isActive ? 'text-blue-600' : 'text-gray-500 group-hover:text-blue-500'}`}>
                  {item.icon}
                </span>
                {item.label}
              </div>
              
              {item.badge && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  {item.badge}
                </span>
              )}
              
              {!item.badge && isActive && (
                <ChevronRight className="h-4 w-4 text-blue-500" />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default Sidebar;
