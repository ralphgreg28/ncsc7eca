import { useState, useEffect } from 'react';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { supabase } from '../lib/supabase';
import { 
  RefreshCw, 
  Download, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft, 
  ChevronRight, 
  BarChart2,
  Calendar,
  Users,
  Building,
  FileText,
  TrendingUp,
  Eye,
  EyeOff,
  Search,
  AlertCircle
} from 'lucide-react';

interface DailyEncodingStats {
  date: string;
  lgu_name: string;
  province_name: string;
  staff_name: string;
  status?: string;
  count: number;
}

interface Filters {
  startDate: string;
  endDate: string;
  province: string;
  lgu: string;
  staff: string;
  status: string;
}

interface AddressOption {
  code: string;
  name: string;
}

interface PaginationSettings {
  currentPage: number;
  recordsPerPage: number;
}

interface SummaryStats {
  name: string;
  count: number;
}

function EncodedStatusMonitor() {
  const [loading, setLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState<DailyEncodingStats[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [provinces, setProvinces] = useState<AddressOption[]>([]);
  const [lgus, setLgus] = useState<AddressOption[]>([]);
  const [pagination, setPagination] = useState<PaginationSettings>({
    currentPage: 1,
    recordsPerPage: 50
  });
  const [summaryType, setSummaryType] = useState<'province' | 'lgu' | 'staff' | 'status'>('province');

  // Get current week's start and end dates
  const currentDate = new Date();
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday as week start
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 }); // Sunday as week end

  const [filters, setFilters] = useState<Filters>({
    startDate: format(weekStart, 'yyyy-MM-dd'),
    endDate: format(weekEnd, 'yyyy-MM-dd'),
    province: '',
    lgu: '',
    staff: '',
    status: ''
  });

  useEffect(() => {
    fetchProvinces();
    fetchDailyEncodingStats();
  }, []);

  useEffect(() => {
    if (filters.province) {
      fetchLGUs();
    }
  }, [filters.province]);

  useEffect(() => {
    fetchDailyEncodingStats();
    // Reset to page 1 when filters change
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [filters]);

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
    }
  };

  const fetchLGUs = async () => {
    try {
      const { data, error } = await supabase
        .from('lgus')
        .select('code, name')
        .eq('province_code', filters.province)
        .order('name');

      if (error) throw error;
      setLgus(data || []);
      setFilters(prev => ({ ...prev, lgu: '' }));
    } catch (error) {
      console.error('Error fetching LGUs:', error);
    }
  };

  const fetchDailyEncodingStats = async () => {
    try {
      setLoading(true);

      // First, check if there are any citizens in the database at all
      const { data: allCitizens, error: allError } = await supabase
        .from('citizens')
        .select('id, status')
        .limit(5);

      console.log('All citizens check:', allCitizens);
      
      if (allError) {
        console.error('Error checking all citizens:', allError);
      }

      // Let's simplify and just get a few distinct status values
      try {
        const { data: statusValues, error: statusError } = await supabase
          .from('citizens')
          .select('status')
          .limit(10);

        console.log('Sample status values in database:', statusValues);
        
        if (statusError) {
          console.error('Error checking status values:', statusError);
        }
      } catch (error) {
        console.error('Error checking status values:', error);
      }

      // Build the query - remove artificial limit to fetch all records
      let query = supabase
        .from('citizens')
        .select(`
          id,
          created_at,
          encoded_date,
          encoded_by,
          province_code,
          lgu_code,
          status
        `);

      console.log('Date filters:', filters.startDate, filters.endDate);
      
      // Apply date filters correctly - use encoded_date primarily, fallback to created_at
      if (filters.startDate && filters.endDate) {
        // Use date range filtering on encoded_date (which is the primary field for encoding dates)
        query = query
          .gte('encoded_date', `${filters.startDate}T00:00:00.000Z`)
          .lte('encoded_date', `${filters.endDate}T23:59:59.999Z`);
      } else if (filters.startDate) {
        query = query.gte('encoded_date', `${filters.startDate}T00:00:00.000Z`);
      } else if (filters.endDate) {
        query = query.lte('encoded_date', `${filters.endDate}T23:59:59.999Z`);
      }
      if (filters.province) {
        query = query.eq('province_code', filters.province);
      }
      if (filters.lgu) {
        query = query.eq('lgu_code', filters.lgu);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.staff) {
        // Case-insensitive search for staff name
        query = query.ilike('encoded_by', `%${filters.staff}%`);
      }

      // First get the count to see how many records we need to fetch
      let countQuery = supabase
        .from('citizens')
        .select('*', { count: 'exact', head: true });
        
      // Apply same filters to count query
      if (filters.startDate && filters.endDate) {
        countQuery = countQuery
          .gte('encoded_date', `${filters.startDate}T00:00:00.000Z`)
          .lte('encoded_date', `${filters.endDate}T23:59:59.999Z`);
      } else if (filters.startDate) {
        countQuery = countQuery.gte('encoded_date', `${filters.startDate}T00:00:00.000Z`);
      } else if (filters.endDate) {
        countQuery = countQuery.lte('encoded_date', `${filters.endDate}T23:59:59.999Z`);
      }
      if (filters.province) {
        countQuery = countQuery.eq('province_code', filters.province);
      }
      if (filters.lgu) {
        countQuery = countQuery.eq('lgu_code', filters.lgu);
      }
      if (filters.status) {
        countQuery = countQuery.eq('status', filters.status);
      }
      if (filters.staff) {
        countQuery = countQuery.ilike('encoded_by', `%${filters.staff}%`);
      }
      
      const { count, error: countError } = await countQuery;
      
      if (countError) {
        console.error('Error getting count:', countError);
        throw countError;
      }
      
      console.log('Total available records matching filters:', count);
      
      // Now fetch all records using pagination if needed
      let allData: any[] = [];
      const pageSize = 1000; // Supabase's default limit
      let currentPage = 0;
      
      if (count && count > 0) {
        const totalPages = Math.ceil(count / pageSize);
        console.log(`Fetching ${count} records across ${totalPages} pages...`);
        
        for (let page = 0; page < totalPages; page++) {
          console.log(`Fetching page ${page + 1} of ${totalPages}...`);
          
          // Build query for this page
          let pageQuery = supabase
            .from('citizens')
            .select(`
              id,
              created_at,
              encoded_date,
              encoded_by,
              province_code,
              lgu_code,
              status
            `)
            .range(page * pageSize, (page + 1) * pageSize - 1);
          
          // Apply same filters to page query
          if (filters.startDate && filters.endDate) {
            pageQuery = pageQuery
              .gte('encoded_date', `${filters.startDate}T00:00:00.000Z`)
              .lte('encoded_date', `${filters.endDate}T23:59:59.999Z`);
          } else if (filters.startDate) {
            pageQuery = pageQuery.gte('encoded_date', `${filters.startDate}T00:00:00.000Z`);
          } else if (filters.endDate) {
            pageQuery = pageQuery.lte('encoded_date', `${filters.endDate}T23:59:59.999Z`);
          }
          if (filters.province) {
            pageQuery = pageQuery.eq('province_code', filters.province);
          }
          if (filters.lgu) {
            pageQuery = pageQuery.eq('lgu_code', filters.lgu);
          }
          if (filters.status) {
            pageQuery = pageQuery.eq('status', filters.status);
          }
          if (filters.staff) {
            pageQuery = pageQuery.ilike('encoded_by', `%${filters.staff}%`);
          }
          
          const { data: pageData, error: pageError } = await pageQuery;
          
          if (pageError) {
            console.error(`Error fetching page ${page + 1}:`, pageError);
            throw pageError;
          }
          
          if (pageData) {
            allData = allData.concat(pageData);
            console.log(`Page ${page + 1} returned ${pageData.length} records. Total so far: ${allData.length}`);
          }
        }
      }
      
      const data = allData;
      console.log('Final data array:', data);
      console.log('Total records fetched:', data?.length);

      // Get all province and LGU data for lookup
      const { data: allProvinces, error: provincesError } = await supabase
        .from('provinces')
        .select('code, name');
      
      if (provincesError) {
        console.error('Error fetching provinces:', provincesError);
      }
      
      const { data: allLGUs, error: lgusError } = await supabase
        .from('lgus')
        .select('code, name, province_code');
      
      if (lgusError) {
        console.error('Error fetching LGUs:', lgusError);
      }
      
      console.log('All provinces:', allProvinces);
      console.log('All LGUs:', allLGUs);
      
      // Create lookup maps for provinces and LGUs
      const provinceMap = new Map();
      const lguMap = new Map();
      
      if (allProvinces) {
        allProvinces.forEach(province => {
          provinceMap.set(province.code, province.name);
        });
      }
      
      if (allLGUs) {
        allLGUs.forEach(lgu => {
          lguMap.set(lgu.code, lgu.name);
        });
      }
      
      // Transform the data
      const formattedData = (data || []).map(item => {
        console.log('Processing item:', item);
        console.log('Province code:', item.province_code);
        console.log('LGU code:', item.lgu_code);
        console.log('Encoded by:', item.encoded_by);
        console.log('Encoded date:', item.encoded_date);
        console.log('Status:', item.status);
        
        // Use created_at as fallback if encoded_date is not available
        const dateToUse = item.encoded_date || item.created_at || new Date().toISOString();
        
        // Look up province and LGU names from our maps
        const provinceName = provinceMap.get(item.province_code) || 'Unknown';
        const lguName = lguMap.get(item.lgu_code) || 'Unknown';
        
        return {
          encoded_date: dateToUse,
          province_name: provinceName,
          lgu_name: lguName,
          staff_name: item.encoded_by || 'Unknown',
          status: item.status || 'Unknown'
        };
      });

      // Group by date, LGU, and staff to get daily counts
      const statsMap = new Map<string, DailyEncodingStats>();
      
      formattedData.forEach(item => {
        try {
          // Format the date consistently to ensure proper grouping
          const formattedDate = format(parseISO(item.encoded_date), 'yyyy-MM-dd');
          
          // Create a key that includes all grouping fields with consistent date format
          const key = `${formattedDate}-${item.province_name}-${item.lgu_name}-${item.staff_name}-${item.status}`;
          
          console.log('Processing item with key:', key);
          
          if (statsMap.has(key)) {
            // If this combination already exists, increment the count
            const existing = statsMap.get(key)!;
            existing.count += 1;
            console.log(`Incrementing count for key ${key} to ${existing.count}`);
          } else {
            // Otherwise, create a new entry
            statsMap.set(key, {
              date: formattedDate,
              lgu_name: item.lgu_name,
              province_name: item.province_name,
              staff_name: item.staff_name,
              status: item.status,
              count: 1
            });
            console.log(`Creating new entry for key ${key}`);
          }
        } catch (error) {
          console.error('Error processing item for stats map:', error, item);
        }
      });
      
      console.log('Stats map before conversion:', Array.from(statsMap.entries()));

      // Convert map to array and sort by date (newest first), then by LGU, then by staff name
      const statsArray = Array.from(statsMap.values()).sort((a, b) => {
        // Sort by date (newest first)
        const dateComparison = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateComparison !== 0) return dateComparison;
        
        // Then by LGU name
        const lguComparison = a.lgu_name.localeCompare(b.lgu_name);
        if (lguComparison !== 0) return lguComparison;
        
        // Then by staff name
        return a.staff_name.localeCompare(b.staff_name);
      });

      setDailyStats(statsArray);
    } catch (error) {
      console.error('Error fetching daily encoding stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      startDate: format(weekStart, 'yyyy-MM-dd'),
      endDate: format(weekEnd, 'yyyy-MM-dd'),
      province: '',
      lgu: '',
      staff: '',
      status: ''
    });
  };

  // Helper function to escape CSV values
  const escapeCSV = (value: string | number): string => {
    if (typeof value === 'number') return value.toString();
    
    // If the value contains commas, quotes, or newlines, wrap it in quotes
    // Also escape any quotes by doubling them
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const exportToCSV = () => {
    if (dailyStats.length === 0) return;

    // Create CSV content
    const headers = ['Date', 'Province', 'LGU', 'Encoder', 'Status', 'Total Records'];
    const csvContent = [
      headers.join(','),
      ...dailyStats.map(stat => [
        escapeCSV(format(parseISO(stat.date), 'yyyy-MM-dd')),
        escapeCSV(stat.province_name),
        escapeCSV(stat.lgu_name),
        escapeCSV(stat.staff_name || 'Unknown'),
        escapeCSV(stat.status || 'Unknown'),
        escapeCSV(stat.count)
      ].join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `encoded_status_report_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate summary statistics for overview cards
  const totalRecords = dailyStats.reduce((sum, stat) => sum + stat.count, 0);
  const uniqueProvinces = new Set(dailyStats.map(stat => stat.province_name)).size;
  const uniqueLGUs = new Set(dailyStats.map(stat => stat.lgu_name)).size;
  const uniqueStaff = new Set(dailyStats.map(stat => stat.staff_name)).size;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart2 className="h-6 w-6 text-blue-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Encoded Status Monitor</h1>
              </div>
              <p className="text-gray-600">Track daily encoding progress and performance metrics across all LGUs</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showFilters 
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Filter className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
                <span className="sm:hidden">Filters</span>
                {showFilters ? (
                  <ChevronUp className="h-4 w-4 ml-2" />
                ) : (
                  <ChevronDown className="h-4 w-4 ml-2" />
                )}
              </button>
              <button
                onClick={resetFilters}
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                title="Reset Filters"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Reset</span>
              </button>
              <button
                onClick={exportToCSV}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={dailyStats.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Records</p>
                <p className="text-2xl font-bold text-gray-900">{totalRecords.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Provinces</p>
                <p className="text-2xl font-bold text-gray-900">{uniqueProvinces}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Building className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active LGUs</p>
                <p className="text-2xl font-bold text-gray-900">{uniqueLGUs}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Building className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Staff</p>
                <p className="text-2xl font-bold text-gray-900">{uniqueStaff}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Users className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Filter className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Calendar className="h-4 w-4" />
                  Date Range
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Building className="h-4 w-4" />
                  Province
                </label>
                <select
                  value={filters.province}
                  onChange={(e) => setFilters(prev => ({ ...prev, province: e.target.value }))}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
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
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Building className="h-4 w-4" />
                  LGU
                </label>
                <select
                  value={filters.lgu}
                  onChange={(e) => setFilters(prev => ({ ...prev, lgu: e.target.value }))}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                  disabled={!filters.province}
                >
                  <option value="">All LGUs</option>
                  {lgus.map(lgu => (
                    <option key={lgu.code} value={lgu.code}>
                      {lgu.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Search className="h-4 w-4" />
                  Encoder Name
                </label>
                <input
                  type="text"
                  value={filters.staff}
                  onChange={(e) => setFilters(prev => ({ ...prev, staff: e.target.value }))}
                  placeholder="Search by staff name..."
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                />
              </div>
              
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="Encoded">Encoded</option>
                  <option value="Validated">Validated</option>
                  <option value="Cleanlisted">Cleanlisted</option>
                  <option value="Waitlisted">Waitlisted</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Compliance">Compliance</option>
                  <option value="Disqualified">Disqualified</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Summary Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Summary Analytics</h2>
              <button
                onClick={() => setShowSummary(!showSummary)}
                className="p-1 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                {showSummary ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span>Total: <span className="font-semibold text-blue-600">{totalRecords.toLocaleString()}</span> records</span>
            </div>
          </div>
          
          {showSummary && (
            <>
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  { key: 'province', label: 'By Province', icon: Building },
                  { key: 'lgu', label: 'By LGU', icon: Building },
                  { key: 'staff', label: 'By Staff', icon: Users },
                  { key: 'status', label: 'By Status', icon: TrendingUp }
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setSummaryType(key as any)}
                    className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      summaryType === key 
                        ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {label}
                  </button>
                ))}
              </div>
              
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {summaryType === 'province' ? 'Province' : 
                         summaryType === 'lgu' ? 'LGU' : 
                         summaryType === 'staff' ? 'Staff Member' : 'Status'}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Records
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Percentage
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      // Calculate summary statistics based on selected type
                      const summaryMap = new Map<string, number>();
                      
                      dailyStats.forEach(stat => {
                        const key = summaryType === 'province' ? stat.province_name :
                                   summaryType === 'lgu' ? stat.lgu_name :
                                   summaryType === 'staff' ? stat.staff_name : 
                                   stat.status || 'Unknown';
                        
                        const currentCount = summaryMap.get(key) || 0;
                        summaryMap.set(key, currentCount + stat.count);
                      });
                      
                      // Convert to array and sort by count (highest first)
                      const summaryArray = Array.from(summaryMap.entries())
                        .map(([name, count]) => ({ name, count }))
                        .sort((a, b) => b.count - a.count);
                      
                      return summaryArray.map((item, index) => {
                        const percentage = totalRecords > 0 ? (item.count / totalRecords * 100) : 0;
                        return (
                          <tr key={index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {item.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 font-semibold">
                              {item.count.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                              {percentage.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        
        {/* Main Table Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Daily Encoding Records</h2>
            </div>
            <div className="text-sm text-gray-600">
              Showing {Math.min(dailyStats.length, pagination.currentPage * pagination.recordsPerPage) - 
               Math.min(dailyStats.length, (pagination.currentPage - 1) * pagination.recordsPerPage)} of {dailyStats.length} records
            </div>
          </div>
          
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Province</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LGU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Encoder</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Records</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-sm text-gray-500">Loading encoding data...</p>
                      </div>
                    </td>
                  </tr>
                ) : dailyStats.length > 0 ? (
                  // Get current page of records
                  dailyStats
                    .slice(
                      (pagination.currentPage - 1) * pagination.recordsPerPage,
                      pagination.currentPage * pagination.recordsPerPage
                    )
                    .map((stat, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(parseISO(stat.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {stat.province_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {stat.lgu_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {stat.staff_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          stat.status === 'Approved' ? 'bg-green-100 text-green-800' :
                          stat.status === 'Verified' ? 'bg-blue-100 text-blue-800' :
                          stat.status === 'Encoded' ? 'bg-yellow-100 text-yellow-800' :
                          stat.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                          stat.status === 'Pending' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {stat.status || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 font-semibold">
                        {stat.count.toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-gray-500 mb-2">No encoding data found</p>
                        <p className="text-sm text-gray-400">
                          Try adjusting your filters or check if there are records in the selected date range
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {dailyStats.length > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">
                  Showing {Math.min(dailyStats.length, (pagination.currentPage - 1) * pagination.recordsPerPage + 1)} to {Math.min(dailyStats.length, pagination.currentPage * pagination.recordsPerPage)} of {dailyStats.length} records
                </span>
                <select
                  value={pagination.recordsPerPage}
                  onChange={(e) => setPagination(prev => ({ ...prev, currentPage: 1, recordsPerPage: Number(e.target.value) }))}
                  className="ml-2 block w-full sm:w-auto rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                  disabled={pagination.currentPage === 1}
                  className={`p-2 rounded-lg ${pagination.currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'} transition-colors`}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                <span className="text-sm text-gray-700">
                  Page {pagination.currentPage} of {Math.ceil(dailyStats.length / pagination.recordsPerPage)}
                </span>
                
                <button
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                  disabled={pagination.currentPage >= Math.ceil(dailyStats.length / pagination.recordsPerPage)}
                  className={`p-2 rounded-lg ${pagination.currentPage >= Math.ceil(dailyStats.length / pagination.recordsPerPage) ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'} transition-colors`}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EncodedStatusMonitor;
