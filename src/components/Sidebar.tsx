import { X, Home, Users, Settings, AlertTriangle, UserPlus, ChevronRight, Info, ClipboardList, BarChart2, Gift, PieChart, User as UserIcon, Users as UsersIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  isAtTop: boolean;
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

function Sidebar({ open, onClose, isAtTop }: SidebarProps) {
  const { user } = useAuth();
  const [todayEncoded, setTodayEncoded] = useState(0);
  const [weekEncoded, setWeekEncoded] = useState(0);
  const [totalEncoded, setTotalEncoded] = useState(0);
  const [userTodayEncoded, setUserTodayEncoded] = useState(0);
  const [userWeekEncoded, setUserWeekEncoded] = useState(0);
  const [userTotalEncoded, setUserTotalEncoded] = useState(0);

  useEffect(() => {
    if (user) {
      fetchEncodedCounts();
      // Refresh counts every 30 seconds
      const interval = setInterval(fetchEncodedCounts, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchEncodedCounts = async () => {
    if (!user) return;
    
    try {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
      
      const encodedByName = `${user.last_name}, ${user.first_name}${user.middle_name ? ` ${user.middle_name}` : ''}`;
      
      const { count: todayCount } = await supabase
        .from('citizens')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Encoded')
        .gte('encoded_date', startOfDay(today).toISOString())
        .lte('encoded_date', endOfDay(today).toISOString());

      const { count: weekCount } = await supabase
        .from('citizens')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Encoded')
        .gte('encoded_date', weekStart.toISOString())
        .lte('encoded_date', weekEnd.toISOString());

      const { count: totalCount } = await supabase
        .from('citizens')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Encoded');

      const { count: userTodayCount } = await supabase
        .from('citizens')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Encoded')
        .eq('encoded_by', encodedByName)
        .gte('encoded_date', startOfDay(today).toISOString())
        .lte('encoded_date', endOfDay(today).toISOString());

      const { count: userWeekCount } = await supabase
        .from('citizens')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Encoded')
        .eq('encoded_by', encodedByName)
        .gte('encoded_date', weekStart.toISOString())
        .lte('encoded_date', weekEnd.toISOString());

      const { count: userTotalCount } = await supabase
        .from('citizens')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Encoded')
        .eq('encoded_by', encodedByName);

      setTodayEncoded(todayCount || 0);
      setWeekEncoded(weekCount || 0);
      setTotalEncoded(totalCount || 0);
      setUserTodayEncoded(userTodayCount || 0);
      setUserWeekEncoded(userWeekCount || 0);
      setUserTotalEncoded(userTotalCount || 0);
    } catch (error) {
      console.error('Error fetching encoded counts:', error);
    }
  };

  const items: NavItem[] = [
    { to: '/', icon: <Home size={18} />, label: 'Home' },
    { to: '/summary', icon: <PieChart size={18} />, label: 'Summary' },
    { to: '/dashboard', icon: <BarChart2 size={18} />, label: 'Dashboard' },

    
    ...((user?.position === 'PDO' || user?.position === 'Administrator') ? [
    { to: '/citizens/new', icon: <Users size={18} />, label: 'SC Registration', badge: 'Hot!' },
    { to: '/citizens/list', icon: <Users size={18} />, label: 'Senior Citizens Records' },
    { to: '/citizens/encoded-monitor', icon: <ClipboardList size={18} />, label: 'Encoded Status Monitor' },
    { to: '/stakeholders', icon: <UserPlus size={18} />, label: 'Stakeholders Directory' },

 ] : []),
    ...( user?.position === 'Administrator' ? [
    { to: '/citizens/duplicates', icon: <AlertTriangle size={18} />, label: 'Duplicate Check' },
  ] : []),

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
          className="fixed inset-0 z-20 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 md:hidden" 
          onClick={onClose}
        />
      )}

      {/* Mobile sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-80 max-w-[85vw] bg-gradient-to-b from-white via-blue-50/20 to-white transform transition-all duration-300 ease-out md:hidden border-r border-blue-100/50
        ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between h-16 px-4 sm:px-5 border-b border-blue-100/50 bg-gradient-to-r from-blue-50/50 to-transparent">
            <span className="font-bold text-base sm:text-lg bg-gradient-to-r from-blue-700 to-blue-600 bg-clip-text text-transparent">Navigation</span>
            <button
              className="group p-2.5 rounded-xl text-gray-600 hover:text-red-600 bg-white hover:bg-gradient-to-br hover:from-red-50 hover:to-red-100/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 transition-all duration-300 shadow-sm hover:shadow-md active:scale-95 touch-manipulation"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <span className="sr-only">Close sidebar</span>
              <X className="h-6 w-6 transition-transform duration-300 group-hover:rotate-90" aria-hidden="true" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto py-4 px-3 sm:px-4 overscroll-contain">
            {/* Encoded Stats Section */}
            <div className="mb-4 space-y-3">
              {/* User's Encoded Stats */}
              <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-xl p-3.5 sm:p-4 border border-violet-200/50 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-shrink-0 h-7 w-7 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center">
                    <UserIcon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-bold text-violet-900">Your Encoded</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="bg-white/70 rounded-lg p-3 sm:p-3.5 touch-manipulation hover:bg-white transition-colors">
                    <div className="text-base sm:text-lg font-bold text-violet-600">{userTodayEncoded}</div>
                    <div className="text-[11px] text-gray-600 mt-0.5">Today</div>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 sm:p-3.5 touch-manipulation hover:bg-white transition-colors">
                    <div className="text-base sm:text-lg font-bold text-violet-600">{userWeekEncoded}</div>
                    <div className="text-[11px] text-gray-600 mt-0.5">Week</div>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 sm:p-3.5 touch-manipulation hover:bg-white transition-colors">
                    <div className="text-base sm:text-lg font-bold text-violet-600">{userTotalEncoded}</div>
                    <div className="text-[11px] text-gray-600 mt-0.5">Total</div>
                  </div>
                </div>
              </div>

              {/* System-wide Encoded Stats */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-3.5 sm:p-4 border border-blue-200/50 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-shrink-0 h-7 w-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <UsersIcon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-bold text-blue-900">All Encoded</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="bg-white/70 rounded-lg p-3 sm:p-3.5 touch-manipulation hover:bg-white transition-colors">
                    <div className="text-base sm:text-lg font-bold text-blue-600">{todayEncoded}</div>
                    <div className="text-[11px] text-gray-600 mt-0.5">Today</div>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 sm:p-3.5 touch-manipulation hover:bg-white transition-colors">
                    <div className="text-base sm:text-lg font-bold text-blue-600">{weekEncoded}</div>
                    <div className="text-[11px] text-gray-600 mt-0.5">Week</div>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 sm:p-3.5 touch-manipulation hover:bg-white transition-colors">
                    <div className="text-base sm:text-lg font-bold text-blue-600">{totalEncoded}</div>
                    <div className="text-[11px] text-gray-600 mt-0.5">Total</div>
                  </div>
                </div>
              </div>
            </div>

            <NavItems onItemClick={onClose} items={items} />
          </div>
          
          <div className="p-4 sm:p-5 border-t border-blue-100/50 bg-gradient-to-r from-blue-50/30 to-transparent">
            <p className="text-xs sm:text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">NCSC 7 ECA_IMS v3.0</p>
          </div>
        </div>
      </aside>
      
      {/* Desktop sidebar */}
      <aside 
        className={`hidden md:block fixed left-0 transition-all duration-300 ease-out ${
          isAtTop ? 'top-16 h-[calc(100vh-4rem)]' : 'top-0 h-screen'
        } ${open ? 'translate-x-0 w-64' : '-translate-x-64 w-0'}`}
      >
        <div className="w-64 h-full bg-gradient-to-b from-white via-blue-50/20 to-white border-r border-blue-100/50 shadow-lg flex flex-col">
          <div className="flex-1 overflow-y-auto py-4 px-3 overscroll-contain">
            {/* Encoded Stats Section */}
            <div className="mb-4 space-y-2">
              {/* User's Encoded Stats */}
              <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-xl p-3 border border-violet-200/50 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-shrink-0 h-6 w-6 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center">
                    <UserIcon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-xs font-bold text-violet-900">Your Encoded</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/60 rounded-lg p-2">
                    <div className="text-xs font-bold text-violet-600">{userTodayEncoded}</div>
                    <div className="text-[10px] text-gray-600">Today</div>
                  </div>
                  <div className="bg-white/60 rounded-lg p-2">
                    <div className="text-xs font-bold text-violet-600">{userWeekEncoded}</div>
                    <div className="text-[10px] text-gray-600">Week</div>
                  </div>
                  <div className="bg-white/60 rounded-lg p-2">
                    <div className="text-xs font-bold text-violet-600">{userTotalEncoded}</div>
                    <div className="text-[10px] text-gray-600">Total</div>
                  </div>
                </div>
              </div>

              {/* System-wide Encoded Stats */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-3 border border-blue-200/50 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-shrink-0 h-6 w-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <UsersIcon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-xs font-bold text-blue-900">All Encoded</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/60 rounded-lg p-2">
                    <div className="text-xs font-bold text-blue-600">{todayEncoded}</div>
                    <div className="text-[10px] text-gray-600">Today</div>
                  </div>
                  <div className="bg-white/60 rounded-lg p-2">
                    <div className="text-xs font-bold text-blue-600">{weekEncoded}</div>
                    <div className="text-[10px] text-gray-600">Week</div>
                  </div>
                  <div className="bg-white/60 rounded-lg p-2">
                    <div className="text-xs font-bold text-blue-600">{totalEncoded}</div>
                    <div className="text-[10px] text-gray-600">Total</div>
                  </div>
                </div>
              </div>
            </div>

            <NavItems items={items} />
          </div>
          
          <div className="p-4 border-t border-blue-100/50 bg-gradient-to-r from-blue-50/30 to-transparent">
            <p className="text-xs font-medium bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">NCSC 7 ECA_IMS v3.0</p>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavItems({ items, onItemClick = () => {} }: NavItemsProps) {
  return (
    <nav className="space-y-2">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `group relative flex items-center justify-between px-4 py-3.5 text-sm font-semibold rounded-xl transition-all duration-300 ease-out overflow-hidden touch-manipulation
            ${isActive 
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]' 
              : 'text-gray-700 hover:text-blue-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100/50 hover:shadow-md active:scale-[0.98]'
            }`
          }
          onClick={onItemClick}
          end={item.to === '/'}
        >
          {({ isActive }) => (
            <>
              <div className="flex items-center relative z-10 min-w-0">
                <span className={`mr-3 sm:mr-3.5 flex-shrink-0 transition-all duration-300 ${
                  isActive 
                    ? 'text-white scale-110' 
                    : 'text-gray-500 group-hover:text-blue-600 group-hover:scale-110'
                }`}>
                  {item.icon}
                </span>
                <span className="transition-all duration-300 truncate">{item.label}</span>
              </div>
              
              {item.badge && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-300 flex-shrink-0 ${
                  isActive 
                    ? 'bg-white/20 text-white backdrop-blur-sm' 
                    : 'bg-gradient-to-r from-orange-400 to-red-500 text-white shadow-md'
                }`}>
                  {item.badge}
                </span>
              )}
              
              {!item.badge && (
                <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-all duration-300 ${
                  isActive 
                    ? 'text-white translate-x-0 opacity-100' 
                    : 'text-blue-400 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                }`} />
              )}
              
              {/* Animated gradient background for hover */}
              {!isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-blue-400/5 to-blue-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-out" />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default Sidebar;
