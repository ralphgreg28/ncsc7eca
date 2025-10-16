import { Menu, LogOut, User, ChevronDown } from 'lucide-react';
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
    <nav className={`bg-white w-full z-10 shadow-sm ${className}`}>
      <div className="px-3 sm:px-4">
        <div className="flex justify-between items-center h-14">
          {/* Left: Menu Toggle & Logo */}
          <div className="flex items-center">
            {/* Sidebar Toggle Button */}
            <button
              type="button"
              className="p-1.5 mr-2 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ease-in-out"
              onClick={onMenuClick}
              aria-label="Toggle sidebar"
            >
              <Menu className="h-4 w-4" />
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
                <h1 className="font-bold text-xs md:text-sm text-blue-800 leading-tight">
                  NCSC 7 <span className="hidden sm:inline">- Central Visayas</span>
                </h1>
                <span className="text-xs text-blue-600 hidden md:block">ECA IMS v3</span>
              </div>
            </Link>
          </div>

          {/* Right: User & Logout */}
          {user && (
            <div className="flex items-center gap-1">
              <div className="flex items-center bg-blue-50 hover:bg-blue-100 rounded-full py-1 px-2.5 cursor-pointer transition-all duration-200 ease-in-out">
                <div className="flex-shrink-0 h-6 w-6 bg-blue-100 rounded-full flex items-center justify-center mr-1.5">
                  <User className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-800 text-xs font-medium truncate max-w-[80px] sm:max-w-[120px]">
                    {user.first_name} {user.last_name}
                  </span>
                  <span className="text-blue-600 text-xs font-medium hidden sm:block">
                    {user.position}
                  </span>
                </div>
              </div>
              
              <button
                onClick={logout}
                className="p-1.5 rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-200 ease-in-out"
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
