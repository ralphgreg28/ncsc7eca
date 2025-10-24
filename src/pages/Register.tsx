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
        fieldsToValidate = ['username', 'email', 'password', 'confirmPassword', 'position'];
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
          position: formattedData.position,
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
  const isStep1Complete = !errors.username && !errors.email && !errors.position && !errors.password && !errors.confirmPassword && 
    touchedFields.username && touchedFields.email && touchedFields.position && touchedFields.password && touchedFields.confirmPassword;
  
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
          <div className="space-y-5 animate-fadeIn">
            <h3 className="text-xl font-semibold text-white/90 mb-6">Account Information</h3>
            
            {/* Username */}
            <div className="group">
              <label htmlFor="username" className="block text-sm font-medium text-white/90 mb-2 ml-1">
                Username <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200">
                  <User className="h-5 w-5 text-blue-300 group-focus-within:text-blue-200" />
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
                  className={`appearance-none rounded-xl block w-full pl-12 pr-4 py-3.5 border ${errors.username ? 'border-red-400/50 focus:ring-red-400/50 focus:border-red-400/50' : 'border-white/20 focus:ring-blue-400/50 focus:border-blue-400/50'} bg-white/10 backdrop-blur-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:bg-white/20 transition-all duration-200`}
                  placeholder="Enter username (letters and numbers only)"
                />
                {touchedFields.username && !errors.username && (
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  </div>
                )}
              </div>
              {errors.username && (
                <p className="mt-2 text-sm text-red-300 flex items-center animate-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="h-4 w-4 mr-1.5" /> {errors.username.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="group">
              <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2 ml-1">
                Email <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200">
                  <Mail className="h-5 w-5 text-blue-300 group-focus-within:text-blue-200" />
                </div>
                <input
                  {...register('email', {
                    onChange: (e) => {
                      // Format email: convert to lowercase and remove spaces
                      const value = e.target.value;
                      const formatted = value.toLowerCase().replace(/\s/g, '');
                      if (value !== formatted) {
                        e.target.value = formatted;
                      }
                    }
                  })}
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={`appearance-none rounded-xl block w-full pl-12 pr-4 py-3.5 border ${errors.email ? 'border-red-400/50 focus:ring-red-400/50 focus:border-red-400/50' : 'border-white/20 focus:ring-blue-400/50 focus:border-blue-400/50'} bg-white/10 backdrop-blur-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:bg-white/20 transition-all duration-200`}
                  placeholder="Enter email"
                />
                {touchedFields.email && !errors.email && (
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  </div>
                )}
              </div>
              {errors.email && (
                <p className="mt-2 text-sm text-red-300 flex items-center animate-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="h-4 w-4 mr-1.5" /> {errors.email.message}
                </p>
              )}
            </div>

            {/* Position */}
            <div className="group">
              <label htmlFor="position" className="block text-sm font-medium text-white/90 mb-2 ml-1">
                Position <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200">
                  <UserCircle className="h-5 w-5 text-blue-300 group-focus-within:text-blue-200" />
                </div>
                <select
                  {...register('position')}
                  id="position"
                  className={`appearance-none rounded-xl block w-full pl-12 pr-4 py-3.5 border ${errors.position ? 'border-red-400/50 focus:ring-red-400/50 focus:border-red-400/50' : 'border-white/20 focus:ring-blue-400/50 focus:border-blue-400/50'} bg-white/10 backdrop-blur-sm text-white focus:outline-none focus:ring-2 focus:bg-white/20 transition-all duration-200`}
                >
                  <option value="" className="bg-slate-800">Select position...</option>              
                  <option value="PDO" className="bg-slate-800">Project Development Officer</option>
                  <option value="LGU" className="bg-slate-800">LGU Stakeholder (OSCA, LSWDO, Focal)</option>
                  <option value="NCSC Admin" className="bg-slate-800">NCSC Staff</option>
                  <option value="Administrator" className="bg-slate-800">Administrator</option>
                </select>
                {touchedFields.position && !errors.position && (
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  </div>
                )}
              </div>
              {errors.position && (
                <p className="mt-2 text-sm text-red-300 flex items-center animate-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="h-4 w-4 mr-1.5" /> {errors.position.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="group">
              <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2 ml-1">
                Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200">
                  <Lock className="h-5 w-5 text-blue-300 group-focus-within:text-blue-200" />
                </div>
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={`appearance-none rounded-xl block w-full pl-12 pr-12 py-3.5 border ${errors.password ? 'border-red-400/50 focus:ring-red-400/50 focus:border-red-400/50' : 'border-white/20 focus:ring-blue-400/50 focus:border-blue-400/50'} bg-white/10 backdrop-blur-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:bg-white/20 transition-all duration-200`}
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center hover:text-white/80 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-blue-300" />
                  ) : (
                    <Eye className="h-5 w-5 text-blue-300" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-300 flex items-center animate-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="h-4 w-4 mr-1.5" /> {errors.password.message}
                </p>
              )}
              
              {/* Password Strength Meter */}
              {password && (
                <div className="mt-3">
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                    <div 
                      className={`h-full ${getPasswordStrengthColor()} transition-all duration-300`} 
                      style={{ width: `${(passwordStrength / 5) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-white/60 mt-1.5 flex justify-between">
                    <span>Password strength: {getPasswordStrengthText()}</span>
                    <span>{passwordStrength}/5</span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="group">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-white/90 mb-2 ml-1">
                Confirm Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200">
                  <Lock className="h-5 w-5 text-blue-300 group-focus-within:text-blue-200" />
                </div>
                <input
                  {...register('confirmPassword', {
                    validate: value => value === password || 'Passwords do not match'
                  })}
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={`appearance-none rounded-xl block w-full pl-12 pr-12 py-3.5 border ${errors.confirmPassword ? 'border-red-400/50 focus:ring-red-400/50 focus:border-red-400/50' : 'border-white/20 focus:ring-blue-400/50 focus:border-blue-400/50'} bg-white/10 backdrop-blur-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:bg-white/20 transition-all duration-200`}
                  placeholder="Confirm password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center hover:text-white/80 transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-blue-300" />
                  ) : (
                    <Eye className="h-5 w-5 text-blue-300" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-2 text-sm text-red-300 flex items-center animate-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="h-4 w-4 mr-1.5" /> {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>






        );
      case 2:
        return (
          <div className="space-y-5 animate-fadeIn">
            <h3 className="text-xl font-semibold text-white/90 mb-6">Personal Information</h3>
            
            {/* Full Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="group">
                <label htmlFor="lastName" className="block text-sm font-medium text-white/90 mb-2 ml-1">
                  Last Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200">
                    <UserCircle className="h-5 w-5 text-blue-300 group-focus-within:text-blue-200" />
                  </div>
                  <input
                    {...register('lastName', {
                      onChange: (e) => {
                        // Format to proper case as user types
                        const value = e.target.value;
                        const formatted = formatName(value);
                        if (value !== formatted && e.target.selectionStart) {
                          // Store cursor position
                          const cursorPosition = e.target.selectionStart;
                          // Update value
                          e.target.value = formatted;
                          // Restore cursor position
                          e.target.setSelectionRange(cursorPosition, cursorPosition);
                        }
                      }
                    })}
                    id="lastName"
                    type="text"
                    className={`appearance-none rounded-xl block w-full pl-12 pr-4 py-3.5 border ${errors.lastName ? 'border-red-400/50 focus:ring-red-400/50 focus:border-red-400/50' : 'border-white/20 focus:ring-blue-400/50 focus:border-blue-400/50'} bg-white/10 backdrop-blur-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:bg-white/20 transition-all duration-200`}
                    placeholder="Last name"
                  />
                  {touchedFields.lastName && !errors.lastName && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                    </div>
                  )}
                </div>
                {errors.lastName && (
                  <p className="mt-2 text-sm text-red-300 flex items-center animate-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="h-4 w-4 mr-1.5" /> {errors.lastName.message}
                  </p>
                )}
              </div>

              <div className="group">
                <label htmlFor="firstName" className="block text-sm font-medium text-white/90 mb-2 ml-1">
                  First Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200">
                    <UserCircle className="h-5 w-5 text-blue-300 group-focus-within:text-blue-200" />
                  </div>
                  <input
                    {...register('firstName', {
                      onChange: (e) => {
                        // Format to proper case as user types
                        const value = e.target.value;
                        const formatted = formatName(value);
                        if (value !== formatted && e.target.selectionStart) {
                          // Store cursor position
                          const cursorPosition = e.target.selectionStart;
                          // Update value
                          e.target.value = formatted;
                          // Restore cursor position
                          e.target.setSelectionRange(cursorPosition, cursorPosition);
                        }
                      }
                    })}
                    id="firstName"
                    type="text"
                    className={`appearance-none rounded-xl block w-full pl-12 pr-4 py-3.5 border ${errors.firstName ? 'border-red-400/50 focus:ring-red-400/50 focus:border-red-400/50' : 'border-white/20 focus:ring-blue-400/50 focus:border-blue-400/50'} bg-white/10 backdrop-blur-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:bg-white/20 transition-all duration-200`}
                    placeholder="First name"
                  />
                  {touchedFields.firstName && !errors.firstName && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                    </div>
                  )}
                </div>
                {errors.firstName && (
                  <p className="mt-2 text-sm text-red-300 flex items-center animate-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="h-4 w-4 mr-1.5" /> {errors.firstName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="group">
                <label htmlFor="middleName" className="block text-sm font-medium text-white/90 mb-2 ml-1">
                  Middle Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200">
                    <UserCircle className="h-5 w-5 text-blue-300 group-focus-within:text-blue-200" />
                  </div>
                  <input
                    {...register('middleName', {
                      onChange: (e) => {
                        // Format to proper case as user types
                        const value = e.target.value;
                        const formatted = formatName(value);
                        if (value !== formatted && e.target.selectionStart) {
                          // Store cursor position
                          const cursorPosition = e.target.selectionStart;
                          // Update value
                          e.target.value = formatted;
                          // Restore cursor position
                          e.target.setSelectionRange(cursorPosition, cursorPosition);
                        }
                      }
                    })}
                    id="middleName"
                    type="text"
                    className="appearance-none rounded-xl block w-full pl-12 pr-4 py-3.5 border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 focus:bg-white/20 transition-all duration-200"
                    placeholder="Middle name"
                  />
                </div>
              </div>

              <div className="group">
                <label htmlFor="extensionName" className="block text-sm font-medium text-white/90 mb-2 ml-1">
                  Extension Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200">
                    <UserCircle className="h-5 w-5 text-blue-300 group-focus-within:text-blue-200" />
                  </div>
                  <select
                    {...register('extensionName')}
                    id="extensionName"
                    className="appearance-none rounded-xl block w-full pl-12 pr-4 py-3.5 border border-white/20 bg-white/10 backdrop-blur-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 focus:bg-white/20 transition-all duration-200"
                  >
                    <option value="" className="bg-slate-800">None</option>
                    <option value="Jr." className="bg-slate-800">Jr.</option>
                    <option value="Sr." className="bg-slate-800">Sr.</option>
                    <option value="I" className="bg-slate-800">I</option>
                    <option value="II" className="bg-slate-800">II</option>
                    <option value="III" className="bg-slate-800">III</option>
                    <option value="IV" className="bg-slate-800">IV</option>
                    <option value="V" className="bg-slate-800">V</option>
                    <option value="MD" className="bg-slate-800">MD</option>
                    <option value="PhD" className="bg-slate-800">PhD</option>
                    <option value="Esq." className="bg-slate-800">Esq.</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-5 animate-fadeIn">
            <h3 className="text-xl font-semibold text-white/90 mb-6">Additional Information</h3>
            
            {/* Birth Date and Sex */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="group">
                <label htmlFor="birthDate" className="block text-sm font-medium text-white/90 mb-2 ml-1">
                  Birth Date <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200">
                    <Calendar className="h-5 w-5 text-blue-300 group-focus-within:text-blue-200" />
                  </div>
                  <input
                    {...register('birthDate')}
                    id="birthDate"
                    type="date"
                    className={`appearance-none rounded-xl block w-full pl-12 pr-4 py-3.5 border ${errors.birthDate ? 'border-red-400/50 focus:ring-red-400/50 focus:border-red-400/50' : 'border-white/20 focus:ring-blue-400/50 focus:border-blue-400/50'} bg-white/10 backdrop-blur-sm text-white focus:outline-none focus:ring-2 focus:bg-white/20 transition-all duration-200 [color-scheme:dark]`}
                  />
                  {touchedFields.birthDate && !errors.birthDate && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                    </div>
                  )}
                </div>
                {errors.birthDate && (
                  <p className="mt-2 text-sm text-red-300 flex items-center animate-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="h-4 w-4 mr-1.5" /> {errors.birthDate.message}
                  </p>
                )}
              </div>

              <div className="group">
                <label htmlFor="sex" className="block text-sm font-medium text-white/90 mb-2 ml-1">
                  Sex <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200">
                    <UserCircle className="h-5 w-5 text-blue-300 group-focus-within:text-blue-200" />
                  </div>
                  <select
                    {...register('sex')}
                    id="sex"
                    className={`appearance-none rounded-xl block w-full pl-12 pr-4 py-3.5 border ${errors.sex ? 'border-red-400/50 focus:ring-red-400/50 focus:border-red-400/50' : 'border-white/20 focus:ring-blue-400/50 focus:border-blue-400/50'} bg-white/10 backdrop-blur-sm text-white focus:outline-none focus:ring-2 focus:bg-white/20 transition-all duration-200`}
                  >
                    <option value="" className="bg-slate-800">Select...</option>
                    <option value="Male" className="bg-slate-800">Male</option>
                    <option value="Female" className="bg-slate-800">Female</option>
                  </select>
                  {touchedFields.sex && !errors.sex && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                    </div>
                  )}
                </div>
                {errors.sex && (
                  <p className="mt-2 text-sm text-red-300 flex items-center animate-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="h-4 w-4 mr-1.5" /> {errors.sex.message}
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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Registration card with glassmorphism effect */}
      <div className="relative max-w-2xl w-full">
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl p-8 sm:p-10 transform transition-all duration-500">
          <div className="mb-8">
            <h2 className="text-center text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-indigo-200 bg-clip-text text-transparent">
              NCSC Staff / LGU Stakeholders Registration
            </h2>
            <p className="mt-3 text-center text-sm text-white/70">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-blue-300 hover:text-blue-200 transition-colors underline decoration-blue-400/50 hover:decoration-blue-300 underline-offset-2">
                Sign in
              </Link>
            </p>
          </div>
        
          {/* Progress Steps */}
          <div className="flex justify-between items-center mb-10">
            <div className="w-full flex items-center">
              <div className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${currentStep >= 1 ? 'border-blue-400 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/50' : 'border-white/30 bg-white/10 text-white/50'}`}>
                <span className="font-semibold">1</span>
                {currentStep >= 1 && (
                  <div className="absolute inset-0 bg-blue-400/50 rounded-full blur-md animate-pulse"></div>
                )}
              </div>
              <div className={`flex-1 h-1.5 mx-3 rounded-full transition-all duration-300 ${currentStep >= 2 ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-white/20'}`}></div>
              <div className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${currentStep >= 2 ? 'border-blue-400 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/50' : 'border-white/30 bg-white/10 text-white/50'}`}>
                <span className="font-semibold">2</span>
                {currentStep >= 2 && (
                  <div className="absolute inset-0 bg-blue-400/50 rounded-full blur-md animate-pulse"></div>
                )}
              </div>
              <div className={`flex-1 h-1.5 mx-3 rounded-full transition-all duration-300 ${currentStep >= 3 ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-white/20'}`}></div>
              <div className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${currentStep >= 3 ? 'border-blue-400 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/50' : 'border-white/30 bg-white/10 text-white/50'}`}>
                <span className="font-semibold">3</span>
                {currentStep >= 3 && (
                  <div className="absolute inset-0 bg-blue-400/50 rounded-full blur-md animate-pulse"></div>
                )}
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
                  className="group inline-flex items-center px-5 py-2.5 border border-white/30 backdrop-blur-sm bg-white/10 shadow-sm text-sm font-semibold rounded-xl text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-all duration-200"
                >
                  <ChevronLeft className="h-4 w-4 mr-1 transform group-hover:-translate-x-1 transition-transform duration-200" />
                  Previous
                </button>
              )}
              
              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className={`group inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-semibold rounded-xl shadow-lg text-white ml-auto transition-all duration-300 ${
                    (currentStep === 1 && !isStep1Complete) || (currentStep === 2 && !isStep2Complete) 
                      ? 'bg-white/20 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transform hover:-translate-y-0.5'
                  }`}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-200" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || !isStep3Complete}
                  className={`group inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-semibold rounded-xl shadow-lg text-white ml-auto transition-all duration-300 ${
                    (loading || !isStep3Complete) 
                      ? 'bg-white/20 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transform hover:-translate-y-0.5'
                  }`}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-white/60 text-center">
              * Required fields
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
