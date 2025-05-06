import { useState, useEffect } from 'react';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { supabase } from '../lib/supabase';
import { RefreshCw, Download, Filter, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';

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

      // Build the query - more flexible approach
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
      
      // Try without status filter first to see if we get any data
      // If we need to filter by status later, we can add it back

      console.log('Querying all citizens to check data structure');

      // Apply date filters - simplified approach
      console.log('Date filters:', filters.startDate, filters.endDate);
      
      if (filters.startDate) {
        // Filter by start date on both fields
        query = query.or(`encoded_date.gte.${filters.startDate},created_at.gte.${filters.startDate}`);
      }
      
      if (filters.endDate) {
        // Filter by end date on both fields
        query = query.or(`encoded_date.lte.${filters.endDate},created_at.lte.${filters.endDate}`);
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

      const { data, error } = await query;

      if (error) throw error;

      console.log('Raw data from Supabase:', data);

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Encoded Status Monitor</h1>
          <p className="mt-1 text-gray-600">Daily encoding counts by staff per LGU</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-outline flex items-center space-x-2"
          >
            <Filter className="h-4 w-4 mr-2" />
            <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
            {showFilters ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={resetFilters}
            className="btn-outline flex items-center"
            title="Reset Filters"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Reset Filters
          </button>
          <button
            onClick={exportToCSV}
            className="btn-primary flex items-center"
            disabled={dailyStats.length === 0}
          >
            <Download className="h-5 w-5 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Province</label>
              <select
                value={filters.province}
                onChange={(e) => setFilters(prev => ({ ...prev, province: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-700">LGU</label>
              <select
                value={filters.lgu}
                onChange={(e) => setFilters(prev => ({ ...prev, lgu: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-700">Encoder Name</label>
              <input
                type="text"
                value={filters.staff}
                onChange={(e) => setFilters(prev => ({ ...prev, staff: e.target.value }))}
                placeholder="Filter by staff name"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="Encoded">Encoded</option>
                <option value="Verified">Verified</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Pending">Pending</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Liquidated">Liquidated</option>
                <option value="Disqualified">Disqualified</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Summary Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <h2 className="text-lg font-semibold">Summary</h2>
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="ml-2 p-1 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50"
            >
              {showSummary ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex items-center">
            <BarChart2 className="h-5 w-5 text-blue-600 mr-2" />
            <div className="text-sm text-gray-600">
              Total Records: <span className="font-semibold text-blue-600">{dailyStats.reduce((sum, stat) => sum + stat.count, 0)}</span>
            </div>
          </div>
        </div>
        
        {showSummary && (
          <>
            <div className="flex mb-4 space-x-2">
              <button
                onClick={() => setSummaryType('province')}
                className={`px-3 py-1 text-sm rounded-md ${summaryType === 'province' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                By Province
              </button>
              <button
                onClick={() => setSummaryType('lgu')}
                className={`px-3 py-1 text-sm rounded-md ${summaryType === 'lgu' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                By LGU
              </button>
              <button
                onClick={() => setSummaryType('staff')}
                className={`px-3 py-1 text-sm rounded-md ${summaryType === 'staff' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                By Staff
              </button>
              <button
                onClick={() => setSummaryType('status')}
                className={`px-3 py-1 text-sm rounded-md ${summaryType === 'status' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                By Status
              </button>
            </div>
            
            <div className="overflow-x-auto mt-2">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {summaryType === 'province' ? 'Province' : 
                       summaryType === 'lgu' ? 'LGU' : 
                       summaryType === 'staff' ? 'Staff' : 'Status'}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Count</th>
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
                    
                    return summaryArray.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 font-medium">
                          {item.count}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      
      {/* Main Table Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Daily Encoding Counts</h2>
          <div className="text-sm text-gray-600">
            Page Records: <span className="font-semibold text-blue-600">
              {Math.min(dailyStats.length, pagination.currentPage * pagination.recordsPerPage) - 
               Math.min(dailyStats.length, (pagination.currentPage - 1) * pagination.recordsPerPage)}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Province</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LGU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Encoder</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Records</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">Loading data...</p>
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
                  <tr key={index} className="hover:bg-gray-50">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stat.status || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 font-medium">
                      {stat.count}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">
                    <div className="text-center py-4">
                      <p className="text-gray-500 mb-2">No citizen data found for the selected filters</p>
                      <p className="text-sm text-gray-400">
                        This could be because:
                      </p>
                      <ul className="text-sm text-gray-400 list-disc list-inside mt-2">
                        <li>There are no citizens in the database for the selected filters</li>
                        <li>The encoded_date field might be empty or in a different format</li>
                        <li>The selected date range doesn't contain any records</li>
                        <li>The selected province/LGU doesn't have any records</li>
                      </ul>
                      <p className="text-sm text-blue-500 mt-4">
                        Try adjusting your filters or check the browser console for debugging information
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
                className="ml-2 block w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                disabled={pagination.currentPage === 1}
                className={`p-2 rounded-md ${pagination.currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <span className="text-sm text-gray-700">
                Page {pagination.currentPage} of {Math.ceil(dailyStats.length / pagination.recordsPerPage)}
              </span>
              
              <button
                onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                disabled={pagination.currentPage >= Math.ceil(dailyStats.length / pagination.recordsPerPage)}
                className={`p-2 rounded-md ${pagination.currentPage >= Math.ceil(dailyStats.length / pagination.recordsPerPage) ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EncodedStatusMonitor;
