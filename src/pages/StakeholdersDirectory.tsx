import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Edit2, Plus, X, Phone, Mail, Search, Filter, Download, Eye, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DuplicateStakeholderModal from '../components/DuplicateStakeholderModal';
import StakeholderViewModal from '../components/StakeholderViewModal';
import Papa from 'papaparse';

interface StakeholderPosition {
  id: number;
  name: string;
  level: 'province' | 'lgu' | 'barangay';
}

interface Stakeholder {
  id: string;
  position_id: number;
  province_code: string;
  lgu_code: string | null;
  barangay_code: string | null;
  name: string;
  updated_at: string;
  updated_by: string | null;
  contacts: {
    id: string;
    type: 'phone' | 'email';
    value: string;
    priority: number;
  }[];
}

interface AddressOption {
  code: string;
  name: string;
}

interface StakeholderFormData {
  name: string;
  position_id: number;
  province_code: string;
  lgu_code?: string;
  barangay_code?: string;
  phones: string[];
  emails: string[];
}

interface Filters {
  search: string;
  position: number;
  province: string;
  lgu: string;
  barangay: string;
  showFilters?: boolean;
}

interface AddressDetails {
  provinces: Record<string, string>;
  lgus: Record<string, string>;
  barangays: Record<string, string>;
}

// Position colors based on level
const POSITION_COLORS = {
  province: 'bg-purple-100 text-purple-800',
  lgu: 'bg-blue-100 text-blue-800',
  barangay: 'bg-green-100 text-green-800'
};

// Province colors - using a set of professional, distinguishable colors
const PROVINCE_COLORS = [
  'bg-blue-50 text-blue-700',
  'bg-emerald-50 text-emerald-700',
  'bg-amber-50 text-amber-700',
  'bg-rose-50 text-rose-700',
  'bg-violet-50 text-violet-700',
  'bg-cyan-50 text-cyan-700',
  'bg-lime-50 text-lime-700',
  'bg-orange-50 text-orange-700'
];

