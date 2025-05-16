import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Time in milliseconds before showing the warning (5 minutes before expiry)
const WARNING_THRESHOLD = 5 * 60 * 1000;

// Check interval in milliseconds (every 30 seconds)
const CHECK_INTERVAL = 30 * 1000;

export function SessionTimeoutAlert() {
  const { user, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Function to check session expiration
  const checkSessionExpiration = useCallback(() => {
    if (!user) {
      setShowWarning(false);
      return;
    }

    // Get session data from localStorage
    const sessionDataStr = localStorage.getItem('sessionData');
    if (!sessionDataStr) {
      setShowWarning(false);
      return;
    }

    try {
      const sessionData = JSON.parse(sessionDataStr);
      const expiresAt = sessionData.expiresAt;
      const now = Date.now();
      const timeRemaining = expiresAt - now;

      // If less than WARNING_THRESHOLD milliseconds remaining, show warning
      if (timeRemaining <= WARNING_THRESHOLD && timeRemaining > 0) {
        setShowWarning(true);
        setTimeLeft(Math.floor(timeRemaining / 1000)); // Convert to seconds
      } else {
        setShowWarning(false);
      }
    } catch (error) {
      console.error('Error checking session expiration:', error);
      setShowWarning(false);
    }
  }, [user]);

  // Set up interval to check session expiration
  useEffect(() => {
    // Check immediately on mount
    checkSessionExpiration();

    // Set up interval
    const interval = setInterval(checkSessionExpiration, CHECK_INTERVAL);

    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, [checkSessionExpiration]);

  // Countdown timer effect
  useEffect(() => {
    let countdownInterval: number | undefined;

    if (showWarning && timeLeft !== null) {
      countdownInterval = window.setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime !== null && prevTime > 0) {
            return prevTime - 1;
          } else {
            clearInterval(countdownInterval);
            return 0;
          }
        });
      }, 1000);
    }

    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [showWarning, timeLeft]);

  // Function to extend the session
  const extendSession = useCallback(() => {
    // Simply trigger a user activity which will refresh the session via AuthContext
    document.dispatchEvent(new MouseEvent('mousedown'));
    setShowWarning(false);
  }, []);

  // Format time left as MM:SS
  const formatTimeLeft = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  if (!showWarning || !timeLeft) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-white rounded-lg shadow-lg border border-amber-200 p-4 animate-fade-in">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-6 w-6 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="ml-3 w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">
            Session Timeout Warning
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Your session will expire in <span className="font-bold">{formatTimeLeft(timeLeft)}</span>. Would you like to stay logged in?
          </p>
          <div className="mt-3 flex space-x-2">
            <button
              onClick={extendSession}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Stay Logged In
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Logout
            </button>
          </div>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            onClick={() => setShowWarning(false)}
            className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionTimeoutAlert;
