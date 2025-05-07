import { useState, useEffect } from 'react';
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
  birthDateFrom: string;
  birthDateTo: string;
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
}

interface AddressDetails {
  province_name: string;
  lgu_name: string;
  barangay_name: string;
}

type SortField = 'last_name' | 'birth_date' | 'sex' | 'status' | 'payment_date' | 'created_at';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE = 50;
const EXPORT_BATCH_SIZE = 1000;

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
  const { user } = useAuth();
  const [userAssignments, setUserAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [viewingCitizen, setViewingCitizen] = useState<Citizen | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filters, setFilters] = useState<Filters>({
    provinceCode: '',
    lguCode: '',
    barangayCode: '',
    status: [],
    paymentDateFrom: '',
    paymentDateTo: '',
    birthDateFrom: '',
    birthDateTo: '',
    remarks: '',
    searchTerm: ''
  });

  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

  const statusOptions = [
    'Encoded',
    'Validated',
    'Cleanlisted',
    'Paid',
    'Unpaid',
    'Liquidated',
    'Disqualified'
  ];

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

  useEffect(() => {
    setCurrentPage(0);
    fetchCitizens();
  }, [filters, sortField, sortOrder]);

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

  const fetchAddressDetails = async (citizens: Citizen[]) => {
    try {
      const provinceCodes = [...new Set(citizens.map(c => c.province_code))];
      const lguCodes = [...new Set(citizens.map(c => c.lgu_code))];
      const barangayCodes = [...new Set(citizens.map(c => c.barangay_code))];

      const [{ data: provinces }, { data: lgus }, { data: barangays }] = await Promise.all([
        supabase.from('provinces').select('code, name').in('code', provinceCodes),
        supabase.from('lgus').select('code, name').in('code', lguCodes),
        supabase.from('barangays').select('code, name').in('code', barangayCodes)
      ]);

      const provinceMap = Object.fromEntries((provinces || []).map(p => [p.code, p.name]));
      const lguMap = Object.fromEntries((lgus || []).map(l => [l.code, l.name]));
      const barangayMap = Object.fromEntries((barangays || []).map(b => [b.code, b.name]));

      setAddressMaps({
        provinces: provinceMap,
        lgus: lguMap,
        barangays: barangayMap
      });

      const details: Record<string, AddressDetails> = {};
      citizens.forEach(citizen => {
        details[citizen.id] = {
          province_name: provinceMap[citizen.province_code] || 'Unknown',
          lgu_name: lguMap[citizen.lgu_code] || 'Unknown',
          barangay_name: barangayMap[citizen.barangay_code] || 'Unknown'
        };
      });

      setAddressDetails(details);
      return { provinces, lgus, barangays };
    } catch (error) {
      console.error('Error fetching address details:', error);
      return { provinces: [], lgus: [], barangays: [] };
    }
  };

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

      if (filters.searchTerm) {
        query = query.or(
          `last_name.ilike.%${filters.searchTerm}%,` +
          `first_name.ilike.%${filters.searchTerm}%,` +
          `middle_name.ilike.%${filters.searchTerm}%`
        );
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

      if (filters.birthDateFrom) {
        query = query.gte('birth_date', filters.birthDateFrom);
      }

      if (filters.birthDateTo) {
        query = query.lte('birth_date', filters.birthDateTo);
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
        query = query.or(
          `last_name.ilike.%${filters.searchTerm}%,` +
          `first_name.ilike.%${filters.searchTerm}%,` +
          `middle_name.ilike.%${filters.searchTerm}%`
        );
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

      if (filters.birthDateFrom) {
        query = query.gte('birth_date', filters.birthDateFrom);
      }

      if (filters.birthDateTo) {
        query = query.lte('birth_date', filters.birthDateTo);
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

      const [provinces, lgus, barangays] = await Promise.all([
        supabase.from('provinces').select('code, name').in('code', provinceCodes),
        supabase.from('lgus').select('code, name').in('code', lguCodes),
        supabase.from('barangays').select('code, name').in('code', barangayCodes)
      ]);

      const provinceMap = Object.fromEntries((provinces.data || []).map(p => [p.code, p.name]));
      const lguMap = Object.fromEntries((lgus.data || []).map(l => [l.code, l.name]));
      const barangayMap = Object.fromEntries((barangays.data || []).map(b => [b.code, b.name]));

      toast.info('Preparing export file...');

      const exportData = citizens.map(citizen => ({
        'ID': citizen.id,
        'Last Name': citizen.last_name,
        'First Name': citizen.first_name,
        'Middle Name': citizen.middle_name || '',
        'Extension Name': citizen.extension_name || '',
        'Birth Date': format(new Date(citizen.birth_date), 'MM/dd/yyyy'),
        'Sex': citizen.sex,
        'Province': provinceMap[citizen.province_code] || citizen.province_code,
        'City/Municipality': lguMap[citizen.lgu_code] || citizen.lgu_code,
        'Barangay': barangayMap[citizen.barangay_code] || citizen.barangay_code,
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
        'Encoded Date': format(new Date(citizen.encoded_date), 'MM/dd/yyyy HH:mm:ss')
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
      birthDateFrom: '',
      birthDateTo: '',
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
      
      // Update the record
      const { error } = await supabase
        .from('citizens')
        .update(updatedCitizen)
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Senior Citizens Records</h1>
          <p className="mt-1 text-gray-600">{totalRecords} records found</p>
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
            onClick={handleExport}
            className="btn-primary flex items-center"
            disabled={exportLoading}
          >
            <Download className="h-5 w-5 mr-2" />
            {exportLoading ? 'Exporting...' : 'Export to CSV'}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            <button
              onClick={resetFilters}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  placeholder="Search name..."
                  className="pl-10 w-full rounded-md border-gray-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Province
              </label>
              <select
                value={filters.provinceCode}
                onChange={(e) => handleFilterChange('provinceCode', e.target.value)}
                className="w-full rounded-md border-gray-300"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City/Municipality
              </label>
              <select
                value={filters.lguCode}
                onChange={(e) => handleFilterChange('lguCode', e.target.value)}
                className="w-full rounded-md border-gray-300"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Barangay
              </label>
              <select
                value={filters.barangayCode}
                onChange={(e) => handleFilterChange('barangayCode', e.target.value)}
                className="w-full rounded-md border-gray-300"
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
              <label className="block text-sm font-medium text-gray-700">
                Birth Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500">From</label>
                  <input
                    type="date"
                    value={filters.birthDateFrom}
                    onChange={(e) => handleFilterChange('birthDateFrom', e.target.value)}
                    className="w-full rounded-md border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">To</label>
                  <input
                    type="date"
                    value={filters.birthDateTo}
                    onChange={(e) => handleFilterChange('birthDateTo', e.target.value)}
                    className="w-full rounded-md border-gray-300"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Payment Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500">From</label>
                  <input
                    type="date"
                    value={filters.paymentDateFrom}
                    onChange={(e) => handleFilterChange('paymentDateFrom', e.target.value)}
                    className="w-full rounded-md border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">To</label>
                  <input
                    type="date"
                    value={filters.paymentDateTo}
                    onChange={(e) => handleFilterChange('paymentDateTo', e.target.value)}
                    className="w-full rounded-md border-gray-300"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remarks
              </label>
              <input
                type="text"
                value={filters.remarks}
                onChange={(e) => handleFilterChange('remarks', e.target.value)}
                placeholder="Search remarks..."
                className="w-full rounded-md border-gray-300"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(status => (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    filters.status.includes(status)
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loadingAssignments && (user?.position === 'PDO' || user?.position === 'LGU') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
          <p className="text-blue-700">
            Loading your assigned areas... Please wait while we filter the records based on your assignments.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th 
                  onClick={() => handleSort('last_name')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-150"
                >
                  <div className="flex items-center space-x-1">
                    <span>Name</span>
                    {getSortIcon('last_name')}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('birth_date')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-150"
                >
                  <div className="flex items-center space-x-1">
                    <span>Birth Date</span>
                    {getSortIcon('birth_date')}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('sex')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-150"
                >
                  <div className="flex items-center space-x-1">
                    <span>Sex</span>
                    {getSortIcon('sex')}
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Address
                </th>
                <th 
                  onClick={() => handleSort('status')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-150"
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    {getSortIcon('status')}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('payment_date')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-150"
                >
                  <div className="flex items-center space-x-1">
                    <span>Payment Date</span>
                    {getSortIcon('payment_date')}
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Remarks
                </th>
<th 
                  onClick={() => handleSort('created_at')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-150"
                >
                  <div className="flex items-center space-x-1">
                    <span>Encoded Date</span>
                    {getSortIcon('created_at')}
                  </div>
                </th>
               
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      <span className="ml-2 text-gray-500">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : citizens.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <AlertTriangle className="h-8 w-8 text-gray-400 mb-2" />
                      <p>No records found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                citizens.map((citizen) => {
                  const addressDetail = addressDetails[citizen.id];
                  return (
                    <tr 
                      key={citizen.id} 
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 whitespace-nowrap">
                          {citizen.last_name},
                        </div>
                        <div className="text-sm font-medium text-gray-900 whitespace-nowrap">
                          {citizen.first_name}
                        </div>
                        
                        <div className="text-sm text-gray-500 whitespace-nowrap">
                          {citizen.middle_name && `${citizen.middle_name} `}
                          {citizen.extension_name && `(${citizen.extension_name})`}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {format(new Date(citizen.birth_date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          citizen.sex === 'Male' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                        }`}>
                          {citizen.sex}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                      <div
                        className={`text-sm text-gray-900 whitespace-nowrap p-2 rounded
                          ${
                            addressDetail?.province_name === 'BOHOL'
                              ? 'bg-yellow-100'
                              : addressDetail?.province_name === 'CEBU'
                              ? 'bg-blue-100'
                              : addressDetail?.province_name === 'NEGROS ORIENTAL'
                              ? 'bg-green-100'
                              : addressDetail?.province_name === 'SIQUIJOR'
                              ? 'bg-purple-100'
                              : ''
                          }
                        `}
                      >
                        {addressDetail ? (
                          <>
                            <div>{addressDetail.barangay_name}</div>
                            <div className="text-gray-500 text-xs">
                              <div className="whitespace-nowrap">{addressDetail.lgu_name}</div>
                              <div className="whitespace-nowrap">{addressDetail.province_name}</div>
                            </div>
                          </>
                        ) : (
                          'Loading...'
                        )}
                      </div>
                    </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          citizen.status === 'Encoded' ? 'bg-gray-100 text-gray-800' :
                          citizen.status === 'Validated' ? 'bg-blue-100 text-blue-800' :
                          citizen.status === 'Cleanlisted' ? 'bg-green-100 text-green-800' :
                          citizen.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                          citizen.status === 'Unpaid' ? 'bg-yellow-100 text-yellow-800' :
                          citizen.status === 'Liquidated' ? 'bg-purple-100 text-purple-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {citizen.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {citizen.payment_date ? format(new Date(citizen.payment_date), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="px-6 py-4">
                          <div 
                          className="text-sm text-gray-500 max-w-xs truncate" 
                          title={citizen.remarks || '-'}
                          >
                          {citizen.remarks || '-'}
                          </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500 max-w-xs truncate">
                          {citizen.encoded_date ? format(new Date(citizen.encoded_date), 'MMM dd, yyyy') : '-'}
                        </div>      
                        <div className="text-sm text-gray-500 max-w-xs truncate">
                        {citizen.encoded_date ? format(new Date(citizen.encoded_date), 'hh:mm:ss a') : '-'}
                        </div>               
                      </td>
                     
                      <td className="px-2 py-2 text-right space-x-1 whitespace-nowrap">
  <button
    onClick={() => setViewingCitizen(citizen)}
    className="text-gray-600 hover:text-gray-900 transition-colors duration-150 p-1 rounded-full"
    title="View Details"
  >
    <Eye className="h-4 w-4" />
  </button>
  {(user?.position === 'Administrator' || user?.position === 'PDO') && (  
  <button
    onClick={() => setEditingCitizen(citizen)}
    className="text-blue-600 hover:text-blue-900 transition-colors duration-150 p-1 rounded-full"
    title="Edit Record"
  >
    <Edit className="h-4 w-4" />
  </button>
  )}
  {user?.position === 'Administrator' && (
    <button
      onClick={() => setShowDeleteConfirm(citizen.id)}
      className="text-red-600 hover:text-red-900 transition-colors duration-150 p-1 rounded-full"
      title="Delete Record"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )}
</td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && citizens.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {currentPage * PAGE_SIZE + 1} to {Math.min((currentPage + 1) * PAGE_SIZE, totalRecords)} of {totalRecords} records
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                  className={`btn-outline p-2 ${currentPage === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className={`btn-outline p-2 ${currentPage >= totalPages - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <ChevronRight className="h-5 w-5" />
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
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Delete</h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to delete this record? This action cannot be undone.
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
