import { Menu, LogOut, User, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  onMenuClick: () => void;
  isAtTop: boolean;
  className?: string;
}

function Navbar({ onMenuClick, isAtTop, className = '' }: NavbarProps) {
  const [imageError, setImageError] = useState(false);
  const { user, logout } = useAuth();

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

          {/* Right: User & Logout */}
          {user && (
            <div className="flex items-center gap-2">
              <div className="group flex items-center bg-white hover:bg-gradient-to-br hover:from-blue-50 hover:to-blue-100/50 rounded-2xl py-2 px-3.5 cursor-pointer transition-all duration-300 ease-out shadow-sm hover:shadow-md border border-blue-100/50 hover:border-blue-200">
                <div className="flex-shrink-0 h-8 w-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-2.5 shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-800 text-xs font-semibold truncate max-w-[90px] sm:max-w-[140px] group-hover:text-blue-900 transition-colors duration-300">
                    {user.first_name} {user.last_name}
                  </span>
                  <span className="text-blue-600 text-[10px] font-medium hidden sm:block truncate max-w-[140px]">
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
                <LogOut className="h-4.5 w-4.5 transition-transform duration-300 group-hover:rotate-12" />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
