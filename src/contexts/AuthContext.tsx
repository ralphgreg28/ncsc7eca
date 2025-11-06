import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Staff } from '../lib/auth';
import { checkSession, logoutUser, getCurrentUser } from '../lib/auth';

interface AuthContextType {
  user: Staff | null;
  loading: boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: () => {},
  refreshUser: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Function to refresh user data
  const refreshUser = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  };

  // Check session on initial load
  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('Initializing auth...');
        const { valid, user: sessionUser } = checkSession();
        console.log('Session check result:', { valid, hasUser: !!sessionUser });
        
        if (valid && sessionUser) {
          console.log('Setting user from session:', sessionUser.username);
          setUser(sessionUser);
        } else {
          // Session is invalid or expired
          console.log('No valid session found');
          setUser(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Set up session check interval (every minute)
  useEffect(() => {
    const sessionCheckInterval = setInterval(() => {
      const { valid } = checkSession();
      if (!valid && user) {
        // Session expired while user was logged in
        setUser(null);
        navigate('/login');
      }
    }, 60000); // Check every minute

    return () => clearInterval(sessionCheckInterval);
  }, [user, navigate]);

  // Set up activity listener to extend session
  useEffect(() => {
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    const handleUserActivity = () => {
      if (user) {
        // This will refresh the session expiration time
        checkSession();
      }
    };

    // Add event listeners for user activity
    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    return () => {
      // Clean up event listeners
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [user]);

  const logout = () => {
    // Clear any stored user-specific data from localStorage
    if (user) {
      localStorage.removeItem(`defaultValidationDate_${user.id}`);
    }
    
    logoutUser();
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
