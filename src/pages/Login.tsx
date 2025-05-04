import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Lock, User, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { loginSchema } from '../lib/schemas';
import type { LoginInput } from '../lib/schemas';

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>();

  const onSubmit = async (data: LoginInput) => {
    try {
      setLoading(true);

      const { data: staff, error } = await supabase
        .from('staff')
        .select('*')
        .eq('username', data.identifier)
        .single();

      if (error) {
        console.error('Database error:', error);
        toast.error('An error occurred while logging in');
        return;
      }

      if (!staff) {
        toast.error('Invalid username or password');
        return;
      }

      // Compare password hash
      if (staff.password_hash !== data.password) {
        toast.error('Invalid username or password');
        return;
      }

      // Check if user is active
      if (staff.status !== 'Active') {
        toast.error('Your account is not active. Please contact an administrator.');
        return;
      }

      // Update last login
      const { error: updateError } = await supabase
        .from('staff')
        .update({ last_login: new Date().toISOString() })
        .eq('id', staff.id);

      if (updateError) {
        console.error('Failed to update last login:', updateError);
      }

      // Store user info in localStorage
      localStorage.setItem('user', JSON.stringify(staff));
      
      // Redirect to dashboard
      window.location.href = '/';
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl">
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 p-4">
            <img
              src="https://cthemydbthfjlvtuqdnu.supabase.co/storage/v1/object/public/logos//ncsc.png"
              alt="NCSC Logo"
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            NCSC_7 Expanded Centenarian
          </h1>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            Information Management System 2.0
          </h1>
          
          <div className="w-20 h-1 bg-blue-500 rounded-full mb-6"></div>
          
          <h2 className="text-xl font-semibold text-gray-700">
            Welcome!
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700 transition-colors">
              Register now!
            </Link>
          </p>
        </div>
        
        <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-blue-500" />
                </div>
                <input
                  {...register('identifier', { required: 'Username is required' })}
                  id="identifier"
                  type="text"
                  className="appearance-none rounded-lg block w-full pl-10 px-3 py-2.5 border border-gray-300 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ease-in-out"
                  placeholder="Enter your username"
                />
              </div>
              {errors.identifier && (
                <p className="mt-1 text-sm text-red-500 flex items-center">
                  <AlertCircle className="h-3.5 w-3.5 mr-1" />
                  {errors.identifier.message}
                </p>
              )}
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-blue-500" />
                </div>
                <input
                  {...register('password', { required: 'Password is required' })}
                  id="password"
                  type="password"
                  className="appearance-none rounded-lg block w-full pl-10 px-3 py-2.5 border border-gray-300 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ease-in-out"
                  placeholder="Enter your password"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-500 flex items-center">
                  <AlertCircle className="h-3.5 w-3.5 mr-1" />
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className={`relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ease-in-out transform hover:-translate-y-0.5 ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign in'}
            </button>
          </div>

          <div className="mt-4 text-center">
            <div className="flex items-center justify-center text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-500 mr-2 flex-shrink-0" />
              <span>Forgot password? Contact your administrator for assistance.</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
