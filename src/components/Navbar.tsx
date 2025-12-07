import { Menu, LogOut, User, ChevronDown, FileCheck, Users, BarChart3, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';

interface NavbarProps {
  onMenuClick: () => void;
  isAtTop: boolean;
  className?: string;
}

function Navbar({ onMenuClick, isAtTop, className = '' }: NavbarProps) {
  const [imageError, setImageError] = useState(false);
  const [todayEncoded, setTodayEncoded] = useState(0);
  const [weekEncoded, setWeekEncoded] = useState(0);
  const [totalEncoded, setTotalEncoded] = useState(0);
  const [userTodayEncoded, setUserTodayEncoded] = useState(0);
  const [userWeekEncoded, setUserWeekEncoded] = useState(0);
  const [userTotalEncoded, setUserTotalEncoded] = useState(0);
  const [showMobileStats, setShowMobileStats] = useState(false);
  const { user, logout } = useAuth();

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
      const weekStart = startOfWeek(today, { weekStartsOn: 0 }); // Week starts on Sunday
      const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
      
      // Format the user's name to match the encoded_by format
      const encodedByName = `${user.last_name}, ${user.first_name}${user.middle_name ? ` ${user.middle_name}` : ''}`;
      
      // Get today's encoded count (all users)
      const { count: todayCount } = await supabase
        .from('citizens')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Encoded')
        .gte('encoded_date', startOfDay(today).toISOString())
        .lte('encoded_date', endOfDay(today).toISOString());

      // Get this week's encoded count (all users)
      const { count: weekCount } = await supabase
        .from('citizens')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Encoded')
        .gte('encoded_date', weekStart.toISOString())
        .lte('encoded_date', weekEnd.toISOString());

      // Get total encoded count (all time, all users)
      const { count: totalCount } = await supabase
        .from('citizens')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Encoded');

      // Get today's encoded count for current user
      const { count: userTodayCount } = await supabase
        .from('citizens')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Encoded')
        .eq('encoded_by', encodedByName)
        .gte('encoded_date', startOfDay(today).toISOString())
        .lte('encoded_date', endOfDay(today).toISOString());

      // Get this week's encoded count for current user
      const { count: userWeekCount } = await supabase
        .from('citizens')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Encoded')
        .eq('encoded_by', encodedByName)
        .gte('encoded_date', weekStart.toISOString())
        .lte('encoded_date', weekEnd.toISOString());

      // Get total encoded count for current user (all time)
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

  return (
    <nav className={`fixed top-0 left-0 right-0 bg-gradient-to-r from-white via-blue-50/30 to-white backdrop-blur-sm w-full z-50 shadow-md border-b border-blue-100/50 transition-transform duration-300 ease-in-out ${
      isAtTop ? 'translate-y-0' : '-translate-y-full'
    } ${className}`}>
      <div className="px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Left: Menu Toggle & Logo */}
          <div className="flex items-center gap-3">
            {/* Sidebar Toggle Button */}
            <button
              type="button"
              className="group relative p-2 rounded-xl text-gray-600 hover:text-blue-600 bg-white hover:bg-gradient-to-br hover:from-blue-50 hover:to-blue-100/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 transition-all duration-300 ease-out shadow-sm hover:shadow-md active:scale-95"
              onClick={onMenuClick}
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
            </button>

            {/* Logo & Title */}
            <Link to="/" className="group flex items-center gap-3 py-1.5 px-2 -ml-2 rounded-xl hover:bg-white/80 transition-all duration-300">
              <div className="h-10 w-10 relative flex-shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-1.5 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                {!imageError ? (
                  <img
                    src="https://cthemydbthfjlvtuqdnu.supabase.co/storage/v1/object/public/logos//ncsc.png"
                    alt="NCSC Logo"
                    className="h-full w-full object-contain rounded-lg"
                    onError={() => setImageError(true)}
                    loading="eager"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-white rounded-lg">
                    <span className="text-blue-600 text-xs font-bold">NC</span>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col">
                <h1 className="font-bold text-sm md:text-base bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 bg-clip-text text-transparent leading-tight group-hover:from-blue-600 group-hover:via-blue-500 group-hover:to-blue-600 transition-all duration-300">
                  NCSC 7 <span className="hidden sm:inline">- Central Visayas</span>
                </h1>
                <span className="text-xs font-medium bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent hidden md:block">
                  ECA IMS v3
                </span>
              </div>
            </Link>
          </div>

          {/* Right: Encoded Counters, User & Logout */}
          {user && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Mobile Stats Button */}
              <button
                onClick={() => setShowMobileStats(true)}
                className="xl:hidden group relative p-2.5 rounded-xl text-gray-600 hover:text-violet-600 bg-white hover:bg-gradient-to-br hover:from-violet-50 hover:to-violet-100/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 transition-all duration-300 ease-out shadow-sm hover:shadow-md border border-gray-100 hover:border-violet-200 active:scale-95"
                aria-label="View Stats"
                title="View Stats"
              >
                <BarChart3 className="h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110" />
              </button>

              {/* Desktop User's Encoded Stats */}
              <div className="hidden xl:flex items-center gap-2 bg-white rounded-2xl py-2 px-3.5 shadow-sm border border-violet-100/50 hover:border-violet-200 transition-all duration-300">
                <div className="flex-shrink-0 h-8 w-8 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center shadow-md">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-gray-500">Today:</span>
                    <span className="text-xs font-bold text-violet-600">{userTodayEncoded}</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-[10px] font-medium text-gray-500">Week:</span>
                    <span className="text-xs font-bold text-violet-600">{userWeekEncoded}</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-[10px] font-medium text-gray-500">Total:</span>
                    <span className="text-xs font-bold text-violet-600">{userTotalEncoded}</span>
                  </div>
                  <span className="text-[10px] font-medium text-violet-600">
                    Your Encoded
                  </span>
                </div>
              </div>

              <div className="group flex items-center bg-white hover:bg-gradient-to-br hover:from-blue-50 hover:to-blue-100/50 rounded-2xl py-2 px-2 sm:px-3.5 cursor-pointer transition-all duration-300 ease-out shadow-sm hover:shadow-md border border-blue-100/50 hover:border-blue-200">
                <div className="flex-shrink-0 h-8 w-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-2 sm:mr-2.5 shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-gray-800 text-xs font-semibold truncate max-w-[70px] sm:max-w-[100px] md:max-w-[140px] group-hover:text-blue-900 transition-colors duration-300">
                    {user.first_name} {user.last_name}
                  </span>
                  <span className="text-blue-600 text-[10px] font-medium hidden sm:block truncate max-w-[100px] md:max-w-[140px]">
                    {user.position}
                  </span>
                </div>
              </div>
              
              <button
                onClick={logout}
                className="group relative p-2.5 rounded-xl text-gray-600 hover:text-red-600 bg-white hover:bg-gradient-to-br hover:from-red-50 hover:to-red-100/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 transition-all duration-300 ease-out shadow-sm hover:shadow-md border border-gray-100 hover:border-red-200 active:scale-95"
                aria-label="Logout"
                title="Logout"
              >
                <LogOut className="h-4 w-4 sm:h-4.5 sm:w-4.5 transition-transform duration-300 group-hover:rotate-12" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Stats Modal */}
      {showMobileStats && user && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 xl:hidden" 
            onClick={() => setShowMobileStats(false)}
          />
          <div className="fixed inset-x-4 top-20 z-50 xl:hidden animate-in slide-in-from-top-4 duration-300">
            <div className="bg-white rounded-2xl shadow-2xl border border-blue-100 overflow-hidden max-w-md mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-violet-50 border-b border-blue-100">
                <h3 className="font-bold text-sm bg-gradient-to-r from-blue-700 to-violet-700 bg-clip-text text-transparent">
                  Encoding Statistics
                </h3>
                <button
                  onClick={() => setShowMobileStats(false)}
                  className="p-1.5 rounded-lg text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200 active:scale-95"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Stats Content */}
              <div className="p-4 space-y-3">
                {/* User's Encoded Stats */}
                <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-xl p-4 border border-violet-200/50 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-shrink-0 h-8 w-8 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-bold text-violet-900">Your Encoded</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/80 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-violet-600">{userTodayEncoded}</div>
                      <div className="text-xs text-gray-600 mt-1">Today</div>
                    </div>
                    <div className="bg-white/80 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-violet-600">{userWeekEncoded}</div>
                      <div className="text-xs text-gray-600 mt-1">This Week</div>
                    </div>
                    <div className="bg-white/80 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-violet-600">{userTotalEncoded}</div>
                      <div className="text-xs text-gray-600 mt-1">All Time</div>
                    </div>
                  </div>
                </div>

                {/* System-wide Encoded Stats */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200/50 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-shrink-0 h-8 w-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-bold text-blue-900">All Users Encoded</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/80 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-blue-600">{todayEncoded}</div>
                      <div className="text-xs text-gray-600 mt-1">Today</div>
                    </div>
                    <div className="bg-white/80 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-blue-600">{weekEncoded}</div>
                      <div className="text-xs text-gray-600 mt-1">This Week</div>
                    </div>
                    <div className="bg-white/80 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-blue-600">{totalEncoded}</div>
                      <div className="text-xs text-gray-600 mt-1">All Time</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}

export default Navbar;
