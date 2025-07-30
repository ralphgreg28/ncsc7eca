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
        // Split search term by spaces to allow searching for multiple terms
        const searchTerms = filters.searchTerm.trim().split(/\s+/);
        
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
          if (filters.searchTerm) {
            // Split search term by spaces to allow searching for multiple terms
            const searchTerms = filters.searchTerm.trim().split(/\s+/);
            
            if (searchTerms.length === 1) {
              // If only one search term, use the original search logic
              yearQuery.or(
                `last_name.ilike.%${filters.searchTerm}%,first_name.ilike.%${filters.searchTerm}%,middle_name.ilike.%${filters.searchTerm}%`
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
          if (filters.searchTerm) {
            // Split search term by spaces to allow searching for multiple terms
            const searchTerms = filters.searchTerm.trim().split(/\s+/);
            
            if (searchTerms.length === 1) {
              // If only one search term, use the original search logic
              monthQuery.or(
                `last_name.ilike.%${filters.searchTerm}%,first_name.ilike.%${filters.searchTerm}%,middle_name.ilike.%${filters.searchTerm}%`
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
            if (filters.searchTerm) {
              // Split search term by spaces to allow searching for multiple terms
              const searchTerms = filters.searchTerm.trim().split(/\s+/);
              
              if (searchTerms.length === 1) {
                // If only one search term, use the original search logic
                monthQuery.or(
                  `last_name.ilike.%${filters.searchTerm}%,first_name.ilike.%${filters.searchTerm}%,middle_name.ilike.%${filters.searchTerm}%`
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

      const [provinces, lgus, barangays] = await Promise.all([
        supabase.from('provinces').select('code, name').in('code', provinceCodes),
        supabase.from('lgus').select('code, name').in('code', lguCodes),
        supabase.from('barangays').select('code, name').in('code', barangayCodes)
      ]);

      const provinceMap = Object.fromEntries((provinces.data || []).map(p => [p.code, p.name]));
      const lguMap = Object.fromEntries((lgus.data || []).map(l => [l.code, l.name]));
      const barangayMap = Object.fromEntries((barangays.data || []).map(b => [b.code, b.name]));

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Senior Citizens Records</h1>
          <p className="mt-1 text-gray-600">{totalRecords} records found</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-4 py-2 rounded-md font-medium transition-colors duration-150 ${
              showFilters 
                ? 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100' 
                : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
            }`}
          >
            <Filter className="h-5 w-5 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-5 w-5 ml-2 transition-transform duration-200 ${showFilters ? 'transform rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button 
            onClick={handleExport}
            className="btn-primary flex items-center"
            disabled={exportLoading}
          >
            {exportLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                <span>Export to CSV</span>
              </>
            )}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Filter className="h-5 w-5 mr-2 text-blue-500" />
              Filters
            </h2>
            <button
              onClick={resetFilters}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              <span className="mr-1">Reset All</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
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
                    <div className="p-2">
                      <div className="grid grid-cols-3 gap-1">
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
                  <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-96 overflow-y-auto">
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

          <div className="mt-6 pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Status Filter
            </label>
            <div className="flex flex-wrap gap-2">
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
                    className={`px-3 py-1.5 rounded-full text-sm font-medium ${bgColor} ${textColor} transition-colors duration-150 hover:shadow-sm flex items-center`}
                  >
                    {isSelected && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {status}
                  </button>
                );
              })}
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
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <th 
                  onClick={() => handleSort('last_name')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-150"
                >
                  <div className="flex items-center space-x-1">
                    <span>Name</span>
                    <div className="w-4 h-4 flex items-center justify-center">
                      {getSortIcon('last_name')}
                    </div>
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('birth_date')}
                  className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-150"
                >
                  <div className="flex items-center space-x-1">
                    <span>Birth Date</span>
                    {getSortIcon('birth_date')}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('sex')}
                  className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-150"
                >
                  <div className="flex items-center space-x-1">
                    <span>Sex</span>
                    {getSortIcon('sex')}
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Address
                </th>
                
                <th 
                  onClick={() => handleSort('status')}
                  className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-150"
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    {getSortIcon('status')}
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
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Remarks
                </th>
                <th 
                  onClick={() => handleSort('created_at')}
                  className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-150"
                >
                  <div className="flex items-center space-x-1">
                    <span>Encoded Date</span>
                    {getSortIcon('created_at')}
                  </div>
                </th>
               
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
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
                citizens.map((citizen) => {
                  const addressDetail = addressDetails[citizen.id];
                  return (
                    <tr 
                      key={citizen.id} 
                      className="hover:bg-gray-50 transition-colors duration-150 group"
                    >
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium text-gray-900 whitespace-nowrap group-hover:text-blue-700 transition-colors duration-150">
                          {citizen.last_name},
                        </div>
                        <div className="text-xs font-medium text-gray-900 whitespace-nowrap">
                          {citizen.first_name}
                        </div>
                        
                        <div className="text-xs text-gray-500 whitespace-nowrap">
                          {citizen.middle_name && `${citizen.middle_name} `}
                          {citizen.extension_name && `(${citizen.extension_name})`}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap font-medium text-center">
                        {format(new Date(citizen.birth_date), 'MMMM d, yyyy')}
                          <br/> 
                        CY {citizen.calendar_year}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium  ${
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
                        <div
                          className={`text-sm text-gray-900 whitespace-nowrap p-2 rounded border ${
                            addressDetail?.province_name === 'BOHOL'
                              ? 'bg-yellow-50 border-yellow-200'
                              : addressDetail?.province_name === 'CEBU'
                              ? 'bg-blue-50 border-blue-200'
                              : addressDetail?.province_name === 'NEGROS ORIENTAL'
                              ? 'bg-green-50 border-green-200'
                              : addressDetail?.province_name === 'SIQUIJOR'
                              ? 'bg-purple-50 border-purple-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          {addressDetail ? (
                            <div className="flex flex-col text-left">
                              <div className="font-small">
                                {addressDetail.barangay_name}
                              </div>
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
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          citizen.status === 'Encoded' ? 'bg-gray-200 text-gray-800' :
                          citizen.status === 'Validated' ? 'bg-blue-200 text-blue-800' :
                          citizen.status === 'Cleanlisted' ? 'bg-green-200 text-green-800' :
                          citizen.status === 'Wwaitlisted' ? 'bg-yellow-200 text-yellow-800' : 
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
                     
                      { /*
                      <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap text-center w-[50px]">
                        {citizen.payment_date ? format(new Date(citizen.payment_date), 'MMM d, yyyy') : '-'}
                      </td>
                      */}

                      <td className="px-6 py-4">
                      <div 
                        className="text-[9px] text-gray-500 w-[100px] line-clamp-5 text-center" 
                        title={citizen.remarks || '-'}
                      >
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
                            onClick={() => setViewingCitizen(citizen)}
                            className="text-gray-600 hover:text-gray-900 transition-colors duration-150 p-1.5 rounded-full hover:bg-gray-100"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {(user?.position === 'Administrator' || user?.position === 'PDO') && (  
                            <button
                              onClick={() => setEditingCitizen(citizen)}
                              className="text-blue-600 hover:text-blue-900 transition-colors duration-150 p-1.5 rounded-full hover:bg-blue-50"
                              title="Edit Record"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          
                          {user?.position === 'Administrator' && (
                            <button
                              onClick={() => setShowDeleteConfirm(citizen.id)}
                              className="text-red-600 hover:text-red-900 transition-colors duration-150 p-1.5 rounded-full hover:bg-red-50"
                              title="Delete Record"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
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
