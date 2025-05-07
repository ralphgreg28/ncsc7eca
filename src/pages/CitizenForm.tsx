import { useState, useEffect, useRef } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { format, differenceInYears } from 'date-fns';
import { toast } from 'react-toastify';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  'REMARK M. SERDAN',
  'JOVEN J. CALMA'
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

  
  const { register, handleSubmit, watch, formState: { errors }, reset, setValue } = useForm<CitizenFormInput>();
  
  const birthDate = watch('birthDate');
  const selectedProvinceCode = watch('provinceCode');
  const selectedLguCode = watch('lguCode');
  
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
  
  const onFirstSubmit: SubmitHandler<CitizenFormInput> = (data) => {
    setFirstEntry(data);
    setStep(2);
    reset();
    
    
  };
  
  const onSecondSubmit: SubmitHandler<CitizenFormInput> = async (data) => {
    if (!firstEntry) return;
    
    const fieldsToCompare = [
      'lastName', 'firstName', 'middleName', 'extensionName', 
      'birthDate', 'sex', 'provinceCode', 'lguCode', 'barangayCode',
      'oscaId', 'rrn', 'validator', 'validationDate'
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
  try {
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
      encoded_by: encodedBy
    });

    if (error) throw error;

    // Insert audit log for creation
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

    toast.success('Senior citizen record saved successfully!');
    navigate('/citizens/list');
  } catch (error) {
    console.error('Error saving record:', error);
    toast.error('Failed to save record. Please try again.');
  } finally {
    setLoading(false);
  }
};

const updateRecord = async (data: CitizenFormInput, citizenId: number) => {
  try {
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
      validation_date: data.validationDate || null
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
  }
};


