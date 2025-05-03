import { Outlet, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

// Inactivity timeout in milliseconds (15 minutes)
const INACTIVITY_TIMEOUT = 15 * 60 * 1000;
// Warning before logout (1 minute before)
const WARNING_BEFORE_TIMEOUT = 60 * 1000;

function Layout() {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    // Clear existing timers
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    setShowInactivityWarning(false);

    // Set warning timer
    warningTimerRef.current = setTimeout(() => {
      setShowInactivityWarning(true);
      setRemainingTime(Math.floor(WARNING_BEFORE_TIMEOUT / 1000));
      
      // Start countdown
      countdownIntervalRef.current = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE_TIMEOUT);

    // Set inactivity timer
    inactivityTimerRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIMEOUT);
  }, []);

  // Handle user activity
  useEffect(() => {
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    // Initial timer setup
    resetInactivityTimer();

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [resetInactivityTimer]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      toast.info('You have been logged out due to inactivity');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Stay active button handler
  const handleStayActive = () => {
    resetInactivityTimer();
  };

  // Auth check
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
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
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="sticky top-0 z-30 shadow-sm bg-white">
        <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      </header>

      {/* Main layout: sidebar + content */}
      <div className="flex flex-1 relative">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main 
          className={`flex-1 transition-all duration-300 ${
            sidebarOpen ? 'md:ml-64' : ''
          }`}
        >
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 py-4 text-center text-sm shadow-inner">
        <div className="max-w-7xl mx-auto px-4">
          <p>Developed by: Ralph Jiene D. Gregorio, Project Development Officer III, Central Visayas</p>
          <p className="text-xs mt-1 text-gray-400">© {new Date().getFullYear()} NCSC Clustered Regional Office IV</p>
        </div>
      </footer>

      {/* Inactivity Warning Modal */}
      {showInactivityWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl animate-fade-in">
            <div className="flex items-center mb-4 text-amber-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900">Session Timeout Warning</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Your session will expire due to inactivity in <span className="font-bold text-amber-600">{remainingTime}</span> seconds. 
              You will be automatically logged out to protect your security.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button 
                onClick={handleLogout} 
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Logout Now
              </button>
              <button 
                onClick={handleStayActive} 
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Stay Active
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Layout;