function StakeholdersDirectory() {
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState<Stakeholder | null>(null);
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [positions, setPositions] = useState<StakeholderPosition[]>([]);
  const [provinces, setProvinces] = useState<AddressOption[]>([]);
  const [lgus, setLgus] = useState<AddressOption[]>([]);
  const [barangays, setBarangays] = useState<AddressOption[]>([]);
  const [addressDetails, setAddressDetails] = useState<AddressDetails>({
    provinces: {},
    lgus: {},
    barangays: {}
  });
  // Separate state for filter visibility
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<Filters>({
    search: '',
    position: 0,
    province: '',
    lgu: '',
    barangay: ''
  });
  const [duplicateData, setDuplicateData] = useState<{
    newData: StakeholderFormData;
    existingData: Stakeholder;
    addressDetails: {
      positionName: string;
      provinceName: string;
      lguName?: string;
      barangayName?: string;
    };
  } | null>(null);
  
  const { user } = useAuth();
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<StakeholderFormData>();

  const selectedPosition = watch('position_id');
  const selectedProvince = watch('province_code');
  const selectedLgu = watch('lgu_code');

  // Explicitly type positionLevel to include undefined
  const positionLevel: 'province' | 'lgu' | 'barangay' | undefined = positions.find(p => p.id === Number(selectedPosition))?.level;

  useEffect(() => {
    fetchStakeholders();
    fetchPositions();
    fetchProvinces();
  }, []);

  useEffect(() => {
    if (selectedProvince) {
      fetchLGUs();
    }
  }, [selectedProvince]);

  useEffect(() => {
    if (selectedLgu) {
      fetchBarangays();
    }
  }, [selectedLgu]);

  useEffect(() => {
    fetchStakeholders();
  }, [filters]);

  const fetchStakeholders = async () => {
    try {
      setLoading(true);
      let query = supabase.from('stakeholders').select('*');

      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      if (filters.position) {
        query = query.eq('position_id', filters.position);
      }

      if (filters.province) {
        query = query.eq('province_code', filters.province);
      }

      if (filters.lgu) {
        query = query.eq('lgu_code', filters.lgu);
      }

      if (filters.barangay) {
        query = query.eq('barangay_code', filters.barangay);
      }

      const { data: stakeholders, error: stakeholdersError } = await query;
      if (stakeholdersError) throw stakeholdersError;

      const { data: contacts, error: contactsError } = await supabase
        .from('stakeholder_contacts')
        .select('*');

      if (contactsError) throw contactsError;

      // Get unique address codes
      const provinceCodes = [...new Set(stakeholders?.map(s => s.province_code) || [])];
      const lguCodes = [...new Set(stakeholders?.map(s => s.lgu_code).filter(Boolean) || [])];
      const barangayCodes = [...new Set(stakeholders?.map(s => s.barangay_code).filter(Boolean) || [])];

      // Fetch address details
      const [
        { data: provinceData },
        { data: lguData },
        { data: barangayData }
      ] = await Promise.all([
        supabase.from('provinces').select('code, name').in('code', provinceCodes),
        supabase.from('lgus').select('code, name').in('code', lguCodes),
        supabase.from('barangays').select('code, name').in('code', barangayCodes)
      ]);

      // Create lookup maps
      const provinceMap = Object.fromEntries((provinceData || []).map(p => [p.code, p.name]));
      const lguMap = Object.fromEntries((lguData || []).map(l => [l.code, l.name]));
      const barangayMap = Object.fromEntries((barangayData || []).map(b => [b.code, b.name]));

      setAddressDetails({
        provinces: provinceMap,
        lgus: lguMap,
        barangays: barangayMap
      });

      const stakeholdersWithContacts = stakeholders?.map(stakeholder => ({
        ...stakeholder,
        contacts: contacts?.filter(contact => contact.stakeholder_id === stakeholder.id)
          .sort((a, b) => a.priority - b.priority) || []
      })) || [];

      setStakeholders(stakeholdersWithContacts);
    } catch (error) {
      console.error('Error fetching stakeholders:', error);
      toast.error('Failed to load stakeholders');
    } finally {
      setLoading(false);
    }
  };

  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('stakeholder_positions')
        .select('*')
        .order('level, name');

      if (error) throw error;
      setPositions(data);
    } catch (error) {
      console.error('Error fetching positions:', error);
      toast.error('Failed to load positions');
    }
  };

  const fetchProvinces = async () => {
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
  };

  const fetchLGUs = async () => {
    try {
      const { data, error } = await supabase
        .from('lgus')
        .select('code, name')
        .eq('province_code', selectedProvince)
        .order('name');

      if (error) throw error;
      setLgus(data || []);
      setValue('lgu_code', '');
      setValue('barangay_code', '');
    } catch (error) {
      console.error('Error fetching LGUs:', error);
      toast.error('Failed to load LGUs');
    }
  };

  const fetchBarangays = async () => {
    try {
      const { data, error } = await supabase
        .from('barangays')
        .select('code, name')
        .eq('lgu_code', selectedLgu)
        .order('name');

      if (error) throw error;
      setBarangays(data || []);
      setValue('barangay_code', '');
    } catch (error) {
      console.error('Error fetching barangays:', error);
      toast.error('Failed to load barangays');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('stakeholders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Stakeholder deleted successfully');
      setShowDeleteConfirm(null);
      fetchStakeholders();
    } catch (error) {
      console.error('Error deleting stakeholder:', error);
      toast.error('Failed to delete stakeholder');
    }
  };

  const checkForDuplicates = async (data: StakeholderFormData) => {
    try {
      const { data: existingStakeholders, error } = await supabase
        .from('stakeholders')
        .select('*')
        .eq('position_id', data.position_id)
        .eq('province_code', data.province_code);

      if (error) throw error;

      if (existingStakeholders && existingStakeholders.length > 0) {
        const matchingStakeholder = existingStakeholders.find(s => {
          // Skip the current stakeholder being edited
          if (editingStakeholder && s.id === editingStakeholder.id) {
            return false;
          }
          
          const lguMatch = (!data.lgu_code && !s.lgu_code) || (data.lgu_code === s.lgu_code);
          const barangayMatch = (!data.barangay_code && !s.barangay_code) || (data.barangay_code === s.barangay_code);
          return lguMatch && barangayMatch;
        });

        if (matchingStakeholder) {
          const { data: contacts } = await supabase
            .from('stakeholder_contacts')
            .select('*')
            .eq('stakeholder_id', matchingStakeholder.id);

          const existingData = {
            ...matchingStakeholder,
            contacts: contacts || []
          };

          const position = positions.find(p => p.id === data.position_id);
          const province = provinces.find(p => p.code === data.province_code);
          const lgu = data.lgu_code ? lgus.find(l => l.code === data.lgu_code) : undefined;
          const barangay = data.barangay_code ? barangays.find(b => b.code === data.barangay_code) : undefined;

          setDuplicateData({
            newData: data,
            existingData,
            addressDetails: {
              positionName: position?.name || '',
              provinceName: province?.name || '',
              lguName: lgu?.name,
              barangayName: barangay?.name
            }
          });
          setShowDuplicateModal(true);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking duplicates:', error);
      return false;
    }
  };

  const onSubmit = async (data: StakeholderFormData) => {
    try {
      setLoading(true);

      // If we're editing, skip duplicate check or pass the existing ID
      if (editingStakeholder) {
        await saveStakeholder(data, editingStakeholder.id);
      } else {
        const hasDuplicates = await checkForDuplicates(data);
        if (hasDuplicates) return;
        await saveStakeholder(data);
      }
    } catch (error) {
      console.error('Error saving stakeholder:', error);
      toast.error('Failed to save stakeholder');
    } finally {
      setLoading(false);
    }
  };

  // Type guard function to check position level
  const isPositionLevel = (level: 'province' | 'lgu' | 'barangay' | undefined, checkLevel: 'province' | 'lgu' | 'barangay'): boolean => {
    return level === checkLevel;
  };

  const saveStakeholder = async (data: StakeholderFormData, existingId?: string) => {
    try {
      const stakeholderData = {
        name: data.name,
        position_id: data.position_id,
        province_code: data.province_code,
        lgu_code: isPositionLevel(positionLevel, 'province') ? null : data.lgu_code,
        barangay_code: isPositionLevel(positionLevel, 'barangay') ? data.barangay_code : null,
        updated_by: user?.username || null
      };

      let stakeholderId: string;

      if (existingId) {
        // Workaround: Delete the existing record and create a new one instead of updating
        
        // First, delete existing contacts
        await supabase
          .from('stakeholder_contacts')
          .delete()
          .eq('stakeholder_id', existingId);
          
        // Then delete the existing stakeholder
        const { error: deleteError } = await supabase
          .from('stakeholders')
          .delete()
          .eq('id', existingId);
          
        if (deleteError) throw deleteError;
        
        // Create a new stakeholder with the updated data
        const { data: newStakeholder, error: insertError } = await supabase
          .from('stakeholders')
          .insert(stakeholderData)
          .select()
          .single();

        if (insertError) throw insertError;
        if (!newStakeholder) throw new Error('Failed to create stakeholder');
        stakeholderId = newStakeholder.id;
      } else {
        // Create a new stakeholder
        const { data: newStakeholder, error: insertError } = await supabase
          .from('stakeholders')
          .insert(stakeholderData)
          .select()
          .single();

        if (insertError) throw insertError;
        if (!newStakeholder) throw new Error('Failed to create stakeholder');
        stakeholderId = newStakeholder.id;
      }

      // Insert phone contacts
      const phoneContacts = data.phones
        .filter(phone => phone.trim())
        .map((phone, index) => ({
          stakeholder_id: stakeholderId,
          type: 'phone' as const,
          value: phone,
          priority: index + 1
        }));

      if (phoneContacts.length > 0) {
        const { error: phoneError } = await supabase
          .from('stakeholder_contacts')
          .insert(phoneContacts);

        if (phoneError) throw phoneError;
      }

      // Insert email contacts
      const emailContacts = data.emails
        .filter(email => email.trim())
        .map((email, index) => ({
          stakeholder_id: stakeholderId,
          type: 'email' as const,
          value: email,
          priority: index + 1
        }));

      if (emailContacts.length > 0) {
        const { error: emailError } = await supabase
          .from('stakeholder_contacts')
          .insert(emailContacts);

        if (emailError) throw emailError;
      }

      toast.success(existingId ? 'Stakeholder updated successfully' : 'Stakeholder added successfully');
      setShowModal(false);
      setShowDuplicateModal(false);
      fetchStakeholders();
    } catch (error) {
      console.error('Error saving stakeholder:', error);
      toast.error('Failed to save stakeholder');
    }
  };

  const handleUpdateExisting = async () => {
    if (!duplicateData) return;
    // Use the same delete-and-create approach for updating existing stakeholders
    await saveStakeholder(duplicateData.newData, duplicateData.existingData.id);
  };

  const handleCreateNew = async () => {
    if (!duplicateData) return;
    await saveStakeholder(duplicateData.newData);
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      position: 0,
      province: '',
      lgu: '',
      barangay: ''
    });
    // Keep filters visible after reset
    setShowFilters(true);
  };

  const handleProvinceChange = async (province: string) => {
    try {
      setFilters(prev => ({
        ...prev,
        province,
        lgu: '',
        barangay: ''
      }));

      if (province) {
        const { data, error } = await supabase
          .from('lgus')
          .select('code, name')
          .eq('province_code', province)
          .order('name');

        if (error) throw error;
        setLgus(data || []);
      } else {
        setLgus([]);
      }
      setBarangays([]);
    } catch (error) {
      console.error('Error fetching LGUs:', error);
      toast.error('Failed to load LGUs');
    }
  };

  const handleLguChange = async (lgu: string) => {
    try {
      setFilters(prev => ({
        ...prev,
        lgu,
        barangay: ''
      }));

      if (lgu) {
        const { data, error } = await supabase
          .from('barangays')
          .select('code, name')
          .eq('lgu_code', lgu)
          .order('name');

        if (error) throw error;
        setBarangays(data || []);
      } else {
        setBarangays([]);
      }
    } catch (error) {
      console.error('Error fetching barangays:', error);
      toast.error('Failed to load barangays');
    }
  };

  const getPositionColor = (positionId: number) => {
    const position = positions.find(p => p.id === positionId);
    return position ? POSITION_COLORS[position.level] : 'bg-gray-100 text-gray-800';
  };

  const getProvinceColor = (provinceCode: string) => {
    const index = provinces.findIndex(p => p.code === provinceCode);
    return PROVINCE_COLORS[index % PROVINCE_COLORS.length];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stakeholders Directory</h1>
          <p className="mt-1 text-gray-600">{stakeholders.length} stakeholders found</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-outline flex items-center"
          >
            <Filter className="h-5 w-5 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <button 
            onClick={async () => {
              try {
                const exportData = stakeholders.map(stakeholder => {
                  const position = positions.find(p => p.id === stakeholder.position_id);
                  const provinceName = addressDetails.provinces[stakeholder.province_code] || '';
                  const lguName = stakeholder.lgu_code ? addressDetails.lgus[stakeholder.lgu_code] : '';
                  const barangayName = stakeholder.barangay_code ? addressDetails.barangays[stakeholder.barangay_code] : '';

                  const phones = stakeholder.contacts
                    .filter(c => c.type === 'phone')
                    .sort((a, b) => a.priority - b.priority)
                    .map(c => c.value);

                  const emails = stakeholder.contacts
                    .filter(c => c.type === 'email')
                    .sort((a, b) => a.priority - b.priority)
                    .map(c => c.value);

                  return {
                    'Name': stakeholder.name,
                    'Position': position?.name || '',
                    'Province': provinceName,
                    'City/Municipality': lguName,
                    'Barangay': barangayName,
                    'Phone 1': phones[0] || '',
                    'Phone 2': phones[1] || '',
                    'Phone 3': phones[2] || '',
                    'Email 1': emails[0] || '',
                    'Email 2': emails[1] || '',
                    'Email 3': emails[2] || '',
                    'Last Updated': new Date(stakeholder.updated_at).toLocaleString(),
                    'Updated By': stakeholder.updated_by || ''
                  };
                });

                const csv = Papa.unparse(exportData);
                const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `stakeholders_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                toast.success(`Exported ${exportData.length} records successfully`);
              } catch (error) {
                console.error('Error exporting data:', error);
                toast.error('Failed to export data');
              }
            }}
            className="btn-secondary flex items-center"
          >
            <Download className="h-5 w-5 mr-2" />
            Export Filtered Data
          </button>
          <button
            onClick={() => {
              setEditingStakeholder(null);
              reset({
                name: '',
                position_id: 0,
                province_code: '',
                lgu_code: '',
                barangay_code: '',
                phones: ['', '', ''],
                emails: ['', '', '']
              });
              setShowModal(true);
            }}
            className="btn-primary flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Stakeholder
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Filters</h2>
            <button
              onClick={resetFilters}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Search</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="Search by name..."
                  className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Position</label>
              <select
                value={filters.position}
                onChange={(e) => setFilters(prev => ({ ...prev, position: Number(e.target.value) }))}
                className="mt-1 block w-full rounded-md border-gray-300"
              >
                <option value={0}>All Positions</option>
                {positions.map(position => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Province</label>
              <select
                value={filters.province}
                onChange={(e) => handleProvinceChange(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300"
              >
                <option value="">All Provinces</option>
                {provinces.map(province => (
                  <option key={province.code} value={province.code}>
                    {province.name}
                  </option>
                ))}
              </select>
            </div>

            {filters.province && (
              <div>
                <label className="block text-sm font-medium text-gray-700">City/Municipality</label>
                <select
                  value={filters.lgu}
                  onChange={(e) => handleLguChange(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300"
                >
                  <option value="">All Cities/Municipalities</option>
                  {lgus.map(lgu => (
                    <option key={lgu.code} value={lgu.code}>
                      {lgu.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {filters.lgu && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Barangay</label>
                <select
                  value={filters.barangay}
                  onChange={(e) => setFilters(prev => ({ ...prev, barangay: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300"
                >
                  <option value="">All Barangays</option>
                  {barangays.map(barangay => (
                    <option key={barangay.code} value={barangay.code}>
                      {barangay.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

     {/* Compact Color Legend */}
<div className="bg-white rounded shadow-sm p-3 text-xs text-gray-700">
  <h3 className="font-semibold mb-2">Color Legend</h3>
  <div className="flex flex-wrap gap-6">
    
    {/* Position Levels */}
    <div>
      <h4 className="mb-1 font-medium text-gray-600">Position Levels</h4>
      <div className="flex flex-wrap gap-2">
        {Object.entries(POSITION_COLORS).map(([level, color]) => (
          <span key={level} className={`px-2 py-0.5 rounded-full ${color} capitalize`}>
            {level}
          </span>
        ))}
      </div>
    </div>

    {/* Provinces (Scrollable Inline) */}
    <div>
      <h4 className="mb-1 font-medium text-gray-600">Provinces</h4>
      <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto overflow-x-hidden pr-1" style={{ maxWidth: '300px' }}>
        {provinces.map((province, i) => (
          <span key={province.code} className={`px-2 py-0.5 rounded-full ${PROVINCE_COLORS[i % PROVINCE_COLORS.length]} truncate`}>
            {province.name}
          </span>
        ))}
      </div>
    </div>

  </div>
</div>


   {/* Stakeholders List */}
<div className="bg-white rounded-lg shadow overflow-hidden">
  <div className="overflow-x-auto">
    <table className="min-w-full table-auto divide-y divide-gray-200 text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</th>
          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact Info</th>
          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Updated</th>
          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {loading ? (
          <tr>
            <td colSpan={6} className="text-center py-2">
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <span className="text-xs text-gray-500">Loading...</span>
              </div>
            </td>
          </tr>
        ) : stakeholders.length === 0 ? (
          <tr>
            <td colSpan={6} className="text-center py-2 text-gray-500">No stakeholders found</td>
          </tr>
        ) : (
          stakeholders.map((stakeholder) => {
            const position = positions.find(p => p.id === stakeholder.position_id);
            const provinceName = addressDetails.provinces[stakeholder.province_code] || 'Unknown Province';
            const lguName = stakeholder.lgu_code ? addressDetails.lgus[stakeholder.lgu_code] : undefined;
            const barangayName = stakeholder.barangay_code ? addressDetails.barangays[stakeholder.barangay_code] : undefined;

            const phones = stakeholder.contacts.filter(c => c.type === 'phone').sort((a, b) => a.priority - b.priority);
            const emails = stakeholder.contacts.filter(c => c.type === 'email').sort((a, b) => a.priority - b.priority);

            return (
              <tr key={stakeholder.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getPositionColor(stakeholder.position_id)}`}>
                    {position?.name || 'Unknown Position'}
                  </span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{stakeholder.name}</div>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <div className="space-y-1">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getProvinceColor(stakeholder.province_code)}`}>
                      {provinceName}
                    </span>
                    {lguName && <div className="text-xs text-gray-500">{lguName}</div>}
                    {barangayName && <div className="text-xs text-gray-500">{barangayName}</div>}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="space-y-1">
                    {phones.map((phone, index) => (
                      <div key={`phone-${index}`} className="flex items-center text-xs text-gray-500">
                        <Phone className="h-4 w-4 text-gray-400 mr-1" />
                        {phone.value}
                      </div>
                    ))}
                    {emails.map((email, index) => (
                      <div key={`email-${index}`} className="flex items-center text-xs text-gray-500">
                        <Mail className="h-4 w-4 text-gray-400 mr-1" />
                        {email.value}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  <div>{new Date(stakeholder.updated_at).toLocaleString()}</div>
                  {stakeholder.updated_by && (
                    <div className="text-xs text-gray-400">by {stakeholder.updated_by}</div>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-xs font-medium space-x-2">
                  <button
                    onClick={() => setShowViewModal(stakeholder)}
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                    aria-label="View Details"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingStakeholder(stakeholder);
                      const phones = stakeholder.contacts
                        .filter(c => c.type === 'phone')
                        .sort((a, b) => a.priority - b.priority)
                        .map(c => c.value);
                      const emails = stakeholder.contacts
                        .filter(c => c.type === 'email')
                        .sort((a, b) => a.priority - b.priority)
                        .map(c => c.value);

                      reset({
                        name: stakeholder.name,
                        position_id: stakeholder.position_id,
                        province_code: stakeholder.province_code,
                        lgu_code: stakeholder.lgu_code || undefined,
                        barangay_code: stakeholder.barangay_code || undefined,
                        phones: [...phones, '', '', ''].slice(0, 3),
                        emails: [...emails, '', '', ''].slice(0, 3)
                      });
                      setShowModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-900 transition-colors"
                    aria-label="Edit"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(stakeholder.id)}
                    className="text-red-600 hover:text-red-900 transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
</div>


      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingStakeholder ? 'Edit Stakeholder' : 'Add New Stakeholder'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Position</label>
                  <select
                    {...register('position_id', { required: 'Position is required' })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select Position</option>
                    {positions.map(position => (
                      <option key={position.id} value={position.id}>
                        {position.name}
                      </option>
                    ))}
                  </select>
                  {errors.position_id && (
                    <p className="mt-1 text-sm text-red-600">{errors.position_id.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    {...register('name', { required: 'Name is required' })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Province</label>
                  <select
                    {...register('province_code', { required: 'Province is required' })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select Province</option>
                    {provinces.map(province => (
                      <option key={province.code} value={province.code}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                  {errors.province_code && (
                    <p className="mt-1 text-sm text-red-600">{errors.province_code.message}</p>
                  )}
                </div>

                {positionLevel && !isPositionLevel(positionLevel, 'province') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">City/Municipality</label>
                    <select
                      {...register('lgu_code', { required: positionLevel && !isPositionLevel(positionLevel, 'province') })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      disabled={!selectedProvince}
                    >
                      <option value="">Select City/Municipality</option>
                      {lgus.map(lgu => (
                        <option key={lgu.code} value={lgu.code}>
                          {lgu.name}
                        </option>
                      ))}
                    </select>
                    {errors.lgu_code && (
                      <p className="mt-1 text-sm text-red-600">{errors.lgu_code.message}</p>
                    )}
                  </div>
                )}

                {positionLevel && isPositionLevel(positionLevel, 'barangay') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Barangay</label>
                    <select
                      {...register('barangay_code', { required: positionLevel && isPositionLevel(positionLevel, 'barangay') })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      disabled={!selectedLgu}
                    >
                      <option value="">Select Barangay</option>
                      {barangays.map(barangay => (
                        <option key={barangay.code} value={barangay.code}>
                          {barangay.name}
                        </option>
                      ))}
                    </select>
                    {errors.barangay_code && (
                      <p className="mt-1 text-sm text-red-600">{errors.barangay_code.message}</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Numbers</label>
                <div className="space-y-2">
                  {[0, 1, 2].map((index) => (
                    <div key={`phone-${index}`} className="flex items-center">
                      <Phone className="h-5 w-5 text-gray-400 mr-2" />
                      <input
                        type="text"
                        {...register(`phones.${index}`)}
                        placeholder={`Contact number ${index + 1}`}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Addresses</label>
                <div className="space-y-2">
                  {[0, 1, 2].map((index) => (
                    <div key={`email-${index}`} className="flex items-center">
                      <Mail className="h-5 w-5 text-gray-400 mr-2" />
                      <input
                        type="email"
                        {...register(`emails.${index}`)}
                        placeholder={`Email address ${index + 1}`}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? 'Saving...' : (editingStakeholder ? 'Update' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">Confirm Delete</h2>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this stakeholder? This action cannot be undone.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
                className="btn-danger"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && (
        <StakeholderViewModal
          stakeholder={{
            name: showViewModal.name,
            position_name: positions.find(p => p.id === showViewModal.position_id)?.name || 'Unknown Position',
            province_name: addressDetails.provinces[showViewModal.province_code] || 'Unknown Province',
            lgu_name: showViewModal.lgu_code ? addressDetails.lgus[showViewModal.lgu_code] : undefined,
            barangay_name: showViewModal.barangay_code ? addressDetails.barangays[showViewModal.barangay_code] : undefined,
            contacts: showViewModal.contacts.map(contact => ({
              type: contact.type,
              value: contact.value
            })),
            updated_at: showViewModal.updated_at,
            updated_by: showViewModal.updated_by
          }}
          onClose={() => setShowViewModal(null)}
        />
      )}

      {/* Duplicate Modal */}
      {showDuplicateModal && duplicateData && (
        <DuplicateStakeholderModal
          newData={{
            name: duplicateData.newData.name,
            position_id: duplicateData.newData.position_id,
            province_code: duplicateData.newData.province_code,
            lgu_code: duplicateData.newData.lgu_code,
            barangay_code: duplicateData.newData.barangay_code,
            contacts: [
              ...duplicateData.newData.phones
                .filter(phone => phone.trim())
                .map(phone => ({ type: 'phone' as const, value: phone })),
              ...duplicateData.newData.emails
                .filter(email => email.trim())
                .map(email => ({ type: 'email' as const, value: email }))
            ]
          }}
          existingData={{
            name: duplicateData.existingData.name,
            position_id: duplicateData.existingData.position_id,
            province_code: duplicateData.existingData.province_code,
            lgu_code: duplicateData.existingData.lgu_code,
            barangay_code: duplicateData.existingData.barangay_code,
            contacts: duplicateData.existingData.contacts.map(contact => ({
              type: contact.type,
              value: contact.value
            }))
          }}
          positionName={duplicateData.addressDetails.positionName}
          provinceName={duplicateData.addressDetails.provinceName}
          lguName={duplicateData.addressDetails.lguName}
          barangayName={duplicateData.addressDetails.barangayName}
          onClose={() => setShowDuplicateModal(false)}
          onUpdate={handleUpdateExisting}
          onCreateNew={handleCreateNew}
        />
      )}
    </div>
  );
}

export default StakeholdersDirectory;