// Delete record function
const deleteRecord = async (citizenId: number) => {
  try {
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
  }
};


  const updateExistingRecord = async () => {
    if (!duplicateRecord || !firstEntry) return;

    try {
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
          validation_date: firstEntry.validationDate || null
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


 
  return (
    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <button 
          type="button" 
          onClick={goBack}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} className="mr-1" />
          {step === 2 ? 'Back to First Entry' : 'Back'}
        </button>
      </div>
      
      <h1 className="text-2xl font-bold text-blue-800 mb-6">
        {step === 1 ? 'Register New Senior Citizen - First Entry' : 'Register New Senior Citizen - Verify Data'}
      </h1>
      
      {step === 2 && (
        <div className="mb-6 p-4 bg-blue-50 rounded-md">
          <p className="text-blue-700">
            Please enter the information again to verify accuracy. 
            Both entries must match exactly to save the record.
          </p>
        </div>
      )}
      
      <form onSubmit={handleSubmit(step === 1 ? onFirstSubmit : onSecondSubmit)}>
        <div className="bg-gray-50 p-4 rounded-md mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

             <div className="form-group">
              <label htmlFor="oscaId">OSCA ID</label>
              <input
                id="oscaId"
                type="text"
                {...register('oscaId')}
                className={`border ${errors.oscaId ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 w-full`}
                placeholder="Enter OSCA ID (optional)"
                onChange={handleUppercase}
               
              />
              {errors.oscaId && <p className="form-error">{errors.oscaId.message}</p>}
              <p className="form-hint">Leave blank to set as N/A</p>
            </div>

            <div className="form-group">
              <label htmlFor="rrn">RRN (Regional Reference Number)</label>
              <input
                id="rrn"
                type="text"
                {...register('rrn')}
                className={`border ${errors.rrn ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 w-full`}
                placeholder="Enter RRN (optional)"
                onChange={handleUppercase}
              />
              {errors.rrn && <p className="form-error">{errors.rrn.message}</p>}
              <p className="form-hint">Leave blank to set as N/A</p>
            </div>
            
            <div className="form-group">
              <label htmlFor="lastName">Last Name *</label>
              <input
                id="lastName"
                type="text"
                {...register('lastName', { required: 'Last name is required' })}
                className={`border ${errors.lastName ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 w-full`}
                onChange={handleUppercase}
              />
              {errors.lastName && <p className="form-error">{errors.lastName.message}</p>}
            </div>
            
            <div className="form-group">
              <label htmlFor="firstName">First Name *</label>
              <input
                id="firstName"
                type="text"
                {...register('firstName', { required: 'First name is required' })}
                className={`border ${errors.firstName ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 w-full`}
                onChange={handleUppercase}
              />
              {errors.firstName && <p className="form-error">{errors.firstName.message}</p>}
            </div>
            
            <div className="form-group">
              <label htmlFor="middleName">Middle Name</label>
              <input
                id="middleName"
                type="text"
                {...register('middleName')}
                className="border border-gray-300 rounded-md p-2 w-full"
                onChange={handleUppercase}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="extensionName">Extension Name</label>
              <select
                id="extensionName"
                {...register('extensionName')}
                className="border border-gray-300 rounded-md p-2 w-full"
              >
                {EXTENSION_NAMES.map(ext => (
                  <option key={ext} value={ext}>{ext || 'None'}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="form-group">
              <label htmlFor="birthDate">Birth Date *</label>
              <input
                id="birthDate"
                type="date"
                max={format(new Date(), 'yyyy-MM-dd')}
                {...register('birthDate', { required: 'Birth date is required' })}
                className={`border ${errors.birthDate ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 w-full`}
              />
              {errors.birthDate && <p className="form-error">{errors.birthDate.message}</p>}
              {age !== null && <p className="form-hint">Age: {age} years old</p>}
            </div>
            
            <div className="form-group">
              <label htmlFor="sex">Sex *</label>
              <select
                id="sex"
                {...register('sex', { required: 'Sex is required' })}
                className={`border ${errors.sex ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 w-full`}
              >
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              {errors.sex && <p className="form-error">{errors.sex.message}</p>}
            </div>

           
          </div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-md mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Address Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="provinceCode">Province *</label>
              <select
                id="provinceCode"
                {...register('provinceCode', { required: 'Province is required' })}
                className={`border ${errors.provinceCode ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 w-full`}
              >
                <option value="">Select Province</option>
                {provinces.map(province => (
                  <option key={province.code} value={province.code}>
                    {province.name}
                  </option>
                ))}
              </select>
              {errors.provinceCode && <p className="form-error">{errors.provinceCode.message}</p>}
            </div>
            
            <div className="form-group">
              <label htmlFor="lguCode">City/Municipality *</label>
              <select
                id="lguCode"
                {...register('lguCode', { required: 'City/Municipality is required' })}
                className={`border ${errors.lguCode ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 w-full`}
                disabled={!selectedProvinceCode}
              >
                <option value="">Select City/Municipality</option>
                {lgus.map(lgu => (
                  <option key={lgu.code} value={lgu.code}>
                    {lgu.name}
                  </option>
                ))}
              </select>
              {errors.lguCode && <p className="form-error">{errors.lguCode.message}</p>}
            </div>
            
            <div className="form-group">
              <label htmlFor="barangayCode">Barangay *</label>
              <select
                id="barangayCode"
                {...register('barangayCode', { required: 'Barangay is required' })}
                className={`border ${errors.barangayCode ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 w-full`}
                disabled={!selectedLguCode}
              >
                <option value="">Select Barangay</option>
                {barangays.map(barangay => (
                  <option key={barangay.code} value={barangay.code}>
                    {barangay.name}
                  </option>
                ))}
              </select>
              {errors.barangayCode && <p className="form-error">{errors.barangayCode.message}</p>}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-md mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Validation Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="validator">Validator *</label>
              <select
                id="validator"
                {...register('validator', { required: 'Validator is required' })}
                className={`border ${errors.validator ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 w-full`}
              >
                <option value="">Select Validator...</option>
                {VALIDATORS.map(validator => (
                  <option key={validator} value={validator}>{validator}</option>
                ))}
              </select>
              {errors.validator && <p className="form-error">{errors.validator.message}</p>}
            </div>
            
            <div className="form-group">
              <label htmlFor="validationDate">Date of Validation *</label>
              <input
                id="validationDate"
                type="date"
                {...register('validationDate', { required: 'Date of validation is required' })}
                className={`border ${errors.validationDate ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 w-full`}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
              {errors.validationDate && <p className="form-error">{errors.validationDate.message}</p>}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            className={`btn-primary ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            disabled={loading}
          >
            {loading ? 'Processing...' : step === 1 ? 'Next: Verify Data' : 'Save Record'}
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
