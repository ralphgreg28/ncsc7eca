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
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Left: Menu Toggle & Logo */}
          <div className="flex items-center">
            {/* Sidebar Toggle Button */}
            <button
              type="button"
              className="p-1.5 mr-3 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ease-in-out"
              onClick={onMenuClick}
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Logo & Title */}
            <Link to="/" className="flex items-center">
              <div className="h-9 w-9 relative flex-shrink-0">
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
              
              <div className="ml-2.5 flex flex-col">
                <div className="flex items-center">
                  <h1 className="font-bold text-sm text-blue-800 leading-tight">
                    NCSC 7 <span className="hidden sm:inline">- Central Visayas</span>
                  </h1>
                  <img 
                    src="https://cthemydbthfjlvtuqdnu.supabase.co/storage/v1/object/public/logos//favicon.svg" 
                    alt="Favicon" 
                    className="h-3 w-3 ml-1 hidden sm:block" 
                  />
                </div>
                <span className="text-xs text-blue-600 hidden sm:block">ECA Information Management System</span>
              </div>
            </Link>
          </div>

          {/* Right: User & Logout */}
          {user && (
            <div className="flex items-center">
              <div className="group relative">
                <div className="flex items-center bg-blue-50 hover:bg-blue-100 rounded-full py-1.5 px-3.5 mr-2 cursor-pointer transition-all duration-200 ease-in-out">
                  <div className="flex-shrink-0 h-7 w-7 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-800 text-xs sm:text-sm font-medium truncate max-w-[100px] sm:max-w-[150px]">
                      {user.first_name} {user.last_name}
                    </span>
                    <span className="text-blue-600 text-xs font-medium hidden sm:block">
                      {user.position}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 ml-1 text-gray-500" />
                </div>
                
                {/* Dropdown menu - can be implemented later */}
                <div className="hidden group-hover:block absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg py-1 z-20">
                  {/* Profile options can go here */}
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
