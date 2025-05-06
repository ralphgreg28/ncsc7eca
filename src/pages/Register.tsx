import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Mail, User, Lock, UserCircle, Calendar, ChevronLeft, ChevronRight, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { registerSchema } from '../lib/schemas';
import type { RegisterInput } from '../lib/schemas';

function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  const { register, handleSubmit, watch, formState: { errors, touchedFields }, trigger } = useForm<RegisterInput>({
    mode: 'onChange'
  });
  
  const password = watch('password');

  // Calculate password strength
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }
    
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    
    setPasswordStrength(strength);
  }, [password]);

  const formatName = (name: string) => name.trim().replace(/\b\w/g, char => char.toUpperCase());

  const nextStep = async () => {
    let fieldsToValidate: (keyof RegisterInput)[] = [];
    
    switch (currentStep) {
      case 1:
        fieldsToValidate = ['username', 'email', 'password', 'confirmPassword'];
        break;
      case 2:
        fieldsToValidate = ['firstName', 'lastName'];
        break;
      case 3:
        fieldsToValidate = ['birthDate', 'sex'];
        break;
    }
    
    const isStepValid = await trigger(fieldsToValidate);
    if (isStepValid) setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  const onSubmit = async (data: RegisterInput) => {
    try {
      setLoading(true);

      // Format the fields before proceeding
      const formattedData = {
        ...data,
        username: data.username.toLowerCase(),
        firstName: formatName(data.firstName),
        lastName: formatName(data.lastName),
        middleName: data.middleName ? formatName(data.middleName) : '',
        extensionName: data.extensionName ? formatName(data.extensionName) : ''
      };

      // Check if username exists
      const { data: existingUser } = await supabase
        .from('staff')
        .select('username')
        .eq('username', formattedData.username)
        .maybeSingle();

      if (existingUser) {
        toast.error('Username already exists');
        return;
      }

      // Check if email exists
      const { data: existingEmail } = await supabase
        .from('staff')
        .select('email')
        .eq('email', formattedData.email)
        .maybeSingle();

      if (existingEmail) {
        toast.error('Email already exists');
        return;
      }

      // Create new staff record
      const { error: insertError } = await supabase
        .from('staff')
        .insert({
          username: formattedData.username,
          password_hash: formattedData.password, // In a real app, you'd hash this
          email: formattedData.email,
          first_name: formattedData.firstName,
          last_name: formattedData.lastName,
          middle_name: formattedData.middleName,
          extension_name: formattedData.extensionName,
          birth_date: formattedData.birthDate,
          sex: formattedData.sex,
          position: 'PDO',
          status: 'Inactive' 
        });

      if (insertError) throw insertError;

      toast.success('Registration successful! Your account is currently inactive. Please contact an administrator for activation before you can login.');
      navigate('/login');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate step completion status
  const isStep1Complete = !errors.username && !errors.email && !errors.password && !errors.confirmPassword && 
    touchedFields.username && touchedFields.email && touchedFields.password && touchedFields.confirmPassword;
  
  const isStep2Complete = !errors.firstName && !errors.lastName && 
    touchedFields.firstName && touchedFields.lastName;
  
  const isStep3Complete = !errors.birthDate && !errors.sex && 
    touchedFields.birthDate && touchedFields.sex;

  // Password strength indicator
  const getPasswordStrengthColor = () => {
    if (passwordStrength === 0) return 'bg-gray-200';
    if (passwordStrength <= 2) return 'bg-red-500';
    if (passwordStrength <= 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    if (!password) return '';
    if (passwordStrength <= 2) return 'Weak';
    if (passwordStrength <= 3) return 'Medium';
    return 'Strong';
  };

  // Render form steps
  const renderFormStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
            
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('username', {
                    onChange: (e) => {
                      // Only allow letters and numbers and convert to lowercase
                      const value = e.target.value;
                      const sanitized = value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                      if (value !== sanitized) {
                        e.target.value = sanitized;
                      }
                    }
                  })}
                  id="username"
                  type="text"
                  autoComplete="username"
                  className={`appearance-none rounded-lg relative block w-full pl-10 px-3 py-2 border ${errors.username ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 sm:text-sm transition-colors duration-200`}
                  placeholder="Enter username (letters and numbers only)"
                />
                {touchedFields.username && !errors.username && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                )}
              </div>
              {errors.username && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" /> {errors.username.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={`appearance-none rounded-lg relative block w-full pl-10 px-3 py-2 border ${errors.email ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 sm:text-sm transition-colors duration-200`}
                  placeholder="Enter email"
                />
                {touchedFields.email && !errors.email && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                )}
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" /> {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={`appearance-none rounded-lg relative block w-full pl-10 pr-10 px-3 py-2 border ${errors.password ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 sm:text-sm transition-colors duration-200`}
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" /> {errors.password.message}
                </p>
              )}
              
              {/* Password Strength Meter */}
              {password && (
                <div className="mt-2">
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${getPasswordStrengthColor()} transition-all duration-300`} 
                      style={{ width: `${(passwordStrength / 5) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 flex justify-between">
                    <span>Password strength: {getPasswordStrengthText()}</span>
                    <span>{passwordStrength}/5</span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('confirmPassword', {
                    validate: value => value === password || 'Passwords do not match'
                  })}
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={`appearance-none rounded-lg relative block w-full pl-10 pr-10 px-3 py-2 border ${errors.confirmPassword ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 sm:text-sm transition-colors duration-200`}
                  placeholder="Confirm password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" /> {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
            
            {/* Full Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserCircle className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('lastName')}
                    id="lastName"
                    type="text"
                    className={`appearance-none rounded-lg relative block w-full pl-10 px-3 py-2 border ${errors.lastName ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 sm:text-sm transition-colors duration-200`}
                    placeholder="Last name"
                  />
                  {touchedFields.lastName && !errors.lastName && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                  )}
                </div>
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" /> {errors.lastName.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserCircle className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('firstName')}
                    id="firstName"
                    type="text"
                    className={`appearance-none rounded-lg relative block w-full pl-10 px-3 py-2 border ${errors.firstName ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 sm:text-sm transition-colors duration-200`}
                    placeholder="First name"
                  />
                  {touchedFields.firstName && !errors.firstName && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                  )}
                </div>
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" /> {errors.firstName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="middleName" className="block text-sm font-medium text-gray-700">
                  Middle Name
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserCircle className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('middleName')}
                    id="middleName"
                    type="text"
                    className="appearance-none rounded-lg relative block w-full pl-10 px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors duration-200"
                    placeholder="Middle name"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="extensionName" className="block text-sm font-medium text-gray-700">
                  Extension Name
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserCircle className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('extensionName')}
                    id="extensionName"
                    type="text"
                    className="appearance-none rounded-lg relative block w-full pl-10 px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors duration-200"
                    placeholder="Extension name (Jr., Sr., III, etc.)"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
            
            {/* Birth Date and Sex */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700">
                  Birth Date <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('birthDate')}
                    id="birthDate"
                    type="date"
                    className={`appearance-none rounded-lg relative block w-full pl-10 px-3 py-2 border ${errors.birthDate ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 sm:text-sm transition-colors duration-200`}
                  />
                  {touchedFields.birthDate && !errors.birthDate && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                  )}
                </div>
                {errors.birthDate && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" /> {errors.birthDate.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="sex" className="block text-sm font-medium text-gray-700">
                  Sex <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserCircle className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    {...register('sex')}
                    id="sex"
                    className={`appearance-none rounded-lg relative block w-full pl-10 px-3 py-2 border ${errors.sex ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 sm:text-sm transition-colors duration-200`}
                  >
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  {touchedFields.sex && !errors.sex && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                  )}
                </div>
                {errors.sex && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" /> {errors.sex.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg transition-all duration-300">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
            NCSC Staff Registration
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </p>
        </div>
        
        {/* Progress Steps */}
        <div className="flex justify-between items-center mb-8">
          <div className="w-full flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${currentStep >= 1 ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-500'}`}>
              1
            </div>
            <div className={`flex-1 h-1 mx-2 ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${currentStep >= 2 ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-500'}`}>
              2
            </div>
            <div className={`flex-1 h-1 mx-2 ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${currentStep >= 3 ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-500'}`}>
              3
            </div>
          </div>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {renderFormStep()}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </button>
            )}
            
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ml-auto ${
                  (currentStep === 1 && !isStep1Complete) || (currentStep === 2 && !isStep2Complete) ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !isStep3Complete}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ml-auto ${
                  (loading || !isStep3Complete) ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Registering...
                  </>
                ) : (
                  'Register'
                )}
              </button>
            )}
          </div>
        </form>

        {/* Form Completion Indicator */}
        <div className="mt-4 pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            * Required fields
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
