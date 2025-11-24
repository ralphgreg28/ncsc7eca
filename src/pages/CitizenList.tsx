import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { format } from 'date-fns';
import { Download, Search, Edit, Trash2, AlertTriangle, Eye, ChevronUp, ChevronDown, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import EditModal from '../components/EditModal';
import { useAuth } from '../contexts/AuthContext';
import ViewModal from '../components/ViewModal';
import { logAudit } from '../lib/audit';

interface Filters {
  provinceCode: string;
  lguCode: string;
  barangayCode: string;
  status: string[];
  paymentDateFrom: string;
  paymentDateTo: string;
  birthYears: string[];
  birthQuarters: string[];
  birthMonths: string[]; // Format: YYYY-MM (e.g., 2023-01)
  remarks: string;
  searchTerm: string;
}

interface Assignment {
  id: number;
  staff_id: string;
  province_code: string;
  lgu_code: string | null;
}

interface AddressOption {
  code: string;
  name: string;
}

interface AddressMap {
  [key: string]: string;
}

interface AddressMaps {
  provinces: AddressMap;
  lgus: AddressMap;
  barangays: AddressMap;
}

interface Citizen {
  id: number;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  extension_name: string | null;
  birth_date: string;
  sex: 'Male' | 'Female';
  province_code: string;
  lgu_code: string;
  barangay_code: string;
  status: string;
  payment_date: string | null;
  remarks: string | null;
  osca_id: string;
  rrn: string;
  validator?: string | null;
  validation_date?: string | null;
  encoded_date: string;
  encoded_by: string | null;
  created_at: string;
  calendar_year: string;
  cleanlist_code: string | null;
}

interface AddressDetails {
  province_name: string;
  lgu_name: string;
  barangay_name: string;
}

type SortField = 'last_name' | 'birth_date' | 'sex' | 'status' | 'payment_date' | 'created_at';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE = 10;
const EXPORT_BATCH_SIZE = 1000;

// Memoized helper function to get quarter from birth date
const getBirthQuarter = (birthDate: string): number => {
  const month = new Date(birthDate).getMonth() + 1;
  if (month >= 1 && month <= 3) return 1;
  if (month >= 4 && month <= 6) return 2;
  if (month >= 7 && month <= 9) return 3;
  return 4;
};

// Cached color configurations
const QUARTER_COLORS = {
  1: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  2: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
  3: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  4: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
} as const;

const CYCLE_YEAR_COLORS = [
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
] as const;

const getQuarterColors = (quarter: number) => 
  QUARTER_COLORS[quarter as keyof typeof QUARTER_COLORS] || { bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200' };

const getCycleYearColors = (cycleYear: string) => {
  const colorIndex = parseInt(cycleYear) % 6;
  return CYCLE_YEAR_COLORS[colorIndex] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
};

// Memoized CitizenRow component with optimized rendering
const CitizenRow = memo(({ 
  citizen, 
  addressDetail,
  onView,
  onEdit,
  onDelete,
  userPosition
}: {
  citizen: Citizen;
  addressDetail?: AddressDetails;
  onView: (citizen: Citizen) => void;
  onEdit: (citizen: Citizen) => void;
  onDelete: (id: number) => void;
  userPosition?: string;
}) => {
  const quarter = useMemo(() => getBirthQuarter(citizen.birth_date), [citizen.birth_date]);
  const quarterColors = useMemo(() => getQuarterColors(quarter), [quarter]);
  const cycleColors = useMemo(() => getCycleYearColors(citizen.calendar_year), [citizen.calendar_year]);
  
  const provinceColorClass = useMemo(() => {
    if (!addressDetail) return 'bg-gray-50 border-gray-200';
    switch (addressDetail.province_name) {
      case 'BOHOL': return 'bg-yellow-50 border-yellow-200';
      case 'CEBU': return 'bg-blue-50 border-blue-200';
      case 'NEGROS ORIENTAL': return 'bg-green-50 border-green-200';
      case 'SIQUIJOR': return 'bg-purple-50 border-purple-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  }, [addressDetail?.province_name]);

  return (
    <tr className="hover:bg-gray-50 will-change-auto" style={{ contain: 'paint' }}>
      <td className="px-6 py-4">
        <div className="text-s font-medium text-gray-900 whitespace-nowrap">
          {citizen.last_name},
        </div>
        <div className="text-s font-medium text-gray-900 whitespace-nowrap">
          {citizen.first_name}
        </div>
        <div className="text-s text-gray-500 whitespace-nowrap">
          {citizen.middle_name && `${citizen.middle_name} `}
          {citizen.extension_name && `(${citizen.extension_name})`}
        </div>
      </td>
      <td className="px-6 py-4 text-s whitespace-nowrap font-medium text-center">
        <div className="space-y-1">
          <div className={`px-2 py-1 rounded-md border ${quarterColors.bg} ${quarterColors.text} ${quarterColors.border}`}>
            <div className="font-medium">
              {format(new Date(citizen.birth_date), 'MMMM d, yyyy')}
            </div>
            <div className="text-xs opacity-75">
              Q{quarter} - {quarter === 1 ? 'Jan-Mar' : quarter === 2 ? 'Apr-Jun' : quarter === 3 ? 'Jul-Sep' : 'Oct-Dec'}
            </div>
          </div>
          <div className={`px-2 py-1 rounded-md border ${cycleColors.bg} ${cycleColors.text} ${cycleColors.border}`}>
            <div className="text-xs font-medium">
              CY {citizen.calendar_year}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-m font-medium ${
          citizen.sex === 'Male' ? 'bg-blue-200 text-blue-800' : 'bg-pink-200 text-pink-800'
        }`}>
          {citizen.sex === 'Male' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
          {citizen.sex}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className={`text-sm text-gray-900 whitespace-nowrap p-2 rounded border ${provinceColorClass}`}>
          {addressDetail ? (
            <div className="flex flex-col text-left">
              <div className="font-small">{addressDetail.barangay_name}</div>
              <div className="text-gray-500 text-xs mt-1 flex flex-col text-left">
                <div className="whitespace-nowrap flex items-center font-small">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {addressDetail.lgu_name}
                </div>
                <div className="whitespace-nowrap flex items-left">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                  {addressDetail.province_name}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-1">
              <div className="animate-pulse rounded-full h-4 w-4 border-b-2 border-t-2 border-gray-300 mr-2"></div>
              <span className="text-gray-400">Loading...</span>
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={`inline-flex items-center px-4 py-2 rounded-full text-s font-medium ${
          citizen.status === 'Encoded' ? 'bg-gray-200 text-gray-800' :
          citizen.status === 'Validated' ? 'bg-blue-200 text-blue-800' :
          citizen.status === 'Cleanlisted' ? 'bg-green-200 text-green-800' :
          citizen.status === 'Waitlisted' ? 'bg-yellow-200 text-yellow-800' : 
          citizen.status === 'Paid' ? 'bg-emerald-200 text-emerald-800' :
          citizen.status === 'Unpaid' ? 'bg-yellow-200 text-yellow-800' :
          citizen.status === 'Compliance' ? 'bg-purple-200 text-purple-800' :
          'bg-red-200 text-red-800'
        }`}>
          {citizen.status === 'Validated' && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {citizen.status === 'Cleanlisted' && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {citizen.status === 'Paid' && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {citizen.status === 'Unpaid' && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {citizen.status === 'Disqualified' && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {citizen.status}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="text-[10px] text-gray-500 w-[100px] line-clamp-5 text-center" title={citizen.remarks || '-'}>
          {citizen.remarks || '-'}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="text-[11px] text-gray-500 max-w-xs truncate w-[70px]">
          {citizen.encoded_date ? format(new Date(citizen.encoded_date), 'MMM dd, yyyy') : '-'}
        </div>
        <div className="text-[10px] text-gray-500 max-w-xs truncate">
          {citizen.encoded_date ? format(new Date(citizen.encoded_date), 'hh:mm:ss a') : '-'}
        </div>
      </td>
      <td className="px-4 py-4 text-center whitespace-nowrap">
        <div className="flex justify-end space-x-2">
          <button
            onClick={() => onView(citizen)}
            className="text-gray-600 hover:text-gray-900 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          {(userPosition === 'Administrator' || userPosition === 'PDO') && (
            <button
              onClick={() => onEdit(citizen)}
              className="text-blue-600 hover:text-blue-900 p-1.5 rounded-full hover:bg-blue-50 transition-colors"
              title="Edit Record"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}
          {userPosition === 'Administrator' && (
            <button
              onClick={() => onDelete(citizen.id)}
              className="text-red-600 hover:text-red-900 p-1.5 rounded-full hover:bg-red-50 transition-colors"
              title="Delete Record"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

CitizenRow.displayName = 'CitizenRow';

function CitizenList() {
  const [showFilters, setShowFilters] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [loading, setLoading] = useState(true);
  const [provinces, setProvinces] = useState<AddressOption[]>([]);
  const [lgus, setLgus] = useState<AddressOption[]>([]);
  const [barangays, setBarangays] = useState<AddressOption[]>([]);
  const [editingCitizen, setEditingCitizen] = useState<Citizen | null>(null);
  const [addressDetails, setAddressDetails] = useState<Record<string, AddressDetails>>({});
  const [addressMaps, setAddressMaps] = useState<AddressMaps>({
    provinces: {},
    lgus: {},
    barangays: {}
  });
  const [showYearFilter, setShowYearFilter] = useState(false);
  const [showMonthFilter, setShowMonthFilter] = useState(false);
  const [yearSearchTerm, setYearSearchTerm] = useState('');
  const [monthSearchTerm, setMonthSearchTerm] = useState('');
  const { user } = useAuth();
  const [userAssignments, setUserAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [viewingCitizen, setViewingCitizen] = useState<Citizen | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [availableBirthYears, setAvailableBirthYears] = useState<string[]>([]);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  // Quarters are fixed, so we don't need a state for them
  const [filters, setFilters] = useState<Filters>({
    provinceCode: '',
    lguCode: '',
    barangayCode: '',
    status: [],
    paymentDateFrom: '',
    paymentDateTo: '',
    birthYears: [],
    birthQuarters: [],
    birthMonths: [], // Add the new birthMonths property
    remarks: '',
    searchTerm: ''
  });

  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

  // Debounce search input (300ms delay)
  useEffect(() => {
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(filters.searchTerm);
      setIsSearching(false);
    }, 300);

    return () => {
      clearTimeout(timer);
      setIsSearching(false);
    };
  }, [filters.searchTerm]);

  // Use debounced search term for actual filtering
  useEffect(() => {
    if (debouncedSearchTerm !== filters.searchTerm) return;
    setCurrentPage(0);
    fetchCitizens();
  }, [debouncedSearchTerm, filters.provinceCode, filters.lguCode, filters.barangayCode, filters.status, filters.paymentDateFrom, filters.paymentDateTo, filters.birthYears, filters.birthQuarters, filters.birthMonths, filters.remarks, sortField, sortOrder]);

  const statusOptions = [
    'Encoded',
    'Validated',
    'Cleanlisted',
    'Waitlisted',
    'Paid',
    'Unpaid',
    'Compliance',
    'Disqualified'
  ];

  // Fetch available birth years from the database
  const fetchAvailableBirthYearsAndMonths = async () => {
    try {
      // Use a more efficient query to get distinct years directly from the database
      const { data: yearsData, error: yearsError } = await supabase
        .rpc('get_distinct_birth_years');
      
      if (yearsError) {
        // If the RPC function doesn't exist, fall back to client-side extraction
        console.warn('RPC function not available, falling back to client-side extraction:', yearsError);
        
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('citizens')
          .select('birth_date');
        
        if (fallbackError) throw fallbackError;
        
        if (fallbackData) {
          // Extract years from birth_date and remove duplicates
          const years = [...new Set(fallbackData.map(c => 
            new Date(c.birth_date).getFullYear().toString()
          ))].sort((a, b) => parseInt(b) - parseInt(a)); // Sort descending (newest first)
          
          setAvailableBirthYears(years);
        }
      } else if (yearsData) {
        // Sort years in descending order (newest first)
        const years = yearsData.map((item: { year: number }) => item.year.toString())
          .sort((a: string, b: string) => parseInt(b) - parseInt(a));
        
        setAvailableBirthYears(years);
      }
      
      // Quarters are fixed, so we don't need to set them
      
    } catch (error) {
      console.error('Error fetching birth years:', error);
    }
  };

  useEffect(() => {
    if (user && (user.position === 'PDO' || user.position === 'LGU')) {
      // For PDO and LGU users, first fetch assignments, then load data
      // Don't load any data until assignments are loaded
      setLoading(true); // Keep loading state true until assignments are loaded
      fetchUserAssignments();
    } else {
      // For administrators, load provinces and fetch citizens immediately
      loadProvinces();
      fetchCitizens();
    }
    
    // Fetch available birth years and months regardless of user type
    fetchAvailableBirthYearsAndMonths();
  }, [user]);

  // Only fetch citizens when assignments are loaded for PDO or LGU users
  useEffect(() => {
    if ((user?.position === 'PDO' || user?.position === 'LGU') && !loadingAssignments) {
      fetchCitizens();
    }
  }, [userAssignments, loadingAssignments]);

  // Fetch assignments for PDO and LGU users
  const fetchUserAssignments = async () => {
    if (!user) return;
    
    try {
      setLoadingAssignments(true);
      
      
      
      // For PDO users, continue with the normal assignment fetching
      // Check if the staff_assignments table exists
      const { error: tableCheckError } = await supabase
        .from('staff_assignments')
        .select('id')
        .limit(1);
      
      if (tableCheckError) {
        console.warn('Staff assignments table may not exist yet:', tableCheckError);
        toast.warning('Assignment restrictions could not be loaded. You may have access to all records.');
        loadProvinces(); // Load all provinces if table doesn't exist
        setLoadingAssignments(false);
        return;
      }
      
      // Get assignments for the current user
      const { data, error } = await supabase
        .from('staff_assignments')
        .select('id, staff_id, province_code, lgu_code')
        .eq('staff_id', user.id);
      
      if (error) {
        console.error('Error fetching user assignments:', error);
        toast.error('Failed to load your assigned areas');
        loadProvinces(); // Load all provinces if there's an error
        setLoadingAssignments(false);
        return;
      }
      
      setUserAssignments(data || []);
      
      // Load only the assigned provinces
      if (data && data.length > 0) {
        const provinceCodes = [...new Set(data.map(a => a.province_code))];
        await loadAssignedProvinces(provinceCodes);
      } else {
        toast.info('You have no assigned areas. Please contact an administrator.');
        loadProvinces(); // Load all provinces if no assignments
      }
    } catch (error) {
      console.error('Error in fetchUserAssignments:', error);
      loadProvinces(); // Load all provinces if there's an error
    } finally {
      setLoadingAssignments(false);
    }
  };

  // Load only the provinces assigned to the PDO user
  const loadAssignedProvinces = async (provinceCodes: string[]) => {
    try {
      const { data, error } = await supabase
        .from('provinces')
        .select('code, name')
        .in('code', provinceCodes)
        .order('name');
      
      if (error) throw error;
      setProvinces(data || []);

      const provinceMap = Object.fromEntries((data || []).map(p => [p.code, p.name]));
      setAddressMaps(prev => ({ ...prev, provinces: provinceMap }));
      
      // If there's only one province, select it automatically
      if (data && data.length === 1) {
        setFilters(prev => ({ ...prev, provinceCode: data[0].code }));
      }
    } catch (error) {
      console.error('Error loading assigned provinces:', error);
      toast.error('Failed to load provinces');
    }
  };

  useEffect(() => {
    if (filters.provinceCode) {
      loadLGUs();
    }
  }, [filters.provinceCode]);

  useEffect(() => {
    if (filters.lguCode) {
      loadBarangays();
    }
  }, [filters.lguCode]);

  // Remove the old useEffect that was causing immediate fetching
  // Now using debounced search effect above

  useEffect(() => {
    fetchCitizens();
  }, [currentPage]);

  const loadProvinces = async () => {
    try {
      const { data, error } = await supabase
        .from('provinces')
        .select('code, name')
        .order('name');
      
      if (error) throw error;
      setProvinces(data || []);

      const provinceMap = Object.fromEntries((data || []).map(p => [p.code, p.name]));
      setAddressMaps(prev => ({ ...prev, provinces: provinceMap }));
    } catch (error) {
      console.error('Error loading provinces:', error);
      toast.error('Failed to load provinces');
    }
  };

  const loadLGUs = async () => {
    try {
      const { data, error } = await supabase
        .from('lgus')
        .select('code, name')
        .eq('province_code', filters.provinceCode)
        .order('name');
      
      if (error) throw error;
      setLgus(data || []);

      const lguMap = Object.fromEntries((data || []).map(l => [l.code, l.name]));
      setAddressMaps(prev => ({ ...prev, lgus: lguMap }));
      setFilters(prev => ({ ...prev, lguCode: '', barangayCode: '' }));
    } catch (error) {
      console.error('Error loading LGUs:', error);
      toast.error('Failed to load LGUs');
    }
  };

  const loadBarangays = async () => {
    try {
      const { data, error } = await supabase
        .from('barangays')
        .select('code, name')
        .eq('lgu_code', filters.lguCode)
        .order('name');
      
      if (error) throw error;
      setBarangays(data || []);

      const barangayMap = Object.fromEntries((data || []).map(b => [b.code, b.name]));
      setAddressMaps(prev => ({ ...prev, barangays: barangayMap }));
      setFilters(prev => ({ ...prev, barangayCode: '' }));
    } catch (error) {
      console.error('Error loading barangays:', error);
      toast.error('Failed to load barangays');
    }
  };

  // Lazy loading for address details - fetch only when needed
  const fetchAddressDetails = useCallback(async (citizens: Citizen[]) => {
    try {
      // Check if we already have some of these addresses cached
      const provinceCodes = [...new Set(citizens.map(c => c.province_code))];
      const lguCodes = [...new Set(citizens.map(c => c.lgu_code))];
      const barangayCodes = [...new Set(citizens.map(c => c.barangay_code))];

      // Filter out codes we already have
      const newProvinceCodes = provinceCodes.filter(code => !addressMaps.provinces[code]);
      const newLguCodes = lguCodes.filter(code => !addressMaps.lgus[code]);
      const newBarangayCodes = barangayCodes.filter(code => !addressMaps.barangays[code]);

      // Only fetch what we don't have
      const promises: Promise<{ data: any[] | null; error: any }>[] = [];
      
      if (newProvinceCodes.length > 0) {
        promises.push(
          supabase.from('provinces').select('code, name').in('code', newProvinceCodes).then(result => result)
        );
      } else {
        promises.push(Promise.resolve({ data: [], error: null }));
      }

      if (newLguCodes.length > 0) {
        promises.push(
          supabase.from('lgus').select('code, name').in('code', newLguCodes).then(result => result)
        );
      } else {
        promises.push(Promise.resolve({ data: [], error: null }));
      }

      if (newBarangayCodes.length > 0) {
        promises.push(
          supabase.from('barangays').select('code, name').in('code', newBarangayCodes).then(result => result)
        );
      } else {
        promises.push(Promise.resolve({ data: [], error: null }));
      }

      const [{ data: provinces }, { data: lgus }, { data: barangays }] = await Promise.all(promises);

      // Merge new data with existing cache
      const provinceMap = { ...addressMaps.provinces, ...Object.fromEntries((provinces || []).map((p: any) => [p.code, p.name])) };
      const lguMap = { ...addressMaps.lgus, ...Object.fromEntries((lgus || []).map((l: any) => [l.code, l.name])) };
      const barangayMap = { ...addressMaps.barangays, ...Object.fromEntries((barangays || []).map((b: any) => [b.code, b.name])) };

      setAddressMaps({
        provinces: provinceMap,
        lgus: lguMap,
        barangays: barangayMap
      });

      const details: Record<string, AddressDetails> = { ...addressDetails };
      citizens.forEach(citizen => {
        if (!details[citizen.id]) {
          details[citizen.id] = {
            province_name: provinceMap[citizen.province_code] || 'Unknown',
            lgu_name: lguMap[citizen.lgu_code] || 'Unknown',
            barangay_name: barangayMap[citizen.barangay_code] || 'Unknown'
          };
        }
      });

      setAddressDetails(details);
      return { provinces, lgus, barangays };
    } catch (error) {
      console.error('Error fetching address details:', error);
      return { provinces: [], lgus: [], barangays: [] };
    }
  }, [addressMaps, addressDetails]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  const fetchCitizens = async () => {
    try {
      setLoading(true);
      
      // For PDO or LGU users, don't fetch any data until assignments are loaded
      if ((user?.position === 'PDO' || user?.position === 'LGU') && loadingAssignments) {
        // Return early without fetching any data
        return;
      }
      
      // For PDO or LGU users with no assignments, show no data
      if ((user?.position === 'PDO' || user?.position === 'LGU') && userAssignments.length === 0) {
        setCitizens([]);
        setTotalRecords(0);
        setLoading(false);
        return;
      }
      
      let query = supabase.from('citizens').select('*', { count: 'exact' });

      // Use debounced search term instead of direct filters.searchTerm
      if (debouncedSearchTerm) {
        // Split search term by spaces to allow searching for multiple terms
        const searchTerms = debouncedSearchTerm.trim().split(/[\s,-]+/);
        
        // For each term, create a filter condition
        searchTerms.forEach(term => {
          // Create a filter where the term must match at least one name field
          // Using a raw filter string which is compatible with Supabase
          query = query.or(`last_name.ilike.%${term}%,first_name.ilike.%${term}%,middle_name.ilike.%${term}%`);
        });
      }

      // For PDO or LGU users, restrict to assigned provinces and LGUs
      if (user && (user.position === 'PDO' || user.position === 'LGU') && userAssignments.length > 0) {
        // Get unique province codes from assignments
        const assignedProvinceCodes = [...new Set(userAssignments.map(a => a.province_code))];
        
        // If a province is selected in the filter, check if it's in the assigned provinces
        if (filters.provinceCode) {
          if (!assignedProvinceCodes.includes(filters.provinceCode)) {
            // If the selected province is not in the assigned provinces, return no results
            setCitizens([]);
            setTotalRecords(0);
            setLoading(false);
            return;
          }
          
          query = query.eq('province_code', filters.provinceCode);
          
          // If an LGU is selected, check if there's an assignment for this province+LGU
          if (filters.lguCode) {
            const hasLguAssignment = userAssignments.some(
              a => a.province_code === filters.provinceCode && 
                  (a.lgu_code === filters.lguCode || a.lgu_code === null)
            );
            
            if (!hasLguAssignment) {
              // If no assignment for this LGU, return no results
              setCitizens([]);
              setTotalRecords(0);
              setLoading(false);
              return;
            }
            
            query = query.eq('lgu_code', filters.lguCode);
          } else {
            // If no LGU is selected, restrict to assigned LGUs for this province
            const assignedLgusForProvince = userAssignments
              .filter(a => a.province_code === filters.provinceCode)
              .map(a => a.lgu_code);
            
            // If there are specific LGU assignments (not null), restrict to those
            const specificLguAssignments = assignedLgusForProvince.filter(lgu => lgu !== null) as string[];
            
            if (specificLguAssignments.length > 0 && 
                !assignedLgusForProvince.includes(null)) {
              query = query.in('lgu_code', specificLguAssignments);
            }
          }
        } else {
          // If no province is selected, restrict to all assigned provinces
          query = query.in('province_code', assignedProvinceCodes);
          
          // Get all assignments with specific LGUs (not null)
          const lguAssignments = userAssignments
            .filter(a => a.lgu_code !== null)
            .map(a => ({ province: a.province_code, lgu: a.lgu_code as string }));
          
          // Get provinces with "all LGUs" assignment (lgu_code is null)
          const provincesWithAllLgus = userAssignments
            .filter(a => a.lgu_code === null)
            .map(a => a.province_code);
          
          // If there are specific LGU assignments and not all provinces have "all LGUs" assignment
          if (lguAssignments.length > 0 && 
              !assignedProvinceCodes.every(p => provincesWithAllLgus.includes(p))) {
            
            // Build OR filter for each province+LGU combination
            const orConditions = lguAssignments.map(a => 
              `and(province_code.eq.${a.province},lgu_code.eq.${a.lgu})`
            );
            
            // Add conditions for provinces with "all LGUs" assignment
            provincesWithAllLgus.forEach(province => {
              orConditions.push(`province_code.eq.${province}`);
            });
            
            // Apply the OR filter
            query = query.or(orConditions.join(','));
          }
        }
      } else {
        // For administrators or if no assignments, apply normal filters
        if (filters.provinceCode) {
          query = query.eq('province_code', filters.provinceCode);
        }

        if (filters.lguCode) {
          query = query.eq('lgu_code', filters.lguCode);
        }

        if (filters.barangayCode) {
          query = query.eq('barangay_code', filters.barangayCode);
        }
      }

      if (filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters.paymentDateFrom) {
        query = query.gte('payment_date', filters.paymentDateFrom);
      }

      if (filters.paymentDateTo) {
        query = query.lte('payment_date', filters.paymentDateTo);
      }

      // Apply birth year filter
      if (filters.birthYears.length > 0) {
        // Create a temporary array to hold all the filtered citizens
        let yearFilteredCitizens: any[] = [];
        
        // For each selected year, add a filter
        for (const year of filters.birthYears) {
          const startDate = `${year}-01-01`;
          const endDate = `${parseInt(year) + 1}-01-01`;
          
          // Clone the query for this specific year filter
          let yearQuery = supabase
            .from('citizens')
            .select('id')
            .gte('birth_date', startDate)
            .lt('birth_date', endDate);
          
          // Apply all the previous filters to this query
          if (filters.provinceCode) yearQuery.eq('province_code', filters.provinceCode);
          if (filters.lguCode) yearQuery.eq('lgu_code', filters.lguCode);
          if (filters.barangayCode) yearQuery.eq('barangay_code', filters.barangayCode);
          if (filters.status.length > 0) yearQuery.in('status', filters.status);
          if (filters.paymentDateFrom) yearQuery.gte('payment_date', filters.paymentDateFrom);
          if (filters.paymentDateTo) yearQuery.lte('payment_date', filters.paymentDateTo);
          if (filters.remarks) yearQuery.ilike('remarks', `%${filters.remarks}%`);
          if (debouncedSearchTerm) {
            // Split search term by spaces to allow searching for multiple terms
            const searchTerms = debouncedSearchTerm.trim().split(/\s+/);
            
            if (searchTerms.length === 1) {
              // If only one search term, use the original search logic
              yearQuery.or(
                `last_name.ilike.%${debouncedSearchTerm}%,first_name.ilike.%${debouncedSearchTerm}%,middle_name.ilike.%${debouncedSearchTerm}%`
              );
            } else {
                // For multiple search terms, build a more complex query
                // Each term must match at least one name field
                searchTerms.forEach(term => {
                  yearQuery = yearQuery.or(`last_name.ilike.%${term}%,first_name.ilike.%${term}%,middle_name.ilike.%${term}%`);
                });
            }
          }
          
          // Execute the query for this year
          const { data: yearData, error: yearError } = await yearQuery;
          
          if (yearError) {
            console.error('Error filtering by birth year:', yearError);
          } else if (yearData && yearData.length > 0) {
            // Add the IDs from this year to our filtered list
            yearFilteredCitizens = [...yearFilteredCitizens, ...yearData.map(c => c.id)];
          }
        }
        
        // If we have any results from the year filter, apply them to the main query
          if (yearFilteredCitizens.length > 0) {
            // Check if we hit the limit
            if (yearFilteredCitizens.length >= 10000) {
              toast.warning('Birth Year filter is limited to 10000 records. Some records may not be shown.');
            }
            query = query.in('id', yearFilteredCitizens);
          } else if (filters.birthYears.length > 0) {
            // If no results match the year filter but years were selected, return no results
            setCitizens([]);
            setTotalRecords(0);
            setLoading(false);
            return;
          }
      }
      
      // Apply specific month filter (YYYY-MM format)
      if (filters.birthMonths.length > 0) {
        // Create a temporary array to hold all the filtered citizens
        let monthFilteredCitizens: any[] = [];
        
        // For each selected month in YYYY-MM format, add a filter
        for (const monthYearStr of filters.birthMonths) {
          const [year, month] = monthYearStr.split('-');
          
          // Calculate start and end dates for the specific month
          const startDate = `${year}-${month}-01`;
          
          // Calculate the end date (first day of next month)
          let nextMonth = parseInt(month) + 1;
          let nextMonthYear = parseInt(year);
          if (nextMonth > 12) {
            nextMonth = 1;
            nextMonthYear += 1;
          }
          const endDate = `${nextMonthYear}-${nextMonth.toString().padStart(2, '0')}-01`;
          
          // Clone the query for this specific month filter
          let monthQuery = supabase
            .from('citizens')
            .select('id')
            .gte('birth_date', startDate)
            .lt('birth_date', endDate);
          
          // Apply all the previous filters to this query
          if (filters.provinceCode) monthQuery.eq('province_code', filters.provinceCode);
          if (filters.lguCode) monthQuery.eq('lgu_code', filters.lguCode);
          if (filters.barangayCode) monthQuery.eq('barangay_code', filters.barangayCode);
          if (filters.status.length > 0) monthQuery.in('status', filters.status);
          if (filters.paymentDateFrom) monthQuery.gte('payment_date', filters.paymentDateFrom);
          if (filters.paymentDateTo) monthQuery.lte('payment_date', filters.paymentDateTo);
          if (filters.remarks) monthQuery.ilike('remarks', `%${filters.remarks}%`);
          if (debouncedSearchTerm) {
            // Split search term by spaces to allow searching for multiple terms
            const searchTerms = debouncedSearchTerm.trim().split(/\s+/);
            
            if (searchTerms.length === 1) {
              // If only one search term, use the original search logic
              monthQuery.or(
                `last_name.ilike.%${debouncedSearchTerm}%,first_name.ilike.%${debouncedSearchTerm}%,middle_name.ilike.%${debouncedSearchTerm}%`
              );
            } else {
              // For multiple search terms, build a more complex query
              // Each term must match at least one of the name fields
              searchTerms.forEach(term => {
                monthQuery = monthQuery.or(`last_name.ilike.%${term}%,first_name.ilike.%${term}%,middle_name.ilike.%${term}%`);
              });
            }
          }
          
          // Execute the query for this specific month
          const { data: monthData, error: monthError } = await monthQuery;
          
          if (monthError) {
            console.error('Error filtering by specific month:', monthError);
          } else if (monthData && monthData.length > 0) {
            // Add the IDs from this month to our filtered list
            monthFilteredCitizens = [...monthFilteredCitizens, ...monthData.map(c => c.id)];
          }
        }
        
        // If we have any results from the month filter, apply them to the main query
        if (monthFilteredCitizens.length > 0) {
          // For large result sets, we need to handle them in batches
          if (monthFilteredCitizens.length > 1000) {
            toast.warning(`Found ${monthFilteredCitizens.length} records matching birth month filter. Processing in batches.`);
            
            // Process in batches of 1000
            const batches = [];
            for (let i = 0; i < monthFilteredCitizens.length; i += 1000) {
              batches.push(monthFilteredCitizens.slice(i, i + 1000));
            }
            
            // Create a union query for each batch
            let batchResults: any[] = [];
            for (const batch of batches) {
              const batchQuery = supabase
                .from('citizens')
                .select('*')
                .in('id', batch);
              
              // Apply other filters that might have been applied to the main query
              if (filters.provinceCode) batchQuery.eq('province_code', filters.provinceCode);
              if (filters.lguCode) batchQuery.eq('lgu_code', filters.lguCode);
              if (filters.barangayCode) batchQuery.eq('barangay_code', filters.barangayCode);
              if (filters.status.length > 0) batchQuery.in('status', filters.status);
              if (filters.paymentDateFrom) batchQuery.gte('payment_date', filters.paymentDateFrom);
              if (filters.paymentDateTo) batchQuery.lte('payment_date', filters.paymentDateTo);
              if (filters.remarks) batchQuery.ilike('remarks', `%${filters.remarks}%`);
              
              const { data, error } = await batchQuery;
              if (error) {
                console.error('Error processing batch:', error);
              } else if (data) {
                batchResults = [...batchResults, ...data];
              }
            }
            
            // Sort the results according to the current sort field and order
            batchResults.sort((a, b) => {
              if (sortOrder === 'asc') {
                return a[sortField] > b[sortField] ? 1 : -1;
              } else {
                return a[sortField] < b[sortField] ? 1 : -1;
              }
            });
            
            // Apply pagination to the sorted results
            const paginatedResults = batchResults.slice(
              currentPage * PAGE_SIZE, 
              (currentPage + 1) * PAGE_SIZE
            );
            
            setCitizens(paginatedResults);
            setTotalRecords(batchResults.length);
            await fetchAddressDetails(paginatedResults);
            setLoading(false);
            return;
          } else {
            // For smaller result sets, use the standard approach
            query = query.in('id', monthFilteredCitizens);
          }
        } else if (filters.birthMonths.length > 0) {
          // If no results match the month filter but months were selected, return no results
          setCitizens([]);
          setTotalRecords(0);
          setLoading(false);
          return;
        }
      }
      
      // Apply birth quarter filter
      if (filters.birthQuarters.length > 0) {
        // Get all months from selected quarters
        let allMonths: number[] = [];
        
        filters.birthQuarters.forEach(quarter => {
          switch(quarter) {
            case 'Q1': // 1st Quarter (Jan-Mar)
              allMonths = [...allMonths, 1, 2, 3];
              break;
            case 'Q2': // 2nd Quarter (Apr-Jun)
              allMonths = [...allMonths, 4, 5, 6];
              break;
            case 'Q3': // 3rd Quarter (Jul-Sep)
              allMonths = [...allMonths, 7, 8, 9];
              break;
            case 'Q4': // 4th Quarter (Oct-Dec)
              allMonths = [...allMonths, 10, 11, 12];
              break;
          }
        });
        
        // Remove duplicates
        allMonths = [...new Set(allMonths)];
        
        if (allMonths.length > 0) {
          // Create a temporary array to hold all the filtered citizens
          let monthFilteredCitizens: any[] = [];
          
          try {
            // Try to use the RPC function if it exists
            const { data: monthData, error: monthError } = await supabase
              .rpc('filter_citizens_by_birth_month', {
                months: allMonths
              });
            
            if (monthError) {
              throw monthError;
            }
            
            if (monthData && monthData.length > 0) {
              // Use the IDs returned from the RPC function
              monthFilteredCitizens = monthData.map((c: any) => c.id);
            }
          } catch (error) {
            // If the RPC function doesn't exist or fails, fall back to client-side filtering
            console.warn('RPC function not available, falling back to client-side filtering:', error);
            
            // Clone the query for month filtering
            let monthQuery = supabase
              .from('citizens')
              .select('id, birth_date');
            
            // Apply all the previous filters to this query
            if (filters.provinceCode) monthQuery.eq('province_code', filters.provinceCode);
            if (filters.lguCode) monthQuery.eq('lgu_code', filters.lguCode);
            if (filters.barangayCode) monthQuery.eq('barangay_code', filters.barangayCode);
            if (filters.status.length > 0) monthQuery.in('status', filters.status);
            if (filters.paymentDateFrom) monthQuery.gte('payment_date', filters.paymentDateFrom);
            if (filters.paymentDateTo) monthQuery.lte('payment_date', filters.paymentDateTo);
            if (filters.remarks) monthQuery.ilike('remarks', `%${filters.remarks}%`);
            if (debouncedSearchTerm) {
              // Split search term by spaces to allow searching for multiple terms
              const searchTerms = debouncedSearchTerm.trim().split(/\s+/);
              
              if (searchTerms.length === 1) {
                // If only one search term, use the original search logic
                monthQuery.or(
                  `last_name.ilike.%${debouncedSearchTerm}%,first_name.ilike.%${debouncedSearchTerm}%,middle_name.ilike.%${debouncedSearchTerm}%`
                );
              } else {
                // For multiple search terms, build a more complex query
                // Each term must match at least one of the name fields
                searchTerms.forEach(term => {
                  monthQuery = monthQuery.or(`last_name.ilike.%${term}%,first_name.ilike.%${term}%,middle_name.ilike.%${term}%`);
                });
              }
            }
            
            // Execute the query
            const { data: fallbackData, error: fallbackError } = await monthQuery;
            
            if (fallbackError) {
              console.error('Error filtering by birth month:', fallbackError);
            } else if (fallbackData && fallbackData.length > 0) {
              // Filter citizens by month client-side
              monthFilteredCitizens = fallbackData
                .filter(c => {
                  const birthMonth = new Date(c.birth_date).getMonth() + 1; // +1 because getMonth() is 0-indexed
                  return allMonths.includes(birthMonth);
                })
                .map(c => c.id);
            }
          }
          
          if (monthFilteredCitizens.length > 0) {
            // Check if we hit the limit
            if (monthFilteredCitizens.length >= 1000) {
              toast.warning('Birth Quarter filter is limited to 1000 records. Some records may not be shown.');
            }
            query = query.in('id', monthFilteredCitizens);
          } else {
            // No citizens match the month filter
            setCitizens([]);
            setTotalRecords(0);
            setLoading(false);
            return;
          }
        }
      }

      if (filters.remarks) {
        query = query.ilike('remarks', `%${filters.remarks}%`);
      }

      query = query.order(sortField, { ascending: sortOrder === 'asc' });
      query = query.range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      const { data, error, count } = await query;

      if (error) throw error;
      
      if (count !== null) {
        setTotalRecords(count);
      }

      const sortedData = data || [];
      setCitizens(sortedData);
      await fetchAddressDetails(sortedData);
    } catch (error) {
      console.error('Error fetching citizens:', error);
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  // Type for Supabase query
  type SupabaseQuery = any; // Using any to avoid complex typing issues
  
  const fetchAllRecordsInBatches = async (baseQuery: SupabaseQuery): Promise<Citizen[]> => {
    let allRecords: Citizen[] = [];
    let hasMore = true;
    let start = 0;
    
    while (hasMore) {
      const { data, error } = await baseQuery
        .range(start, start + EXPORT_BATCH_SIZE - 1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        allRecords = [...allRecords, ...data as Citizen[]];
        start += EXPORT_BATCH_SIZE;
        
        toast.info(`Fetched ${allRecords.length} records...`, { 
          autoClose: 1000,
          toastId: 'export-progress'
        });
      }
      
      hasMore = data && data.length === EXPORT_BATCH_SIZE;
    }
    
    return allRecords;
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      toast.info('Starting export...');
      
      // For PDO or LGU users, don't export any data until assignments are loaded
      if ((user?.position === 'PDO' || user?.position === 'LGU') && loadingAssignments) {
        toast.warning('Please wait until your assignments are loaded before exporting data.');
        setExportLoading(false);
        return;
      }
      
      // For PDO or LGU users with no assignments, show no data
      if ((user?.position === 'PDO' || user?.position === 'LGU') && userAssignments.length === 0) {
        toast.info('No data to export - You have no assigned areas.');
        setExportLoading(false);
        return;
      }
      
      let query = supabase.from('citizens').select('*');

          if (filters.searchTerm) {
            // Split search term by spaces to allow searching for multiple terms
            const searchTerms = filters.searchTerm.trim().split(/\s+/);
            
            if (searchTerms.length === 1) {
              // If only one search term, use the original search logic
              query = query.or(`last_name.ilike.%${filters.searchTerm}%,first_name.ilike.%${filters.searchTerm}%,middle_name.ilike.%${filters.searchTerm}%`);
            } else {
              // For multiple search terms, build a more complex query
              // Each term must match at least one of the name fields
              searchTerms.forEach(term => {
                // For each term, add a filter that checks if any name field contains the term
                query = query.or(`last_name.ilike.%${term}%,first_name.ilike.%${term}%,middle_name.ilike.%${term}%`);
              });
            }
          }

      // For PDO or LGU users, restrict to assigned provinces and LGUs
      if (user && (user.position === 'PDO' || user.position === 'LGU') && userAssignments.length > 0) {
        // Get unique province codes from assignments
        const assignedProvinceCodes = [...new Set(userAssignments.map(a => a.province_code))];
        
        // If a province is selected in the filter, check if it's in the assigned provinces
        if (filters.provinceCode) {
          if (!assignedProvinceCodes.includes(filters.provinceCode)) {
            // If the selected province is not in the assigned provinces, return no results
            toast.info('No data to export - Province not in your assignments');
            setExportLoading(false);
            return;
          }
          
          query = query.eq('province_code', filters.provinceCode);
          
          // If an LGU is selected, check if there's an assignment for this province+LGU
          if (filters.lguCode) {
            const hasLguAssignment = userAssignments.some(
              a => a.province_code === filters.provinceCode && 
                  (a.lgu_code === filters.lguCode || a.lgu_code === null)
            );
            
            if (!hasLguAssignment) {
              // If no assignment for this LGU, return no results
              toast.info('No data to export - LGU not in your assignments');
              setExportLoading(false);
              return;
            }
            
            query = query.eq('lgu_code', filters.lguCode);
          } else {
            // If no LGU is selected, restrict to assigned LGUs for this province
            const assignedLgusForProvince = userAssignments
              .filter(a => a.province_code === filters.provinceCode)
              .map(a => a.lgu_code);
            
            // If there are specific LGU assignments (not null), restrict to those
            const specificLguAssignments = assignedLgusForProvince.filter(lgu => lgu !== null) as string[];
            
            if (specificLguAssignments.length > 0 && 
                !assignedLgusForProvince.includes(null)) {
              query = query.in('lgu_code', specificLguAssignments);
            }
          }
        } else {
          // If no province is selected, restrict to all assigned provinces
          query = query.in('province_code', assignedProvinceCodes);
          
          // Get all assignments with specific LGUs (not null)
          const lguAssignments = userAssignments
            .filter(a => a.lgu_code !== null)
            .map(a => ({ province: a.province_code, lgu: a.lgu_code as string }));
          
          // Get provinces with "all LGUs" assignment (lgu_code is null)
          const provincesWithAllLgus = userAssignments
            .filter(a => a.lgu_code === null)
            .map(a => a.province_code);
          
          // If there are specific LGU assignments and not all provinces have "all LGUs" assignment
          if (lguAssignments.length > 0 && 
              !assignedProvinceCodes.every(p => provincesWithAllLgus.includes(p))) {
            
            // Build OR filter for each province+LGU combination
            const orConditions = lguAssignments.map(a => 
              `and(province_code.eq.${a.province},lgu_code.eq.${a.lgu})`
            );
            
            // Add conditions for provinces with "all LGUs" assignment
            provincesWithAllLgus.forEach(province => {
              orConditions.push(`province_code.eq.${province}`);
            });
            
            // Apply the OR filter
            query = query.or(orConditions.join(','));
          }
        }
      } else {
        // For administrators or if no assignments, apply normal filters
        if (filters.provinceCode) {
          query = query.eq('province_code', filters.provinceCode);
        }

        if (filters.lguCode) {
          query = query.eq('lgu_code', filters.lguCode);
        }

        if (filters.barangayCode) {
          query = query.eq('barangay_code', filters.barangayCode);
        }
      }

      if (filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters.paymentDateFrom) {
        query = query.gte('payment_date', filters.paymentDateFrom);
      }

      if (filters.paymentDateTo) {
        query = query.lte('payment_date', filters.paymentDateTo);
      }

      // Apply birth year filter
      if (filters.birthYears.length > 0) {
        // Create a temporary array to hold all the filtered citizens
        let yearFilteredCitizens: any[] = [];
        
        // For each selected year, add a filter
        for (const year of filters.birthYears) {
          const startDate = `${year}-01-01`;
          const endDate = `${parseInt(year) + 1}-01-01`;
          
          // Clone the query for this specific year filter
          const yearQuery = supabase
            .from('citizens')
            .select('id')
            .gte('birth_date', startDate)
            .lt('birth_date', endDate);
          
          // Apply all the previous filters to this query
          if (filters.provinceCode) yearQuery.eq('province_code', filters.provinceCode);
          if (filters.lguCode) yearQuery.eq('lgu_code', filters.lguCode);
          if (filters.barangayCode) yearQuery.eq('barangay_code', filters.barangayCode);
          if (filters.status.length > 0) yearQuery.in('status', filters.status);
          if (filters.paymentDateFrom) yearQuery.gte('payment_date', filters.paymentDateFrom);
          if (filters.paymentDateTo) yearQuery.lte('payment_date', filters.paymentDateTo);
          if (filters.remarks) yearQuery.ilike('remarks', `%${filters.remarks}%`);
          if (filters.searchTerm) {
            yearQuery.or(
              `last_name.ilike.%${filters.searchTerm}%,` +
              `first_name.ilike.%${filters.searchTerm}%,` +
              `middle_name.ilike.%${filters.searchTerm}%`
            );
          }
          
          // Execute the query for this year
          const { data: yearData, error: yearError } = await yearQuery;
          
          if (yearError) {
            console.error('Error filtering by birth year:', yearError);
          } else if (yearData && yearData.length > 0) {
            // Add the IDs from this year to our filtered list
            yearFilteredCitizens = [...yearFilteredCitizens, ...yearData.map(c => c.id)];
          }
        }
        
        // If we have any results from the year filter, apply them to the main query
          if (yearFilteredCitizens.length > 0) {
            // Check if we hit the limit
            if (yearFilteredCitizens.length >= 1000) {
              toast.warning('Birth Year filter is limited to 1000 records for export. Some records may not be included.');
            }
            query = query.in('id', yearFilteredCitizens);
          } else if (filters.birthYears.length > 0) {
            // If no results match the year filter but years were selected, return no results
            toast.info('No data to export - No citizens match the birth year filter');
            setExportLoading(false);
            return;
          }
      }
      
      // Apply birth quarter filter
      if (filters.birthQuarters.length > 0) {
        // Get all months from selected quarters
        let allMonths: number[] = [];
        
        filters.birthQuarters.forEach(quarter => {
          switch(quarter) {
            case 'Q1': // 1st Quarter (Jan-Mar)
              allMonths = [...allMonths, 1, 2, 3];
              break;
            case 'Q2': // 2nd Quarter (Apr-Jun)
              allMonths = [...allMonths, 4, 5, 6];
              break;
            case 'Q3': // 3rd Quarter (Jul-Sep)
              allMonths = [...allMonths, 7, 8, 9];
              break;
            case 'Q4': // 4th Quarter (Oct-Dec)
              allMonths = [...allMonths, 10, 11, 12];
              break;
          }
        });
        
        // Remove duplicates
        allMonths = [...new Set(allMonths)];
        
        if (allMonths.length > 0) {
          // Create a temporary array to hold all the filtered citizens
          let monthFilteredCitizens: any[] = [];
          
          try {
            // Try to use the RPC function if it exists
            const { data: monthData, error: monthError } = await supabase
              .rpc('filter_citizens_by_birth_month', {
                months: allMonths
              });
            
            if (monthError) {
              throw monthError;
            }
            
            if (monthData && monthData.length > 0) {
              // Use the IDs returned from the RPC function
              monthFilteredCitizens = monthData.map((c: any) => c.id);
            }
          } catch (error) {
            // If the RPC function doesn't exist or fails, fall back to client-side filtering
            console.warn('RPC function not available for export, falling back to client-side filtering:', error);
            
            // Clone the query for month filtering
            const monthQuery = supabase
              .from('citizens')
              .select('id, birth_date');
            
            // Apply all the previous filters to this query
            if (filters.provinceCode) monthQuery.eq('province_code', filters.provinceCode);
            if (filters.lguCode) monthQuery.eq('lgu_code', filters.lguCode);
            if (filters.barangayCode) monthQuery.eq('barangay_code', filters.barangayCode);
            if (filters.status.length > 0) monthQuery.in('status', filters.status);
            if (filters.paymentDateFrom) monthQuery.gte('payment_date', filters.paymentDateFrom);
            if (filters.paymentDateTo) monthQuery.lte('payment_date', filters.paymentDateTo);
            if (filters.remarks) monthQuery.ilike('remarks', `%${filters.remarks}%`);
            if (filters.searchTerm) {
              monthQuery.or(
                `last_name.ilike.%${filters.searchTerm}%,` +
                `first_name.ilike.%${filters.searchTerm}%,` +
                `middle_name.ilike.%${filters.searchTerm}%`
              );
            }
            
            // Execute the query
            const { data: fallbackData, error: fallbackError } = await monthQuery;
            
            if (fallbackError) {
              console.error('Error filtering by birth month for export:', fallbackError);
              toast.error('Failed to filter by birth month');
              setExportLoading(false);
              return;
            } else if (fallbackData && fallbackData.length > 0) {
              // Filter citizens by month client-side
              monthFilteredCitizens = fallbackData
                .filter(c => {
                  const birthMonth = new Date(c.birth_date).getMonth() + 1; // +1 because getMonth() is 0-indexed
                  return allMonths.includes(birthMonth);
                })
                .map(c => c.id);
            }
          }
          
          if (monthFilteredCitizens.length > 0) {
            // Check if we hit the limit
            if (monthFilteredCitizens.length >= 1000) {
              toast.warning('Birth Quarter filter is limited to 1000 records for export. Some records may not be included.');
            }
            query = query.in('id', monthFilteredCitizens);
          } else {
            // No citizens match the month filter
            toast.info('No data to export - No citizens match the birth quarter filter');
            setExportLoading(false);
            return;
          }
        }
      }

      // Apply specific month filter (YYYY-MM format)
      if (filters.birthMonths.length > 0) {
        // Create a temporary array to hold all the filtered citizens
        let monthFilteredCitizens: any[] = [];
        
        // For each selected month in YYYY-MM format, add a filter
        for (const monthYearStr of filters.birthMonths) {
          const [year, month] = monthYearStr.split('-');
          
          // Calculate start and end dates for the specific month
          const startDate = `${year}-${month}-01`;
          
          // Calculate the end date (first day of next month)
          let nextMonth = parseInt(month) + 1;
          let nextMonthYear = parseInt(year);
          if (nextMonth > 12) {
            nextMonth = 1;
            nextMonthYear += 1;
          }
          const endDate = `${nextMonthYear}-${nextMonth.toString().padStart(2, '0')}-01`;
          
          // Clone the query for this specific month filter
          const monthQuery = supabase
            .from('citizens')
            .select('id')
            .gte('birth_date', startDate)
            .lt('birth_date', endDate);
          
          // Apply all the previous filters to this query
          if (filters.provinceCode) monthQuery.eq('province_code', filters.provinceCode);
          if (filters.lguCode) monthQuery.eq('lgu_code', filters.lguCode);
          if (filters.barangayCode) monthQuery.eq('barangay_code', filters.barangayCode);
          if (filters.status.length > 0) monthQuery.in('status', filters.status);
          if (filters.paymentDateFrom) monthQuery.gte('payment_date', filters.paymentDateFrom);
          if (filters.paymentDateTo) monthQuery.lte('payment_date', filters.paymentDateTo);
          if (filters.remarks) monthQuery.ilike('remarks', `%${filters.remarks}%`);
          if (filters.searchTerm) {
            monthQuery.or(
              `last_name.ilike.%${filters.searchTerm}%,` +
              `first_name.ilike.%${filters.searchTerm}%,` +
              `middle_name.ilike.%${filters.searchTerm}%`
            );
          }
          
          // Execute the query for this specific month
          const { data: monthData, error: monthError } = await monthQuery;
          
          if (monthError) {
            console.error('Error filtering by specific month for export:', monthError);
          } else if (monthData && monthData.length > 0) {
            // Add the IDs from this month to our filtered list
            monthFilteredCitizens = [...monthFilteredCitizens, ...monthData.map(c => c.id)];
          }
        }
        
        // If we have any results from the month filter, apply them to the main query
        if (monthFilteredCitizens.length > 0) {
          // For large result sets, we need to handle them in batches
          if (monthFilteredCitizens.length > 1000) {
            toast.warning(`Found ${monthFilteredCitizens.length} records matching birth month filter. Processing in batches for export.`);
            
            // Process in batches of 1000
            const batches = [];
            for (let i = 0; i < monthFilteredCitizens.length; i += 1000) {
              batches.push(monthFilteredCitizens.slice(i, i + 1000));
            }
            
            // Create a union query for each batch
            let batchResults: any[] = [];
            let batchCount = 0;
            
            for (const batch of batches) {
              batchCount++;
              toast.info(`Processing batch ${batchCount} of ${batches.length}...`, {
                autoClose: 1000,
                toastId: `batch-progress-${batchCount}`
              });
              
              const batchQuery = supabase
                .from('citizens')
                .select('*')
                .in('id', batch);
              
              // Apply other filters that might have been applied to the main query
              if (filters.provinceCode) batchQuery.eq('province_code', filters.provinceCode);
              if (filters.lguCode) batchQuery.eq('lgu_code', filters.lguCode);
              if (filters.barangayCode) batchQuery.eq('barangay_code', filters.barangayCode);
              if (filters.status.length > 0) batchQuery.in('status', filters.status);
              if (filters.paymentDateFrom) batchQuery.gte('payment_date', filters.paymentDateFrom);
              if (filters.paymentDateTo) batchQuery.lte('payment_date', filters.paymentDateTo);
              if (filters.remarks) batchQuery.ilike('remarks', `%${filters.remarks}%`);
              
              const { data, error } = await batchQuery;
              if (error) {
                console.error('Error processing batch:', error);
              } else if (data) {
                batchResults = [...batchResults, ...data];
              }
            }
            
            // Sort the results according to the current sort field and order
            batchResults.sort((a, b) => {
              if (sortOrder === 'asc') {
                return a[sortField] > b[sortField] ? 1 : -1;
              } else {
                return a[sortField] < b[sortField] ? 1 : -1;
              }
            });
            
            // Return the batch results for export
            return batchResults;
          } else {
            // For smaller result sets, use the standard approach
            query = query.in('id', monthFilteredCitizens);
          }
        } else if (filters.birthMonths.length > 0) {
          // If no results match the month filter but months were selected, return no results
          toast.info('No data to export - No citizens match the birth month filter');
          setExportLoading(false);
          return;
        }
      }

      if (filters.remarks) {
        query = query.ilike('remarks', `%${filters.remarks}%`);
      }

      query = query.order(sortField, { ascending: sortOrder === 'asc' });

      const citizens = await fetchAllRecordsInBatches(query);

      if (!citizens || citizens.length === 0) {
        toast.info('No data to export');
        setExportLoading(false);
        return;
      }

      toast.info(`Processing ${citizens.length} records...`);

      const provinceCodes = [...new Set(citizens.map(c => c.province_code))];
      const lguCodes = [...new Set(citizens.map(c => c.lgu_code))];
      const barangayCodes = [...new Set(citizens.map(c => c.barangay_code))];

      // Fetch provinces and LGUs
      const [provinces, lgus] = await Promise.all([
        supabase.from('provinces').select('code, name').in('code', provinceCodes),
        supabase.from('lgus').select('code, name').in('code', lguCodes)
      ]);

      // Fetch ALL barangays in batches (there are more than 1000)
      let allBarangays: Array<{ code: string; name: string; }> = [];
      let hasMore = true;
      let start = 0;
      const BARANGAY_BATCH_SIZE = 1000;
      
      while (hasMore) {
        const { data: barangayBatch, error: barangayError } = await supabase
          .from('barangays')
          .select('code, name')
          .in('code', barangayCodes)
          .range(start, start + BARANGAY_BATCH_SIZE - 1)
          .order('code');
        
        if (barangayError) {
          console.error('Error fetching barangays:', barangayError);
          break;
        }
        
        if (barangayBatch && barangayBatch.length > 0) {
          allBarangays = [...allBarangays, ...barangayBatch];
          start += BARANGAY_BATCH_SIZE;
        }
        
        hasMore = barangayBatch && barangayBatch.length === BARANGAY_BATCH_SIZE;
      }

      // Create lookup maps
      const provinceMap = new Map<string, string>();
      const lguMap = new Map<string, string>();
      const barangayMap = new Map<string, string>();
      
      (provinces.data || []).forEach(p => {
        provinceMap.set(p.code, p.name);
      });
      
      (lgus.data || []).forEach(l => {
        lguMap.set(l.code, l.name);
      });
      
      allBarangays.forEach(b => {
        barangayMap.set(b.code, b.name);
      });
      
      console.log(`Loaded ${provinceMap.size} provinces, ${lguMap.size} LGUs, ${barangayMap.size} barangays for export`);

      toast.info('Preparing export file...');

  // Remove duplicate entries by using a Map with citizen ID as key
  const uniqueCitizens = new Map();
  citizens.forEach(citizen => {
    // Only add the citizen if it's not already in the map
    if (!uniqueCitizens.has(citizen.id)) {
      uniqueCitizens.set(citizen.id, citizen);
    }
  });
  
  // Convert the Map values back to an array
  const uniqueCitizensArray = Array.from(uniqueCitizens.values());
  
  toast.info(`Processing ${uniqueCitizensArray.length} unique records...`);
  
  const exportData = uniqueCitizensArray.map(citizen => ({
    'ID': citizen.id,
    'Last Name': citizen.last_name,
    'First Name': citizen.first_name,
    'Middle Name': citizen.middle_name || '',
    'Extension Name': citizen.extension_name || '',
    'Birth Date': format(new Date(citizen.birth_date), 'MM/dd/yyyy'),
    'Sex': citizen.sex,
    'Province': provinceMap.get(citizen.province_code) || citizen.province_code || 'N/A',
    'City/Municipality': lguMap.get(citizen.lgu_code) || citizen.lgu_code || 'N/A',
    'Barangay': barangayMap.get(citizen.barangay_code) || citizen.barangay_code || 'N/A',
    'Status': citizen.status,
    'Payment Date': citizen.payment_date ? format(new Date(citizen.payment_date), 'MM/dd/yyyy') : '',
    'OSCA ID': citizen.osca_id || 'N/A',
    'RRN': citizen.rrn || 'N/A',
    'Validator': citizen.validator || '',
    'Validation Date': citizen.validation_date ? format(new Date(citizen.validation_date), 'MM/dd/yyyy') : '',
    'Remarks': citizen.remarks || '',
    'Date Registered': format(new Date(citizen.created_at), 'MM/dd/yyyy HH:mm:ss'),
    'Province Code': citizen.province_code,
    'LGU Code': citizen.lgu_code,
    'Barangay Code': citizen.barangay_code,
    'Encoded By': citizen.encoded_by || '',
    'Encoded Date': format(new Date(citizen.encoded_date), 'MM/dd/yyyy HH:mm:ss'),
    'Calendar Year': citizen.calendar_year,
    'Specimen': (citizen as any).specimen || '',
    'Disability': (citizen as any).disability || 'no',
    'Indigenous People': (citizen as any).indigenous_people || 'no',
    'Cleanlist Code': citizen.cleanlist_code || ''
  }));

      const csv = Papa.unparse(exportData);
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `senior-citizens-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Successfully exported ${exportData.length} records`);
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  const handleFilterChange = (field: keyof Filters, value: string | string[]) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const toggleStatus = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }));
  };

  const resetFilters = () => {
    setFilters({
      provinceCode: '',
      lguCode: '',
      barangayCode: '',
      status: [],
      paymentDateFrom: '',
      paymentDateTo: '',
      birthYears: [],
      birthQuarters: [],
      birthMonths: [], // Include birthMonths in reset
      remarks: '',
      searchTerm: ''
    });
  };

  const handleDelete = async (id: number) => {
    try {
      // First fetch the record to be deleted for audit logging
      const { data: oldRecord, error: fetchError } = await supabase
        .from('citizens')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Delete the record
      const { error } = await supabase
        .from('citizens')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Log the deletion to audit trail
      await logAudit({
        action: 'delete',
        table_name: 'citizens',
        record_id: id.toString(),
        details: { 
          old: oldRecord,
          type: 'Senior Citizen Delete Record'
        },
        staff_id: user?.id
      });
      
      toast.success('Record deleted successfully');
      fetchCitizens();
    } catch (error) {
      console.error('Error deleting record:', error);
      toast.error('Failed to delete record');
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const handleSaveEdit = async (updatedCitizen: Citizen) => {
    try {
      // First fetch the original record for audit logging
      const { data: oldRecord, error: fetchError } = await supabase
        .from('citizens')
        .select('*')
        .eq('id', updatedCitizen.id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Remove calendar_year from the update payload since it's a generated column
      const { calendar_year, ...updateData } = updatedCitizen;
      
      // Update the record
      const { error } = await supabase
        .from('citizens')
        .update(updateData)
        .eq('id', updatedCitizen.id);

      if (error) throw error;
      
      // Log the update to audit trail
      await logAudit({
        action: 'update',
        table_name: 'citizens',
        record_id: updatedCitizen.id.toString(),
        details: { 
          old: oldRecord,
          new: updatedCitizen,
          type: 'Senior Citizen Update Record'
        },
        staff_id: user?.id
      });
      
      toast.success('Record updated successfully');
      fetchCitizens();
    } catch (error) {
      console.error('Error updating record:', error);
      toast.error('Failed to update record');
      throw error;
    }
  };

  return (
    <div className="space-y-4 p-2 bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 min-h-screen">
      {/* Header Section with Gradient */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200/60 p-8 backdrop-blur-sm bg-white/90">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Expanded Centenarian Act Records
            </h1>
            <div className="flex items-center gap-2 text-gray-600">
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full border border-blue-200/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-semibold text-gray-800">{totalRecords.toLocaleString()}</span>
                <span className="text-gray-600">records found</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`group relative overflow-hidden px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${
                showFilters 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md' 
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Filter className="h-5 w-5" />
                <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-5 w-5 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            
            <button 
              onClick={handleExport}
              className="group relative overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={exportLoading}
            >
              <div className="flex items-center justify-center gap-2">
                {exportLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    <span>Export CSV</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white/95 backdrop-blur-lg rounded-xl shadow-l p-4 border border-gray-200/60 transform transition-all duration-300 animate-in slide-in-from-top">
          <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-gradient-to-r from-blue-200 to-purple-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-1">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
                <Filter className="h-6 w-6 text-white" />
              </div>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Advanced Filters
              </span>
            </h2>
            <button
              onClick={resetFilters}
              className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 text-red-600 rounded-xl font-medium transition-all duration-300 border border-red-200 hover:border-red-300 hover:shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:rotate-180 duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Reset All</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="group">
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Search className="h-4 w-4 text-blue-500" />
                Search
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  placeholder="Search by name..."
                  className="pl-12 w-full rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-300 py-3 shadow-sm hover:shadow-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
                Province
              </label>
              <select
                value={filters.provinceCode}
                onChange={(e) => handleFilterChange('provinceCode', e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-300 py-3 px-4 shadow-sm hover:shadow-md font-medium"
              >
                <option value="">All Provinces</option>
                {provinces.map(province => (
                  <option key={province.code} value={province.code}>
                    {province.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                City/Municipality
              </label>
              <select
                value={filters.lguCode}
                onChange={(e) => handleFilterChange('lguCode', e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all duration-300 py-3 px-4 shadow-sm hover:shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!filters.provinceCode}
              >
                <option value="">All Cities/Municipalities</option>
                {lgus.map(lgu => (
                  <option key={lgu.code} value={lgu.code}>
                    {lgu.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                Barangay
              </label>
              <select
                value={filters.barangayCode}
                onChange={(e) => handleFilterChange('barangayCode', e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-100 transition-all duration-300 py-3 px-4 shadow-sm hover:shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!filters.lguCode}
              >
                <option value="">All Barangays</option>
                {barangays.map(barangay => (
                  <option key={barangay.code} value={barangay.code}>
                    {barangay.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birth Year
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowYearFilter(!showYearFilter)}
                  className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white text-sm shadow-sm hover:bg-gray-50 transition-colors"
                >
                  <span>
                    {filters.birthYears.length > 0 
                      ? `${filters.birthYears.length} year${filters.birthYears.length > 1 ? 's' : ''} selected` 
                      : 'Select years...'}
                  </span>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className={`h-5 w-5 transition-transform duration-200 ${showYearFilter ? 'transform rotate-180' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Selected years tags */}
                {filters.birthYears.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {filters.birthYears.map(year => (
                      <span 
                        key={year} 
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                      >
                        {year}
                        <button
                          onClick={() => {
                            const newYears = filters.birthYears.filter(y => y !== year);
                            handleFilterChange('birthYears', newYears);
                          }}
                          className="ml-1 text-indigo-600 hover:text-indigo-800"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => handleFilterChange('birthYears', [])}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      Clear All
                    </button>
                  </div>
                )}
                
                {/* Year Dropdown */}
                {showYearFilter && (
                  <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-96 overflow-y-auto">
                    {/* Search bar */}
                    <div className="sticky top-0 bg-white p-2 border-b border-gray-200">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={yearSearchTerm}
                          onChange={(e) => setYearSearchTerm(e.target.value)}
                          placeholder="Search year..."
                          className="pl-10 w-full rounded-md border-gray-300 text-sm py-1"
                        />
                      </div>
                      <div className="flex justify-between mt-2">
                        <button
                          onClick={() => {
                            // Select all years
                            handleFilterChange('birthYears', [...availableBirthYears]);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => handleFilterChange('birthYears', [])}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                    
                    {/* Year list */}
                    <div className="p-1 relative">
                      <div className="grid grid-cols-3 gap-1 w-full overflow-y-auto ">
                        {availableBirthYears
                          .filter(year => 
                            yearSearchTerm === '' || 
                            year.includes(yearSearchTerm)
                          )
                          .map(year => {
                            const isSelected = filters.birthYears.includes(year);
                            return (
                              <button
                                key={year}
                                onClick={() => {
                                  const newYears = isSelected
                                    ? filters.birthYears.filter(y => y !== year)
                                    : [...filters.birthYears, year];
                                  handleFilterChange('birthYears', newYears);
                                }}
                                className={`px-3 py-2 rounded text-sm font-medium ${
                                  isSelected 
                                    ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200' 
                                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                } transition-colors duration-150 text-center flex items-center justify-center`}
                              >
                                <span className={`w-4 h-4 mr-1.5 rounded-sm border ${
                                  isSelected 
                                    ? 'bg-indigo-500 border-indigo-500' 
                                    : 'border-gray-300'
                                } flex items-center justify-center`}>
                                  {isSelected && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </span>
                                {year}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            
           

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birth Month
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowMonthFilter(!showMonthFilter)}
                  className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white text-sm shadow-sm hover:bg-gray-50 transition-colors"
                >
                  <span>
                    {filters.birthMonths.length > 0 
                      ? `${filters.birthMonths.length} month${filters.birthMonths.length > 1 ? 's' : ''} selected` 
                      : 'Select months...'}
                  </span>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className={`h-5 w-5 transition-transform duration-200 ${showMonthFilter ? 'transform rotate-180' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Selected months tags */}
                {filters.birthMonths.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {filters.birthMonths.map(month => {
                      const [year, monthNum] = month.split('-');
                      const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleString('default', { month: 'short' });
                      return (
                        <span 
                          key={month} 
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800"
                        >
                          {monthName} {year}
                          <button
                            onClick={() => {
                              const newMonths = filters.birthMonths.filter(m => m !== month);
                              handleFilterChange('birthMonths', newMonths);
                            }}
                            className="ml-1 text-teal-600 hover:text-teal-800"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      );
                    })}
                    <button
                      onClick={() => handleFilterChange('birthMonths', [])}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      Clear All
                    </button>
                  </div>
                )}
                
                {/* Month Dropdown */}
                {showMonthFilter && (
                  <div className="absolute z-50 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-96 overflow-y-auto">
                    {/* Search bar */}
                    <div className="sticky top-0 bg-white p-2 border-b border-gray-200">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={monthSearchTerm}
                          onChange={(e) => setMonthSearchTerm(e.target.value)}
                          placeholder="Search month..."
                          className="pl-10 w-full rounded-md border-gray-300 text-sm py-1"
                        />
                      </div>
                    </div>
                    
                    {/* Month selection */}
                    <div className="p-2">
                      <div className="grid grid-cols-3 gap-1">
                        {Array.from({ length: 12 }, (_, i) => {
                          const monthIndex = i;
                          const monthName = new Date(2000, monthIndex).toLocaleString('default', { month: 'long' });
                          
                          // Filter by search term if provided
                          if (monthSearchTerm && !monthName.toLowerCase().includes(monthSearchTerm.toLowerCase())) {
                            return null;
                          }
                          
                          // Check if this month is selected for the selected years
                          const monthNum = (monthIndex + 1).toString().padStart(2, '0');
                          
                          // If no years are selected, use all available years
                          const yearsToUse = filters.birthYears.length > 0 
                            ? filters.birthYears 
                            : availableBirthYears;
                            
                          const isSelected = yearsToUse.some(year => 
                            filters.birthMonths.includes(`${year}-${monthNum}`)
                          );
                          
                          return (
                            <button
                              key={monthName}
                              onClick={() => {
                                // If no years are selected, show a message
                                if (filters.birthYears.length === 0) {
                                  toast.info('Please select at least one birth year first');
                                  return;
                                }
                                
                                // If selected, remove this month from selected years
                                if (isSelected) {
                                  const newMonths = filters.birthMonths.filter(m => {
                                    const [year, mNum] = m.split('-');
                                    return mNum !== monthNum || !filters.birthYears.includes(year);
                                  });
                                  handleFilterChange('birthMonths', newMonths);
                                } else {
                                  // If not selected, add this month for selected years
                                  const newMonths = [...filters.birthMonths];
                                  filters.birthYears.forEach(year => {
                                    const monthValue = `${year}-${monthNum}`;
                                    if (!newMonths.includes(monthValue)) {
                                      newMonths.push(monthValue);
                                    }
                                  });
                                  handleFilterChange('birthMonths', newMonths);
                                }
                              }}
                              className={`px-3 py-2 rounded text-sm font-medium ${
                                isSelected 
                                  ? 'bg-teal-100 text-teal-800 hover:bg-teal-200' 
                                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                              } transition-colors duration-150 text-center flex items-center justify-center`}
                            >
                              <span className={`w-4 h-4 mr-1.5 rounded-sm border ${
                                isSelected 
                                  ? 'bg-teal-500 border-teal-500' 
                                  : 'border-gray-300'
                              } flex items-center justify-center`}>
                                {isSelected && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                              {monthName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="group">
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Remarks
              </label>
              <input
                type="text"
                value={filters.remarks}
                onChange={(e) => handleFilterChange('remarks', e.target.value)}
                placeholder="Search remarks..."
                className="w-full rounded-xl border-2 border-gray-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-300 py-3 px-4 shadow-sm hover:shadow-md font-medium"
              />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t-2 border-gradient-to-r from-gray-200 to-gray-300">
            <label className="block text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Status Filter
              </span>
            </label>
            <div className="flex flex-wrap gap-3">
              {statusOptions.map(status => {
                const isSelected = filters.status.includes(status);
                let bgColor, textColor;
                
                switch(status) {
                  case 'Encoded':
                    bgColor = isSelected ? 'bg-gray-200' : 'bg-gray-100';
                    textColor = isSelected ? 'text-gray-900' : 'text-gray-700';
                    break;
                  case 'Validated':
                    bgColor = isSelected ? 'bg-blue-200' : 'bg-blue-50';
                    textColor = isSelected ? 'text-blue-900' : 'text-blue-700';
                    break;
                  case 'Cleanlisted':
                    bgColor = isSelected ? 'bg-green-200' : 'bg-green-50';
                    textColor = isSelected ? 'text-green-900' : 'text-green-700';
                    break;
                  case 'Waitlisted':
                    bgColor = isSelected ? 'bg-yellow-200' : 'bg-yellow-50';
                    textColor = isSelected ? 'text-yellow-900' : 'text-yellow-700';
                    break;
                  case 'Paid':
                    bgColor = isSelected ? 'bg-emerald-200' : 'bg-emerald-50';
                    textColor = isSelected ? 'text-emerald-900' : 'text-emerald-700';
                    break;
                  case 'Unpaid':
                    bgColor = isSelected ? 'bg-yellow-200' : 'bg-yellow-50';
                    textColor = isSelected ? 'text-yellow-900' : 'text-yellow-700';
                    break;
                  case 'Compliance':
                    bgColor = isSelected ? 'bg-purple-200' : 'bg-purple-50';
                    textColor = isSelected ? 'text-purple-900' : 'text-purple-700';
                    break;
                  case 'Disqualified':
                    bgColor = isSelected ? 'bg-red-200' : 'bg-red-50';
                    textColor = isSelected ? 'text-red-900' : 'text-red-700';
                    break;
                  default:
                    bgColor = isSelected ? 'bg-blue-200' : 'bg-blue-50';
                    textColor = isSelected ? 'text-blue-900' : 'text-blue-700';
                }
                
                return (
                  <button
                    key={status}
                    onClick={() => toggleStatus(status)}
                    className={`group px-4 py-2.5 rounded-xl text-sm font-semibold ${bgColor} ${textColor} transition-all duration-300 hover:shadow-lg hover:scale-105 flex items-center gap-2 border-2 ${
                      isSelected ? 'border-current' : 'border-transparent'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected 
                        ? 'bg-current border-white' 
                        : 'border-current'
                    }`}>
                      {isSelected && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {status}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {loadingAssignments && (user?.position === 'PDO' || user?.position === 'LGU') && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-6 w-6 bg-blue-600 rounded-full animate-pulse"></div>
              </div>
            </div>
            <div>
              <p className="text-blue-900 font-semibold text-lg">Loading your assigned areas...</p>
              <p className="text-blue-700 text-sm mt-1">Please wait while we filter the records based on your assignments.</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200/60 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                <th 
                  onClick={() => handleSort('last_name')}
                  className="px-6 py-5 text-left text-s font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-50 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-2">
                    <span className="group-hover:text-blue-600 transition-colors">Name</span>
                    <div className="w-5 h-5 flex items-center justify-center text-blue-600">
                      {getSortIcon('last_name')}
                    </div>
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('birth_date')}
                  className="px-6 py-5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-purple-50 transition-all duration-200 group"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="group-hover:text-purple-600 transition-colors">Birth Date</span>
                    <div className="text-purple-600">{getSortIcon('birth_date')}</div>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('sex')}
                  className="px-6 py-5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-pink-50 transition-all duration-200 group"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="group-hover:text-pink-600 transition-colors">Sex</span>
                    <div className="text-pink-600">{getSortIcon('sex')}</div>
                  </div>
                </th>
                <th className="px-6 py-5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider bg-gradient-to-r from-transparent to-teal-50/50">
                  Address
                </th>
                
                <th 
                  onClick={() => handleSort('status')}
                  className="px-6 py-5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-green-50 transition-all duration-200 group"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="group-hover:text-green-600 transition-colors">Status</span>
                    <div className="text-green-600">{getSortIcon('status')}</div>
                  </div>
                </th>
                
               {/* <th 
                  onClick={() => handleSort('payment_date')}
                  className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-150"
                >
                  <div className="flex items-center space-x-1">
                    <span>Payment Date</span>
                    {getSortIcon('payment_date')}
                  </div>
                </th>
*/}
                <th className="px-6 py-5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider bg-gradient-to-r from-transparent to-amber-50/50">
                  Remarks
                </th>
                <th 
                  onClick={() => handleSort('created_at')}
                  className="px-6 py-5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-indigo-50 transition-all duration-200 group"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="group-hover:text-indigo-600 transition-colors">Encoded Date</span>
                    <div className="text-indigo-600">{getSortIcon('created_at')}</div>
                  </div>
                </th>
               
                <th className="px-6 py-5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider bg-gradient-to-l from-gray-100 to-transparent">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-blue-500 mb-4"></div>
                      <span className="text-gray-500 text-lg">Loading records...</span>
                      <p className="text-gray-400 text-sm mt-2">Please wait while we fetch the data</p>
                    </div>
                  </td>
                </tr>
              ) : citizens.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <AlertTriangle className="h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-lg font-medium">No records found</p>
                      <p className="text-gray-400 text-sm mt-2">Try adjusting your filters to see more results</p>
                    </div>
                  </td>
                </tr>
              ) : (
                citizens.map((citizen) => (
                  <CitizenRow
                    key={citizen.id}
                    citizen={citizen}
                    addressDetail={addressDetails[citizen.id]}
                    onView={setViewingCitizen}
                    onEdit={setEditingCitizen}
                    onDelete={setShowDeleteConfirm}
                    userPosition={user?.position}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && citizens.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-sm text-gray-700 bg-white px-4 py-2 rounded-md border border-gray-200 shadow-sm">
                <span className="font-medium">Showing</span> {currentPage * PAGE_SIZE + 1} - {Math.min((currentPage + 1) * PAGE_SIZE, totalRecords)} <span className="font-medium">of</span> {totalRecords} <span className="font-medium">records</span>
              </div>
              
              <div className="flex items-center bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setCurrentPage(0)}
                  disabled={currentPage === 0}
                  className={`p-2 border-r border-gray-200 hover:bg-gray-50 transition-colors ${currentPage === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="First Page"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                  className={`p-2 border-r border-gray-200 hover:bg-gray-50 transition-colors ${currentPage === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Previous Page"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                
                <div className="px-4 py-2 text-sm font-medium text-gray-700 border-r border-gray-200">
                  Page {currentPage + 1} of {totalPages}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className={`p-2 border-r border-gray-200 hover:bg-gray-50 transition-colors ${currentPage >= totalPages - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Next Page"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
                
                <button
                  onClick={() => setCurrentPage(totalPages - 1)}
                  disabled={currentPage >= totalPages - 1}
                  className={`p-2 hover:bg-gray-50 transition-colors ${currentPage >= totalPages - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Last Page"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {editingCitizen && (
        <div className="modal-overlay">
          <EditModal
            citizen={editingCitizen}
            addressDetails={addressDetails[editingCitizen.id]}
            onClose={() => setEditingCitizen(null)}
            onSave={handleSaveEdit}
          />
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-gray-200">
            <div className="flex items-center mb-4 text-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900">Confirm Delete</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6 pl-11">
              Are you sure you want to delete this record? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-md transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors duration-150 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingCitizen && (
        <div className="modal-overlay">
          <ViewModal
            citizen={viewingCitizen}
            addressDetails={addressDetails[viewingCitizen.id]}
            onClose={() => setViewingCitizen(null)}
          />
        </div>
      )}
    </div>
  );
}

export default CitizenList;
