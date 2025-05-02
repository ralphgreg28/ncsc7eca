import { Menu, LogOut, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  onMenuClick: () => void;
  className?: string;
}

function Navbar({ onMenuClick, className = '' }: NavbarProps) {
  const [imageError, setImageError] = useState(false);
  const { user, logout } = useAuth();

  return (
    <nav className={`bg-white w-full z-10 ${className}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-14">
          {/* Left: Menu Toggle & Logo */}
          <div className="flex items-center">
            {/* Sidebar Toggle Button */}
            <button
              type="button"
              className="p-1.5 mr-2 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
              onClick={onMenuClick}
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Logo & Title */}
            <Link to="/" className="flex items-center">
              <div className="h-8 w-8 relative flex-shrink-0">
                {!imageError ? (
                  <img
                    src="https://cthemydbthfjlvtuqdnu.supabase.co/storage/v1/object/public/logos//ncsc.png"
                    alt="NCSC Logo"
                    className="h-full w-auto object-contain"
                    onError={() => setImageError(true)}
                    loading="eager"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-blue-50 rounded">
                    <span className="text-blue-400 text-xs">Logo</span>
                  </div>
                )}
              </div>
              
              <div className="ml-2 flex flex-col">
                <h1 className="font-bold text-sm text-blue-800 leading-tight">
                  NCSC 7 <span className="hidden sm:inline">- Central Visayas</span>
                </h1>
                <span className="text-xs text-blue-600 hidden sm:block">ECA Information Management System</span>
              </div>
            </Link>
          </div>

          {/* Right: User & Logout */}
          {user && (
            <div className="flex items-center">
              <div className="flex items-center bg-blue-50 rounded-full py-1 px-3 mr-1">
                <User className="h-4 w-4 text-blue-600 mr-1.5" />
                <span className="text-gray-700 text-xs sm:text-sm font-medium truncate max-w-[100px] sm:max-w-[150px]">
                  {user.first_name}
                </span>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors duration-200"
                aria-label="Logout"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
