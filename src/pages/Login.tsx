import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Lock, User, AlertCircle } from 'lucide-react';
import { loginUser } from '../lib/auth';
import { loginSchema } from '../lib/schemas';
import type { LoginInput } from '../lib/schemas';

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>();

  const onSubmit = async (data: LoginInput) => {
    try {
      setLoading(true);
      console.log('Login attempt for:', data.identifier);

      const result = await loginUser(data.identifier, data.password, rememberMe);
      console.log('Login result:', { success: result.success, hasUser: !!result.user });

      if (!result.success && result.error) {
        console.log('Login failed:', result.error);
        toast.error(result.error.message);
        return;
      }

      console.log('Login successful, redirecting to dashboard...');
      // Use window.location for a full page reload to ensure proper initialization
      window.location.href = '/';
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Login card with glassmorphism effect */}
      <div className="relative max-w-md w-full">
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl p-8 sm:p-10 transform transition-all duration-500 hover:scale-[1.02]">
          {/* Logo and header section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-28 h-28 mb-6 group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full blur-md group-hover:blur-lg transition-all duration-300 animate-pulse"></div>
              <div className="relative w-full h-full bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center p-5 border-2 border-white/30 transform transition-transform duration-300 group-hover:rotate-6">
                <img
                  src="https://cthemydbthfjlvtuqdnu.supabase.co/storage/v1/object/public/logos//ncsc.png"
                  alt="NCSC Logo"
                  className="h-full w-auto object-contain"
                />
              </div>
            </div>
            
            <div className="text-center space-y-2 mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-indigo-200 bg-clip-text text-transparent leading-tight">
                NCSC_7 Expanded Centenarian
              </h1>
              <h2 className="text-lg sm:text-xl font-semibold text-white/90">
                Information Management System
              </h2>
              <div className="inline-block px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <span className="text-sm font-medium text-white/90">Version 3.0</span>
              </div>
            </div>
            
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full mb-6"></div>
            
            <h3 className="text-2xl font-bold text-white mb-2">
              Welcome Back!
            </h3>
            <p className="text-sm text-white/70">
              New here?{' '}
              <Link 
                to="/register" 
                className="font-semibold text-blue-300 hover:text-blue-200 transition-colors underline decoration-blue-400/50 hover:decoration-blue-300 underline-offset-2"
              >
                Create an account
              </Link>
            </p>
          </div>
        
          {/* Form section */}
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-5">
              {/* Username input */}
              <div className="group">
                <label htmlFor="identifier" className="block text-sm font-medium text-white/90 mb-2 ml-1">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200">
                    <User className="h-5 w-5 text-blue-300 group-focus-within:text-blue-200" />
                  </div>
                  <input
                    {...register('identifier', { required: 'Username is required' })}
                    id="identifier"
                    type="text"
                    className="appearance-none rounded-xl block w-full pl-12 pr-4 py-3.5 border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 focus:bg-white/20 transition-all duration-200 ease-in-out"
                    placeholder="Enter your username"
                  />
                </div>
                {errors.identifier && (
                  <p className="mt-2 text-sm text-red-300 flex items-center animate-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="h-4 w-4 mr-1.5 flex-shrink-0" />
                    {errors.identifier.message}
                  </p>
                )}
              </div>
            
              {/* Password input */}
              <div className="group">
                <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2 ml-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200">
                    <Lock className="h-5 w-5 text-blue-300 group-focus-within:text-blue-200" />
                  </div>
                  <input
                    {...register('password', { required: 'Password is required' })}
                    id="password"
                    type="password"
                    className="appearance-none rounded-xl block w-full pl-12 pr-4 py-3.5 border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 focus:bg-white/20 transition-all duration-200 ease-in-out"
                    placeholder="Enter your password"
                  />
                </div>
                {errors.password && (
                  <p className="mt-2 text-sm text-red-300 flex items-center animate-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="h-4 w-4 mr-1.5 flex-shrink-0" />
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            {/* Submit button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`group relative w-full flex justify-center items-center py-3.5 px-6 border border-transparent text-base font-semibold rounded-xl text-white overflow-hidden transition-all duration-300 ease-in-out ${
                  loading 
                    ? 'bg-blue-500/50 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transform hover:-translate-y-0.5 active:translate-y-0'
                }`}
              >
                {!loading && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                )}
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span className="relative flex items-center">
                    Sign in
                    <svg className="ml-2 w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                )}
              </button>
            </div>

            {/* Footer notice */}
            <div className="mt-6">
              <div className="flex items-start gap-3 text-sm text-white/70 bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>Forgot password? Contact your administrator for assistance.</span>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
