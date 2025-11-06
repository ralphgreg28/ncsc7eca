import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { format, differenceInYears } from 'date-fns';
import { toast } from 'react-toastify';
import { ArrowLeft, Calendar, User, MapPin, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DuplicateModal from '../components/DuplicateModal';
import { logAudit } from '../lib/audit';

interface CitizenFormInput {
  lastName: string;
  firstName: string;
  middleName?: string;
  extensionName?: string;
  birthDate: string;
  sex: 'Male' | 'Female';
  provinceCode: string;
  lguCode: string;
  barangayCode: string;
  oscaId?: string;
  rrn?: string;
  validator?: string;
  validationDate?: string;
  specimen?: 'signature' | 'thumbmark';
  disability?: 'yes' | 'no';
  indigenous_people?: 'yes' | 'no';
}

interface AddressOption {
  code: string;
  name: string;
}

interface AddressDetails {
  province_name: string;
  lgu_name: string;
  barangay_name: string;
}

const EXTENSION_NAMES = ['', 'Jr.', 'Sr.', 'I', 'II', 'III', 'IV', 'V'];

const VALIDATORS = [
  'JOCELYN O. TABOTABO',
  'AGNES MODESTA V. SABALDAN',
  'RALPH JIENE D. GREGORIO',
  'ALYSSA MARIE P. MARAÑA',
  'MARIA RAISA D. GILLAMAC',
  'HAIDEE O.TALILI',
  'MARY ANN G. POL',
  'CANDELAR JANE V. MOJADO',
  'JUVELYN C. GUMISAD',
  'REYMARK M. SERDAN',
  'JOVEN J. CALMA',
  'IRENE A. MARTINEZ'
];

function CitizenForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [firstEntry, setFirstEntry] = useState<CitizenFormInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [age, setAge] = useState<number | null>(null);
  const [provinces, setProvinces] = useState<AddressOption[]>([]);
  const [lgus, setLgus] = useState<AddressOption[]>([]);
  const [barangays, setBarangays] = useState<AddressOption[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateRecord, setDuplicateRecord] = useState<any>(null);
  const [matchedFields, setMatchedFields] = useState<string[]>([]);
  const [addressDetails, setAddressDetails] = useState<AddressDetails>({
    province_name: '',
    lgu_name: '',
    barangay_name: ''
  });
  
  // Add a ref to track if a submission is in progress
  const isSubmitting = useRef(false);
  
  // Add a ref for scrolling to top
  const formTopRef = useRef<HTMLDivElement>(null);
  
  const { register, handleSubmit, watch, formState: { errors }, reset, setValue, getValues, control } = useForm<CitizenFormInput>();
  
  const birthDate = watch('birthDate');
  const selectedProvinceCode = watch('provinceCode');
  const selectedLguCode = watch('lguCode');
  
  // Watch all fields for real-time validation in step 2
  const watchAllFields = watch();
  
  // State to track field matches/mismatches in step 2
  const [fieldMatches, setFieldMatches] = useState<Record<string, boolean>>({});
  const [mismatchCount, setMismatchCount] = useState(0);
  
  // Refs to track previous values to prevent unnecessary updates
  const prevMatchesRef = useRef<Record<string, boolean>>({});
  const prevMismatchCountRef = useRef<number>(0);
  
  // Effect to check field matches in step 2
  useEffect(() => {
    if (step === 2 && firstEntry) {
      const fieldsToCompare = [
        'lastName', 'firstName', 'middleName', 'extensionName', 
        'birthDate', 'sex', 'provinceCode', 'lguCode', 'barangayCode',
        'oscaId', 'rrn', 'validator', 'validationDate', 'specimen', 'disability', 'indigenous_people'
      ];
      
      const currentMatches: Record<string, boolean> = {};
      let mismatches = 0;
      
      fieldsToCompare.forEach(field => {
        const firstValue = firstEntry[field as keyof CitizenFormInput] || '';
        const currentValue = watchAllFields[field as keyof CitizenFormInput] || '';
        
        // Only mark as matched if the field has a value and matches
        const isMatch = currentValue !== '' && firstValue === currentValue;
        currentMatches[field] = isMatch;
        
        // Count mismatches only for fields that have values
        if (currentValue !== '' && firstValue !== currentValue) {
          mismatches++;
        }
      });
      
      // Only update state if there's an actual change
      const matchesChanged = JSON.stringify(currentMatches) !== JSON.stringify(prevMatchesRef.current);
      const mismatchCountChanged = mismatches !== prevMismatchCountRef.current;
      
      if (matchesChanged) {
        prevMatchesRef.current = currentMatches;
        setFieldMatches(currentMatches);
      }
      
      if (mismatchCountChanged) {
        prevMismatchCountRef.current = mismatches;
        setMismatchCount(mismatches);
      }
    }
  }, [watchAllFields, firstEntry, step]);
  
  useEffect(() => {
    if (birthDate) {
      const birthDateObj = new Date(birthDate);
      const ageValue = differenceInYears(new Date(), birthDateObj);
      setAge(ageValue);
    } else {
      setAge(null);
    }
  }, [birthDate]);
  
  useEffect(() => {
    async function fetchProvinces() {
      try {
        const { data, error } = await supabase
          .from('provinces')
          .select('code, name')
          .order('name');
        
        if (error) throw error;
        setProvinces(data || []);
      } catch (error) {
        console.error('Error fetching provinces:', error);
        toast.error('Failed to load provinces');
      }
    }
    
    fetchProvinces();
  }, []);
  
  useEffect(() => {
    if (!selectedProvinceCode) {
      setLgus([]);
      return;
    }
    
    async function fetchLgus() {
      try {
        const { data, error } = await supabase
          .from('lgus')
          .select('code, name')
          .eq('province_code', selectedProvinceCode)
          .order('name');
        
        if (error) throw error;
        setLgus(data || []);
        setValue('lguCode', '');
        setValue('barangayCode', '');
      } catch (error) {
        console.error('Error fetching LGUs:', error);
        toast.error('Failed to load LGUs');
      }
    }
    
    fetchLgus();
  }, [selectedProvinceCode, setValue]);
  
  useEffect(() => {
    if (!selectedLguCode) {
      setBarangays([]);
      return;
    }
    
    async function fetchBarangays() {
      try {
        const { data, error } = await supabase
          .from('barangays')
          .select('code, name')
          .eq('lgu_code', selectedLguCode)
          .order('name');
        
        if (error) throw error;
        setBarangays(data || []);
        setValue('barangayCode', '');
      } catch (error) {
        console.error('Error fetching barangays:', error);
        toast.error('Failed to load barangays');
      }
    }
    
    fetchBarangays();
  }, [selectedLguCode, setValue]);

  const fetchAddressDetails = async (provinceCode: string, lguCode: string, barangayCode: string) => {
    try {
      const [province, lgu, barangay] = await Promise.all([
        supabase.from('provinces').select('name').eq('code', provinceCode).single(),
        supabase.from('lgus').select('name').eq('code', lguCode).single(),
        supabase.from('barangays').select('name').eq('code', barangayCode).single()
      ]);

      return {
        province_name: province.data?.name || '',
        lgu_name: lgu.data?.name || '',
        barangay_name: barangay.data?.name || ''
      };
    } catch (error) {
      console.error('Error fetching address details:', error);
      return {
        province_name: '',
        lgu_name: '',
        barangay_name: ''
      };
    }
  };

  const checkForDuplicates = async (data: CitizenFormInput) => {
    try {
      const { data: existingRecords, error } = await supabase
        .from('citizens')
        .select('*')
        .or(`last_name.ilike.${data.lastName},first_name.ilike.${data.firstName},middle_name.ilike.${data.middleName || ''}`);

      if (error) throw error;

      if (existingRecords && existingRecords.length > 0) {
        for (const record of existingRecords) {
          const matchingFields = [];
          
          if (record.last_name.toLowerCase() === data.lastName.toLowerCase()) {
            matchingFields.push('last_name');
          }
          if (record.first_name.toLowerCase() === data.firstName.toLowerCase()) {
            matchingFields.push('first_name');
          }
          if (record.middle_name?.toLowerCase() === data.middleName?.toLowerCase()) {
            matchingFields.push('middle_name');
          }

          if (matchingFields.length >= 2) {
            const details = await fetchAddressDetails(
              record.province_code,
              record.lgu_code,
              record.barangay_code
            );
            setAddressDetails(details);
            setDuplicateRecord(record);
            setMatchedFields(matchingFields);
            setShowDuplicateModal(true);
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking duplicates:', error);
      return false;
    }
  };
  
  // Scroll to top function
  const scrollToTop = useCallback(() => {
    formTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  
  const onFirstSubmit: SubmitHandler<CitizenFormInput> = (data) => {
    setFirstEntry(data);
    setStep(2);
    reset();
    
    // Scroll to top after form submission
    scrollToTop();
  };
  
  const onSecondSubmit: SubmitHandler<CitizenFormInput> = async (data) => {
    if (!firstEntry) return;
    
    // Scroll to top after form submission
    scrollToTop();
    
    const fieldsToCompare = [
      'lastName', 'firstName', 'middleName', 'extensionName', 
      'birthDate', 'sex', 'provinceCode', 'lguCode', 'barangayCode',
      'oscaId', 'rrn', 'validator', 'validationDate', 'specimen', 'disability', 'indigenous_people'
    ];
    
    const mismatches = fieldsToCompare.filter(field => {
      return firstEntry[field as keyof CitizenFormInput] !== data[field as keyof CitizenFormInput];
    });
    
    if (mismatches.length > 0) {
      toast.error('Entries do not match. Please verify and try again.');
      
      const mismatchedFields = mismatches.map(field => {
        return field
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
      });
      
      toast.error(`Mismatched fields: ${mismatchedFields.join(', ')}`);
      return;
    }
    
    const hasDuplicates = await checkForDuplicates(data);
    if (!hasDuplicates) {
      await saveRecord(data);
    }
  };

  const saveRecord = async (data: CitizenFormInput) => {
  // Prevent duplicate submissions
  if (isSubmitting.current) {
    return;
  }
  
  try {
    isSubmitting.current = true;
    setLoading(true);

    // Get the next ID using the function
    const { data: nextId, error: idError } = await supabase
      .rpc('get_next_citizen_id');

    if (idError) throw idError;

    // Format the encoder's name
    const encodedBy = user ? 
      `${user.last_name}, ${user.first_name}${user.middle_name ? ` ${user.middle_name}` : ''}` : 
      null;

    // Insert the new record
    const { error } = await supabase.from('citizens').insert({
      id: nextId,
      last_name: data.lastName,
      first_name: data.firstName,
      middle_name: data.middleName || null,
      extension_name: data.extensionName || null,
      birth_date: data.birthDate,
      sex: data.sex,
      province_code: data.provinceCode,
      lgu_code: data.lguCode,
      barangay_code: data.barangayCode,
      osca_id: data.oscaId || 'N/A',
      rrn: data.rrn || 'N/A',
      validator: data.validator || null,
      validation_date: data.validationDate || null,
      specimen: data.specimen || null,
      disability: data.disability || null,
      indigenous_people: data.indigenous_people || null,
      encoded_by: encodedBy
    });

    if (error) throw error;

    // Insert audit log for creation
   /* 
   await logAudit({
      action: 'create',
      table_name: 'citizens',
      record_id: nextId.toString(),
      details: { 
        new: {
          last_name: data.lastName,
          first_name: data.firstName,
          middle_name: data.middleName || null,
          extension_name: data.extensionName || null,
          birth_date: data.birthDate,
          sex: data.sex,
          province_code: data.provinceCode,
          lgu_code: data.lguCode,
          barangay_code: data.barangayCode,
          osca_id: data.oscaId || 'N/A',
          rrn: data.rrn || 'N/A',
          validator: data.validator || null,
          validation_date: data.validationDate || null
        },
        type: 'Senior Citizen Create Record'
      },
      staff_id: user?.id
    });

    */

    toast.success('Senior citizen record saved successfully!');
    navigate('/citizens/list');
  } catch (error) {
    console.error('Error saving record:', error);
    toast.error('Failed to save record. Please try again.');
  } finally {
    setLoading(false);
    isSubmitting.current = false;
  }
};

const updateRecord = async (data: CitizenFormInput, citizenId: number) => {
  // Prevent duplicate submissions
  if (isSubmitting.current) {
    return;
  }
  
  try {
    isSubmitting.current = true;
    setLoading(true);

    // Fetch the old record first
    const { data: oldRecord, error: fetchError } = await supabase
      .from('citizens')
      .select('*')
      .eq('id', citizenId)
      .single();

    if (fetchError) throw fetchError;

    // Update the citizen record
    const { data: updatedCitizen, error } = await supabase.from('citizens').update({
      last_name: data.lastName,
      first_name: data.firstName,
      middle_name: data.middleName || null,
      extension_name: data.extensionName || null,
      birth_date: data.birthDate,
      sex: data.sex,
      province_code: data.provinceCode,
      lgu_code: data.lguCode,
      barangay_code: data.barangayCode,
      osca_id: data.oscaId || 'N/A',
      rrn: data.rrn || 'N/A',
      validator: data.validator || null,
      validation_date: data.validationDate || null,
      specimen: data.specimen || null,
      disability: data.disability || null,
      indigenous_people: data.indigenous_people || null
    }).eq('id', citizenId);

    if (error) throw error;

    // Log the audit for the record update
    await logAudit({
      action: 'update',
      table_name: 'citizens',
      record_id: citizenId.toString(),
      details: { 
        old: oldRecord,
        new: {
          last_name: data.lastName,
          first_name: data.firstName,
          middle_name: data.middleName || null,
          extension_name: data.extensionName || null,
          birth_date: data.birthDate,
          sex: data.sex,
          province_code: data.provinceCode,
          lgu_code: data.lguCode,
          barangay_code: data.barangayCode,
          osca_id: data.oscaId || 'N/A',
          rrn: data.rrn || 'N/A',
          validator: data.validator || null,
          validation_date: data.validationDate || null
        },
        type: 'Senior Citizen Registration'
      },
      staff_id: user?.id
    });

    toast.success('Senior citizen record updated successfully!');
    navigate('/citizens/list');
  } catch (error) {
    console.error('Error updating record:', error);
    toast.error('Failed to update record. Please try again.');
  } finally {
    setLoading(false);
    isSubmitting.current = false;
  }
};


// Delete record function
const deleteRecord = async (citizenId: number) => {
  // Prevent duplicate submissions
  if (isSubmitting.current) {
    return;
  }
  
  try {
    isSubmitting.current = true;
    setLoading(true);

    // Fetch the record before deleting it
    const { data: oldRecord, error: fetchError } = await supabase
      .from('citizens')
      .select('*')
      .eq('id', citizenId)
      .single();

    if (fetchError) throw fetchError;

    // Delete the citizen record
    const { error } = await supabase.from('citizens').delete().eq('id', citizenId);

    if (error) throw error;

    // Insert audit log for deletion
    await logAudit({
      action: 'delete',
      table_name: 'citizens',
      record_id: citizenId.toString(),
      details: { 
        old: oldRecord,
        type: 'Senior Citizen Delete Record'
      },
      staff_id: user?.id
    });

    toast.success('Senior citizen record deleted successfully!');
    navigate('/citizens/list');
  } catch (error) {
    console.error('Error deleting record:', error);
    toast.error('Failed to delete record. Please try again.');
  } finally {
    setLoading(false);
    isSubmitting.current = false;
  }
};


  const updateExistingRecord = async () => {
    if (!duplicateRecord || !firstEntry) return;
    
    // Prevent duplicate submissions
    if (isSubmitting.current) {
      return;
    }

    try {
      isSubmitting.current = true;
      setLoading(true);
      
      const { error } = await supabase
        .from('citizens')
        .update({
          last_name: firstEntry.lastName,
          first_name: firstEntry.firstName,
          middle_name: firstEntry.middleName || null,
          extension_name: firstEntry.extensionName || null,
          birth_date: firstEntry.birthDate,
          sex: firstEntry.sex,
          province_code: firstEntry.provinceCode,
          lgu_code: firstEntry.lguCode,
          barangay_code: firstEntry.barangayCode,
          osca_id: firstEntry.oscaId || 'N/A',
          rrn: firstEntry.rrn || 'N/A',
          validator: firstEntry.validator || null,
          validation_date: firstEntry.validationDate || null,
          specimen: firstEntry.specimen || null,
          disability: firstEntry.disability || null,
          indigenous_people: firstEntry.indigenous_people || null
        })
        .eq('id', duplicateRecord.id);

      if (error) throw error;
      
      await logAudit({
        action: 'update',
        table_name: 'citizens',
        record_id: duplicateRecord.id.toString(),
        details: { 
          old: duplicateRecord,
          new: {
            last_name: firstEntry.lastName,
            first_name: firstEntry.firstName,
            middle_name: firstEntry.middleName || null,
            extension_name: firstEntry.extensionName || null,
            birth_date: firstEntry.birthDate,
            sex: firstEntry.sex,
            province_code: firstEntry.provinceCode,
            lgu_code: firstEntry.lguCode,
            barangay_code: firstEntry.barangayCode,
            osca_id: firstEntry.oscaId || 'N/A',
            rrn: firstEntry.rrn || 'N/A',
            validator: firstEntry.validator || null,
            validation_date: firstEntry.validationDate || null
          },
          type: 'Senior Citizen Update Record'
        },
        staff_id: user?.id
      });
      toast.success('Record updated successfully!');
      navigate('/citizens/list');
    } catch (error) {
      console.error('Error updating record:', error);
      toast.error('Failed to update record. Please try again.');
    } finally {
      setLoading(false);
      setShowDuplicateModal(false);
      isSubmitting.current = false;
    }
  };
  
  const goBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      navigate(-1);
    }
  };

  const handleUppercase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    e.target.value = value.toUpperCase();
  };

  const handleNameInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    // Remove any numeric characters (0-9) and convert to uppercase
    const filteredValue = value.replace(/[0-9]/g, '').toUpperCase();
    e.target.value = filteredValue;
  };


 
  return (
    <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-4" ref={formTopRef}>
      <div className="flex justify-between items-center mb-4">
        <button 
          type="button" 
          onClick={goBack}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={18} className="mr-2" />
          {step === 2 ? 'Back to First Entry' : 'Back'}
        </button>
        
        {/* Step indicator */}
        <div className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'} mr-2`}>
            1
          </div>
          <div className={`w-8 h-1 ${step === 2 ? 'bg-blue-600' : 'bg-gray-300'} mx-1`}></div>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
            2
          </div>
        </div>
      </div>
      
      <h1 className="text-xl font-bold text-blue-800 mb-3 text-center">
        {step === 1 ? 'Register New Senior Citizen' : 'Verify Senior Citizen Data'}
      </h1>
      
      <p className="text-sm text-gray-600 mb-4 text-center">
        {step === 1 ? 'Complete the application form with citizen information' : 'Verify data using primary or secondary ID'}
      </p>
      
      {step === 2 && (
        <div className="mb-4">
          <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded-md flex items-start mb-3">
            <AlertCircle size={20} className="text-blue-600 mr-2 mt-1 flex-shrink-0" />
            <div>
              <p className="text-blue-700 font-medium">
                Verification Step
              </p>
              <p className="text-blue-700">
                Please enter the information again to verify accuracy. 
                Both entries must match exactly to save the record.
              </p>
            </div>
          </div>
          
          {/* Validation Status */}
          {Object.keys(fieldMatches).length > 0 && (
            <div className={`p-3 rounded-md mb-3 ${mismatchCount > 0 ? 'bg-yellow-50 border border-yellow-300' : 'bg-green-50 border border-green-300'}`}>
              <div className="flex items-center mb-2">
                {mismatchCount > 0 ? (
                  <>
                    <AlertCircle size={18} className="text-yellow-600 mr-2" />
                    <h3 className="text-yellow-700 font-medium">Validation in Progress</h3>
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} className="text-green-600 mr-2" />
                    <h3 className="text-green-700 font-medium">All Fields Match!</h3>
                  </>
                )}
              </div>
              
              {mismatchCount > 0 && (
                <p className="text-yellow-700 text-sm">
                  {mismatchCount} field(s) don't match the first entry. Please check highlighted fields.
                </p>
              )}
            </div>
          )}
          
          {/* First Entry Summary */}
          <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
            <h3 className="text-sm text-gray-700 font-medium mb-2 flex items-center">
              <CheckCircle size={16} className="text-green-600 mr-2" />
              First Entry Summary
            </h3>
            {firstEntry && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Last Name:</span> 
                  <span className="ml-1 font-medium">{firstEntry.lastName}</span>
                </div>
                <div>
                  <span className="text-gray-500">First Name:</span> 
                  <span className="ml-1 font-medium">{firstEntry.firstName}</span>
                </div>
                <div>
                  <span className="text-gray-500">Middle Name:</span> 
                  <span className="ml-1 font-medium">{firstEntry.middleName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Extension Name:</span> 
                  <span className="ml-1 font-medium">{firstEntry.extensionName || 'None'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Birth Date:</span> 
                  <span className="ml-1 font-medium">{firstEntry.birthDate}</span>
                </div>
                <div>
                  <span className="text-gray-500">Sex:</span> 
                  <span className="ml-1 font-medium">{firstEntry.sex}</span>
                </div>
                <div>
                  <span className="text-gray-500">OSCA ID:</span> 
                  <span className="ml-1 font-medium">{firstEntry.oscaId || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500">RRN:</span> 
                  <span className="ml-1 font-medium">{firstEntry.rrn || 'N/A'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit(step === 1 ? onFirstSubmit : onSecondSubmit)} className="space-y-6">
        {/* 1. Identification Details */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-200 shadow-md">
          <div className="flex items-center mb-4">
            <div className="bg-indigo-600 p-2 rounded-lg mr-3">
              <CheckCircle size={20} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-indigo-900">1. Identification Details</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="oscaId" className="block text-gray-700 font-semibold mb-2">
                OSCA ID <span className="text-gray-400 text-sm font-normal">(optional)</span>
              </label>
              <input
                id="oscaId"
                type="text"
                {...register('oscaId')}
                className={`border ${
                  errors.oscaId 
                    ? 'border-red-500 bg-red-50' 
                    : step === 2 && watchAllFields.oscaId
                      ? fieldMatches.oscaId
                        ? 'border-green-500 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                        : 'border-yellow-500 bg-yellow-50 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200'
                      : 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
                } rounded-lg p-3 w-full transition-all duration-200 shadow-sm`}
                placeholder="Enter OSCA ID or leave blank for N/A"
                onChange={handleUppercase}
              />
              {errors.oscaId && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.oscaId.message}
                </p>
              )}
              <p className="text-gray-500 text-xs mt-1 italic">Will be set as "N/A" if left blank</p>
            </div>

            <div className="form-group">
              <label htmlFor="rrn" className="block text-gray-700 font-semibold mb-2">
                RRN <span className="text-gray-400 text-sm font-normal">(Regional Reference Number, optional)</span>
              </label>
              <input
                id="rrn"
                type="text"
                {...register('rrn')}
                className={`border ${
                  errors.rrn 
                    ? 'border-red-500 bg-red-50' 
                    : step === 2 && watchAllFields.rrn
                      ? fieldMatches.rrn
                        ? 'border-green-500 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                        : 'border-yellow-500 bg-yellow-50 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200'
                      : 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
                } rounded-lg p-3 w-full transition-all duration-200 shadow-sm`}
                placeholder="Enter RRN or leave blank for N/A"
                onChange={handleUppercase}
              />
              {errors.rrn && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.rrn.message}
                </p>
              )}
              <p className="text-gray-500 text-xs mt-1 italic">Will be set as "N/A" if left blank</p>
            </div>
          </div>
        </div>

        {/* 2. Personal Information */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200 shadow-md">
          <div className="flex items-center mb-4">
            <div className="bg-purple-600 p-2 rounded-lg mr-3">
              <User size={20} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-purple-900">2. Personal Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            <div className="form-group">
              <label htmlFor="lastName" className="block text-gray-700 font-semibold mb-2">
                Last Name <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                {...register('lastName', { required: 'Last name is required' })}
                className={`border ${
                  errors.lastName 
                    ? 'border-red-500 bg-red-50' 
                    : step === 2 && watchAllFields.lastName
                      ? fieldMatches.lastName
                        ? 'border-green-500 bg-green-50 focus:border-green-500 focus:ring-1 focus:ring-green-500'
                        : 'border-yellow-500 bg-yellow-50 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                } rounded-lg p-3 w-full transition-colors`}
                onChange={handleNameInput}
              />
              {errors.lastName && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.lastName.message}
                </p>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="firstName" className="block text-gray-700 font-semibold mb-2">
                First Name <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                {...register('firstName', { required: 'First name is required' })}
                className={`border ${
                  errors.firstName 
                    ? 'border-red-500 bg-red-50' 
                    : step === 2 && watchAllFields.firstName
                      ? fieldMatches.firstName
                        ? 'border-green-500 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                        : 'border-yellow-500 bg-yellow-50 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200'
                      : 'border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
                } rounded-lg p-3 w-full transition-all duration-200 shadow-sm`}
                onChange={handleNameInput}
              />
              {errors.firstName && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.firstName.message}
                </p>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="middleName" className="block text-gray-700 font-semibold mb-2">
                Middle Name <span className="text-gray-400 text-sm font-normal">(optional)</span>
              </label>
              <input
                id="middleName"
                type="text"
                {...register('middleName')}
                className={`border ${
                  errors.middleName 
                    ? 'border-red-500 bg-red-50' 
                    : step === 2 && watchAllFields.middleName
                      ? fieldMatches.middleName
                        ? 'border-green-500 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                        : 'border-yellow-500 bg-yellow-50 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200'
                      : 'border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
                } rounded-lg p-3 w-full transition-all duration-200 shadow-sm`}
                placeholder="Enter middle name"
                onChange={handleNameInput}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="extensionName" className="block text-gray-700 font-semibold mb-2">
                Extension Name <span className="text-gray-400 text-sm font-normal">(optional)</span>
              </label>
              <select
                id="extensionName"
                {...register('extensionName')}
                className={`border ${
                  errors.extensionName 
                    ? 'border-red-500 bg-red-50' 
                    : step === 2 && watchAllFields.extensionName
                      ? fieldMatches.extensionName
                        ? 'border-green-500 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                        : 'border-yellow-500 bg-yellow-50 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200'
                      : 'border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
                } rounded-lg p-3 w-full transition-all duration-200 shadow-sm`}
              >
                {EXTENSION_NAMES.map(ext => (
                  <option key={ext} value={ext}>{ext || 'None'}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="birthDate" className="block text-gray-700 font-semibold mb-2">
                Birth Date <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar size={18} className="text-gray-400" />
                </div>
                <input
                  id="birthDate"
                  type="date"
                  max={format(new Date(), 'yyyy-MM-dd')}
                  {...register('birthDate', { required: 'Birth date is required' })}
                  className={`border ${
                    errors.birthDate 
                      ? 'border-red-500 bg-red-50' 
                      : step === 2 && watchAllFields.birthDate
                        ? fieldMatches.birthDate
                          ? 'border-green-500 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                          : 'border-yellow-500 bg-yellow-50 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200'
                        : 'border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
                  } rounded-lg p-3 pl-11 w-full transition-all duration-200 shadow-sm`}
                />
              </div>
              {errors.birthDate && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.birthDate.message}
                </p>
              )}
              {age !== null && (
                <p className="text-purple-700 text-sm mt-1 font-medium">
                  Age: {age} years old
                </p>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="sex" className="block text-gray-700 font-semibold mb-2">
                Sex <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                id="sex"
                {...register('sex', { required: 'Sex is required' })}
                className={`border ${
                  errors.sex 
                    ? 'border-red-500 bg-red-50' 
                    : step === 2 && watchAllFields.sex
                      ? fieldMatches.sex
                        ? 'border-green-500 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                        : 'border-yellow-500 bg-yellow-50 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200'
                      : 'border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
                } rounded-lg p-3 w-full transition-all duration-200 shadow-sm`}
              >
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              {errors.sex && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.sex.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 3. Demographic Information */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-xl border border-emerald-200 shadow-md">
          <div className="flex items-center mb-4">
            <div className="bg-emerald-600 p-2 rounded-lg mr-3">
              <User size={20} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-emerald-900">3. Demographic Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group">
              <label htmlFor="specimen" className="block text-gray-700 font-semibold mb-2">
                Specimen <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                id="specimen"
                {...register('specimen', { required: 'Specimen is required' })}
                className={`border ${
                  errors.specimen 
                    ? 'border-red-500 bg-red-50' 
                    : step === 2 && watchAllFields.specimen
                      ? fieldMatches.specimen
                        ? 'border-green-500 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                        : 'border-yellow-500 bg-yellow-50 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200'
                      : 'border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'
                } rounded-lg p-3 w-full transition-all duration-200 shadow-sm`}
              >
                <option value="">Select...</option>
                <option value="signature">Signature</option>
                <option value="thumbmark">Thumbmark</option>
              </select>
              {errors.specimen && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.specimen.message}
                </p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="disability" className="block text-gray-700 font-semibold mb-2">
                Disability <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                id="disability"
                {...register('disability', { required: 'Disability status is required' })}
                className={`border ${
                  errors.disability 
                    ? 'border-red-500 bg-red-50' 
                    : step === 2 && watchAllFields.disability
                      ? fieldMatches.disability
                        ? 'border-green-500 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                        : 'border-yellow-500 bg-yellow-50 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200'
                      : 'border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'
                } rounded-lg p-3 w-full transition-all duration-200 shadow-sm`}
              >
                <option value="">Select...</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {errors.disability && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.disability.message}
                </p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="indigenous_people" className="block text-gray-700 font-semibold mb-2">
                Indigenous People (IP) <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                id="indigenous_people"
                {...register('indigenous_people', { required: 'Indigenous people status is required' })}
                className={`border ${
                  errors.indigenous_people 
                    ? 'border-red-500 bg-red-50' 
                    : step === 2 && watchAllFields.indigenous_people
                      ? fieldMatches.indigenous_people
                        ? 'border-green-500 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                        : 'border-yellow-500 bg-yellow-50 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200'
                      : 'border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'
                } rounded-lg p-3 w-full transition-all duration-200 shadow-sm`}
              >
                <option value="">Select...</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {errors.indigenous_people && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.indigenous_people.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-200 shadow-md">
          <div className="flex items-center mb-4">
            <div className="bg-blue-600 p-2 rounded-lg mr-3">
              <MapPin size={20} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-blue-900">Address Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group">
              <label htmlFor="provinceCode" className="block text-gray-700 font-semibold mb-2">
                Province <span className="text-red-500 ml-1">*</span>
              </label>
              <Controller
                name="provinceCode"
                control={control}
                rules={{ required: 'Province is required' }}
                render={({ field }) => (
                  <Select
                    {...field}
                    id="provinceCode"
                    options={provinces.map(p => ({ value: p.code, label: p.name }))}
                    value={provinces.find(p => p.code === field.value) ? { value: field.value, label: provinces.find(p => p.code === field.value)!.name } : null}
                    onChange={(option) => field.onChange(option?.value || '')}
                    placeholder="Search and select province..."
                    isClearable
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        borderColor: errors.provinceCode 
                          ? '#ef4444'
                          : step === 2 && watchAllFields.provinceCode
                            ? fieldMatches.provinceCode
                              ? '#22c55e'
                              : '#eab308'
                            : state.isFocused ? '#3b82f6' : '#d1d5db',
                        backgroundColor: errors.provinceCode
                          ? '#fef2f2'
                          : step === 2 && watchAllFields.provinceCode
                            ? fieldMatches.provinceCode
                              ? '#f0fdf4'
                              : '#fefce8'
                            : 'white',
                        boxShadow: state.isFocused 
                          ? errors.provinceCode
                            ? '0 0 0 1px #ef4444'
                            : step === 2 && watchAllFields.provinceCode
                              ? fieldMatches.provinceCode
                                ? '0 0 0 2px #bbf7d0'
                                : '0 0 0 2px #fef08a'
                              : '0 0 0 2px #bfdbfe'
                          : 'none',
                        '&:hover': {
                          borderColor: errors.provinceCode ? '#ef4444' : '#9ca3af'
                        },
                        minHeight: '48px',
                        borderRadius: '0.5rem'
                      }),
                      menu: (base) => ({
                        ...base,
                        zIndex: 9999
                      })
                    }}
                  />
                )}
              />
              {errors.provinceCode && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.provinceCode.message}
                </p>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="lguCode" className="block text-gray-700 font-semibold mb-2">
                City/Municipality <span className="text-red-500 ml-1">*</span>
              </label>
              <Controller
                name="lguCode"
                control={control}
                rules={{ required: 'City/Municipality is required' }}
                render={({ field }) => (
                  <Select
                    {...field}
                    id="lguCode"
                    options={lgus.map(l => ({ value: l.code, label: l.name }))}
                    value={lgus.find(l => l.code === field.value) ? { value: field.value, label: lgus.find(l => l.code === field.value)!.name } : null}
                    onChange={(option) => field.onChange(option?.value || '')}
                    placeholder={selectedProvinceCode ? "Search and select city/municipality..." : "Select Province first"}
                    isClearable
                    isDisabled={!selectedProvinceCode}
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        borderColor: errors.lguCode 
                          ? '#ef4444'
                          : step === 2 && watchAllFields.lguCode && selectedProvinceCode
                            ? fieldMatches.lguCode
                              ? '#22c55e'
                              : '#eab308'
                            : state.isFocused ? '#3b82f6' : selectedProvinceCode ? '#d1d5db' : '#e5e7eb',
                        backgroundColor: errors.lguCode
                          ? '#fef2f2'
                          : step === 2 && watchAllFields.lguCode && selectedProvinceCode
                            ? fieldMatches.lguCode
                              ? '#f0fdf4'
                              : '#fefce8'
                            : selectedProvinceCode ? 'white' : '#f3f4f6',
                        boxShadow: state.isFocused 
                          ? errors.lguCode
                            ? '0 0 0 1px #ef4444'
                            : step === 2 && watchAllFields.lguCode && selectedProvinceCode
                              ? fieldMatches.lguCode
                                ? '0 0 0 2px #bbf7d0'
                                : '0 0 0 2px #fef08a'
                              : '0 0 0 2px #bfdbfe'
                          : 'none',
                        '&:hover': {
                          borderColor: errors.lguCode ? '#ef4444' : '#9ca3af'
                        },
                        minHeight: '48px',
                        borderRadius: '0.5rem'
                      }),
                      menu: (base) => ({
                        ...base,
                        zIndex: 9999
                      })
                    }}
                  />
                )}
              />
              {errors.lguCode && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.lguCode.message}
                </p>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="barangayCode" className="block text-gray-700 font-semibold mb-2">
                Barangay <span className="text-red-500 ml-1">*</span>
              </label>
              <Controller
                name="barangayCode"
                control={control}
                rules={{ required: 'Barangay is required' }}
                render={({ field }) => (
                  <Select
                    {...field}
                    id="barangayCode"
                    options={barangays.map(b => ({ value: b.code, label: b.name }))}
                    value={barangays.find(b => b.code === field.value) ? { value: field.value, label: barangays.find(b => b.code === field.value)!.name } : null}
                    onChange={(option) => field.onChange(option?.value || '')}
                    placeholder={selectedLguCode ? "Search and select barangay..." : "Select City/Municipality first"}
                    isClearable
                    isDisabled={!selectedLguCode}
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        borderColor: errors.barangayCode 
                          ? '#ef4444'
                          : step === 2 && watchAllFields.barangayCode && selectedLguCode
                            ? fieldMatches.barangayCode
                              ? '#22c55e'
                              : '#eab308'
                            : state.isFocused ? '#3b82f6' : selectedLguCode ? '#d1d5db' : '#e5e7eb',
                        backgroundColor: errors.barangayCode
                          ? '#fef2f2'
                          : step === 2 && watchAllFields.barangayCode && selectedLguCode
                            ? fieldMatches.barangayCode
                              ? '#f0fdf4'
                              : '#fefce8'
                            : selectedLguCode ? 'white' : '#f3f4f6',
                        boxShadow: state.isFocused 
                          ? errors.barangayCode
                            ? '0 0 0 1px #ef4444'
                            : step === 2 && watchAllFields.barangayCode && selectedLguCode
                              ? fieldMatches.barangayCode
                                ? '0 0 0 2px #bbf7d0'
                                : '0 0 0 2px #fef08a'
                              : '0 0 0 2px #bfdbfe'
                          : 'none',
                        '&:hover': {
                          borderColor: errors.barangayCode ? '#ef4444' : '#9ca3af'
                        },
                        minHeight: '48px',
                        borderRadius: '0.5rem'
                      }),
                      menu: (base) => ({
                        ...base,
                        zIndex: 9999
                      })
                    }}
                  />
                )}
              />
              {errors.barangayCode && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.barangayCode.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Validation Information */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-xl border border-amber-200 shadow-md">
          <div className="flex items-center mb-4">
            <div className="bg-amber-600 p-2 rounded-lg mr-3">
              <CheckCircle size={20} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-amber-900">Validation Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="validator" className="block text-gray-700 font-semibold mb-2">
                Validator <span className="text-red-500 ml-1">*</span>
              </label>
              <Controller
                name="validator"
                control={control}
                rules={{ required: 'Validator is required' }}
                render={({ field }) => (
                  <Select
                    {...field}
                    id="validator"
                    options={VALIDATORS.map(v => ({ value: v, label: v }))}
                    value={VALIDATORS.find(v => v === field.value) ? { value: field.value, label: field.value } : null}
                    onChange={(option) => field.onChange(option?.value || '')}
                    placeholder="Search and select validator..."
                    isClearable
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        borderColor: errors.validator 
                          ? '#ef4444'
                          : step === 2 && watchAllFields.validator
                            ? fieldMatches.validator
                              ? '#22c55e'
                              : '#eab308'
                            : state.isFocused ? '#f59e0b' : '#d1d5db',
                        backgroundColor: errors.validator
                          ? '#fef2f2'
                          : step === 2 && watchAllFields.validator
                            ? fieldMatches.validator
                              ? '#f0fdf4'
                              : '#fefce8'
                            : 'white',
                        boxShadow: state.isFocused 
                          ? errors.validator
                            ? '0 0 0 1px #ef4444'
                            : step === 2 && watchAllFields.validator
                              ? fieldMatches.validator
                                ? '0 0 0 2px #bbf7d0'
                                : '0 0 0 2px #fef08a'
                              : '0 0 0 2px #fde68a'
                          : 'none',
                        '&:hover': {
                          borderColor: errors.validator ? '#ef4444' : '#9ca3af'
                        },
                        minHeight: '48px',
                        borderRadius: '0.5rem'
                      }),
                      menu: (base) => ({
                        ...base,
                        zIndex: 9999
                      })
                    }}
                  />
                )}
              />
              {errors.validator && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.validator.message}
                </p>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="validationDate" className="block text-gray-700 font-semibold mb-2">
                Date of Validation <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar size={18} className="text-gray-400" />
                </div>
                <input
                  id="validationDate"
                  type="date"
                  {...register('validationDate', { required: 'Date of validation is required' })}
                  className={`border ${
                    errors.validationDate 
                      ? 'border-red-500 bg-red-50' 
                      : step === 2 && watchAllFields.validationDate
                        ? fieldMatches.validationDate
                          ? 'border-green-500 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                          : 'border-yellow-500 bg-yellow-50 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200'
                        : 'border-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                  } rounded-lg p-3 pl-11 w-full transition-all duration-200 shadow-sm`}
                  max={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
              {errors.validationDate && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.validationDate.message}
                </p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end mt-6">
          <button
            type="submit"
            className={`flex items-center justify-center px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader size={18} className="animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                {step === 1 ? 'Next: Verify Data' : 'Save Record'}
                {step === 1 ? null : <CheckCircle size={18} className="ml-2" />}
              </>
            )}
          </button>
        </div>
      </form>

      {showDuplicateModal && duplicateRecord && firstEntry && (
        <DuplicateModal
          newRecord={{
            last_name: firstEntry.lastName,
            first_name: firstEntry.firstName,
            middle_name: firstEntry.middleName,
            extension_name: firstEntry.extensionName,
            birth_date: firstEntry.birthDate,
            sex: firstEntry.sex,
            province_code: firstEntry.provinceCode,
            lgu_code: firstEntry.lguCode,
            barangay_code: firstEntry.barangayCode,
            osca_id: firstEntry.oscaId || 'N/A',
            rrn: firstEntry.rrn || 'N/A',
            validator: firstEntry.validator || null,
            validation_date: firstEntry.validationDate || null
          }}
          existingRecord={duplicateRecord}
          addressDetails={addressDetails}
          onClose={() => setShowDuplicateModal(false)}
          onProceed={() => {
            setShowDuplicateModal(false);
            saveRecord(firstEntry);
          }}
          onUpdate={updateExistingRecord}
          matchedFields={matchedFields}
        />
      )}
    </div>
  );
}




export default CitizenForm;
