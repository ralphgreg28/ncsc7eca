import { Outlet, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import SessionTimeoutAlert from './SessionTimeoutAlert';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { checkSession } from '../lib/auth';

function Layout() {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsAtTop(scrollPosition < 10);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle logout with message
  const handleLogout = useCallback(async (message = 'You have been logged out', type: 'info' | 'error' = 'info') => {
    try {
      await logout();
      if (type === 'info') {
        toast.info(message);
      } else {
        toast.error(message);
      }
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [logout, navigate]);

  // Handle offline status
  useEffect(() => {
    const handleOffline = () => {
      // Log out when user goes offline
      handleLogout('You have been logged out because you went offline', 'error');
    };

    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleLogout]);

  // Periodically check session validity
  useEffect(() => {
    if (!user) return;

    const sessionCheckInterval = setInterval(() => {
      const { valid } = checkSession();
      if (!valid) {
        handleLogout('Your session has expired', 'info');
      }
    }, 60000); // Check every minute

    return () => clearInterval(sessionCheckInterval);
  }, [user, handleLogout]);

  // Auth check
  useEffect(() => {
    console.log('Layout auth check:', { loading, hasUser: !!user });
    if (!loading && !user) {
      console.log('No authenticated user, redirecting to login...');
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    console.log('Layout is loading...');
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="w-16 h-16 relative">
          <div className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
        </div>
        <p className="mt-4 text-gray-700 font-medium">Loading...</p>
      </div>
    );
  }

  if (!user) {
    console.log('Layout has no user, returning null');
    return null;
  }

  console.log('Layout rendering with user:', user.username);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Navbar - Fixed at top */}
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} isAtTop={isAtTop} />

      {/* Main layout: sidebar + content with top padding for fixed navbar */}
      <div className="flex flex-1 relative pt-16">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} isAtTop={isAtTop} />

        <main 
          className={`flex-1 transition-all duration-300 ${
            sidebarOpen ? 'md:ml-64' : ''
          }`}
        >
          <div className="p-3 md:p-4 lg:p-5">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 py-2 text-center text-xs shadow-inner">
        <div className="px-4">
          <p>Developed by: Ralph Jiene D. Gregorio, PDO III | © {new Date().getFullYear()} NCSC RO VII - Central Visayas</p>
        </div>
      </footer>

      {/* Session Timeout Alert */}
      <SessionTimeoutAlert />
    </div>
  );
}

export default Layout;
