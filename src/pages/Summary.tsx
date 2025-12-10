import { useState, useEffect, useCallback } from 'react';
import { Users, FileText, Upload, Download, RefreshCw, Loader2, CheckCircle, DollarSign, Clock, CheckSquare, AlertTriangle, XCircle, Pencil, AlertCircle, TrendingUp, BarChart3, Calendar, MapPin, PieChart as PieChartIcon } from 'lucide-react';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart
} from 'recharts';

interface Filters {
  startDate: string;
  endDate: string;
  province: string;
  lgu: string;
  barangay: string;
  calendarYear: string[];
}

interface AddressOption {
  code: string;
  name: string;
}

interface Stats {
  totalCitizens: number;
  provinces: number;
  lgus: number;
  barangays: number;
  paymentStats: {
    paid: number;
    unpaid: number;
    encoded: number;
    validated: number;
    cleanlisted: number;
    waitlisted: number;
    compliance: number;
    disqualified: number;
    total: number;
    paidAmount?: number;
    unpaidAmount?: number;
    encodedAmount?: number;
    validatedAmount?: number;
    cleanlistedAmount?: number;
    waitlistedAmount?: number;
    complianceAmount?: number;
    disqualifiedAmount?: number;
  };
  provinceStats: {
    name: string;
    paid: number;
    unpaid: number;
    encoded: number;
    validated: number;
    cleanlisted: number;
    waitlisted: number;
    compliance: number;
    disqualified: number;
    total: number;
  }[];
  paidBySpecificAge: {
    age: number;
    count: number;
    maleCount: number;
    femaleCount: number;
    malePercentage: number;
    femalePercentage: number;
    percentage: number;
    cashGift: number;
    totalAmount: number;
  }[];
}

interface ProvincialPaidByAgeStats {
  province_name: string;
  province_code: string;
  calendar_year: number;
  age_80: number;
  age_85: number;
  age_90: number;
  age_95: number;
  age_100: number;
  total_paid: number;
}

interface ProvincialPaidByMonthStats {
  province_name: string;
  province_code: string;
  calendar_year: number;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  total_paid: number;
}

function Summary() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [stats, setStats] = useState<Stats>({
    totalCitizens: 0,
    provinces: 0,
    lgus: 0,
    barangays: 0,
    paymentStats: {
      encoded: 0,
      validated: 0,
      cleanlisted: 0,
      paid: 0,
      unpaid: 0,
      compliance: 0,
      waitlisted: 0,
      disqualified: 0,
      total: 0
    },
    provinceStats: [],
    paidBySpecificAge: []
  });
  
  const [provinces, setProvinces] = useState<AddressOption[]>([]);
  const [lgus, setLgus] = useState<AddressOption[]>([]);
  const [barangays, setBarangays] = useState<AddressOption[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  
  const [filters, setFilters] = useState<Filters>({
    startDate: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    province: '',
    lgu: '',
    barangay: '',
    calendarYear: []
  });

  const [lguStats, setLguStats] = useState<{
    name: string;
    paid: number;
    unpaid: number;
    encoded: number;
    validated: number;
    cleanlisted: number;
    waitlisted: number;
    compliance: number;
    disqualified: number;
    total: number;
  }[]>([]);

  const [provincialPaidByAge, setProvincialPaidByAge] = useState<ProvincialPaidByAgeStats[]>([]);
  const [provincialPaidByMonth, setProvincialPaidByMonth] = useState<ProvincialPaidByMonthStats[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Prepare parameters for SQL functions
      const selectedYears = filters.calendarYear.length > 0 
        ? filters.calendarYear.map(y => parseInt(y))
        : [2024, 2025, 2026, 2027, 2028];

      const params = {
        p_start_date: filters.startDate ? startOfDay(parseISO(filters.startDate)).toISOString() : null,
        p_end_date: filters.endDate ? endOfDay(parseISO(filters.endDate)).toISOString() : null,
        p_province_code: filters.province || null,
        p_lgu_code: filters.lgu || null,
        p_barangay_code: filters.barangay || null,
        p_status_filter: null,
        p_payment_date_start: null,
        p_payment_date_end: null,
        p_age_start: null,
        p_age_end: null,
        p_calendar_years: selectedYears
      };

      // Call SQL functions in parallel
      const [
        basicStatsResult,
        paymentStatsResult,
        provinceStatsResult,
        countsResult
      ] = await Promise.all([
        supabase.rpc('get_dashboard_basic_stats', params),
        supabase.rpc('get_dashboard_payment_stats', params),
        supabase.rpc('get_dashboard_province_stats', params),
        Promise.all([
          supabase.from('provinces').select('*', { count: 'exact', head: true }),
          supabase.from('lgus').select('*', { count: 'exact', head: true }),
          supabase.from('barangays').select('*', { count: 'exact', head: true })
        ])
      ]);

      if (basicStatsResult.error) throw basicStatsResult.error;
      if (paymentStatsResult.error) throw paymentStatsResult.error;
      if (provinceStatsResult.error) throw provinceStatsResult.error;

      const basicStats = basicStatsResult.data;
      const paymentStats = paymentStatsResult.data;
      const provinceStats = provinceStatsResult.data || [];

      // Get LGU stats if province is selected
      let lguStatsData: any[] = [];
      if (filters.province) {
        const lguParams = {
          p_province_code: filters.province,
          p_start_date: params.p_start_date,
          p_end_date: params.p_end_date,
          p_lgu_code: params.p_lgu_code,
          p_barangay_code: params.p_barangay_code,
          p_status_filter: params.p_status_filter,
          p_payment_date_start: params.p_payment_date_start,
          p_payment_date_end: params.p_payment_date_end,
          p_calendar_years: selectedYears
        };
        const { data, error } = await supabase.rpc('get_dashboard_lgu_stats', lguParams);
        if (error) throw error;
        lguStatsData = data || [];
      }
      setLguStats(lguStatsData);

      const [
        { count: provincesCount },
        { count: lgusCount },
        { count: barangaysCount }
      ] = countsResult;

      // Fetch paid by specific age stats using backend function
      const { data: paidByAgeData, error: paidByAgeError } = await supabase.rpc('get_dashboard_paid_by_age', params);
      
      if (paidByAgeError) {
        console.error('Error fetching paid by age stats:', paidByAgeError);
      }

      const paidBySpecificAge = paidByAgeData || [];

      // Fetch provincial paid by age stats
      const provincialParams = {
        p_start_date: params.p_start_date,
        p_end_date: params.p_end_date,
        p_province_code: params.p_province_code,
        p_lgu_code: params.p_lgu_code,
        p_barangay_code: params.p_barangay_code,
        p_calendar_years: selectedYears
      };
      
      const { data: provincialPaidByAgeData, error: provincialPaidByAgeError } = await supabase.rpc('get_provincial_paid_by_age_stats', provincialParams);
      
      if (provincialPaidByAgeError) {
        console.error('Error fetching provincial paid by age stats:', provincialPaidByAgeError);
      }

      setProvincialPaidByAge(provincialPaidByAgeData || []);

      // Fetch provincial paid by month stats
      const { data: provincialPaidByMonthData, error: provincialPaidByMonthError } = await supabase.rpc('get_provincial_paid_by_month_stats', provincialParams);
      
      if (provincialPaidByMonthError) {
        console.error('Error fetching provincial paid by month stats:', provincialPaidByMonthError);
      }

      setProvincialPaidByMonth(provincialPaidByMonthData || []);

      setStats({
        totalCitizens: basicStats.totalCitizens || 0,
        provinces: provincesCount || 0,
        lgus: lgusCount || 0,
        barangays: barangaysCount || 0,
        paymentStats: paymentStats || {
          paid: 0,
          unpaid: 0,
          encoded: 0,
          validated: 0,
          cleanlisted: 0,
          waitlisted: 0,
          compliance: 0,
          disqualified: 0,
          total: 0
        },
        provinceStats: provinceStats,
        paidBySpecificAge
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError('Failed to load summary data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchProvinces();
    fetchAvailableYears();
  }, []);

  useEffect(() => {
    if (availableYears.length > 0 && filters.calendarYear.length === 0) {
      setFilters(prev => ({ ...prev, calendarYear: availableYears }));
    }
  }, [availableYears]);

  useEffect(() => {
    if (filters.calendarYear.length > 0) {
      fetchStats();
    }
  }, [fetchStats, filters.calendarYear]);

  useEffect(() => {
    if (filters.province) {
      fetchLGUs();
    }
  }, [filters.province]);

  useEffect(() => {
    if (filters.lgu) {
      fetchBarangays();
    }
  }, [filters.lgu]);

  const fetchAvailableYears = useCallback(async () => {
    try {
      // Use a SQL query to get distinct calendar years
      const { data, error } = await supabase.rpc('get_distinct_calendar_years');

      if (error) {
        console.error('Error from RPC:', error);
        // Try direct query as fallback
        const { data: directData, error: directError } = await supabase
          .from('citizens')
          .select('calendar_year')
          .not('calendar_year', 'is', null);

        if (directError) throw directError;
        
        // Extract unique years and sort them
        const uniqueYears = Array.from(
          new Set(directData?.map(item => {
            const year = item.calendar_year;
            return year ? year.toString() : null;
          }).filter(Boolean) || [])
        ).sort((a, b) => parseInt(a) - parseInt(b));
        
        setAvailableYears(uniqueYears);
        return;
      }
      
      // Process the results from RPC function
      const years = data?.map((item: any) => item.calendar_year?.toString()).filter(Boolean) || [];
      setAvailableYears(years.sort((a: string, b: string) => parseInt(a) - parseInt(b)));
    } catch (error) {
      console.error('Error fetching available years:', error);
      // Fallback to default years if fetch fails
      setAvailableYears(['2024', '2025', '2026', '2027', '2028']);
    }
  }, []);

  const fetchProvinces = useCallback(async () => {
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
  }, []);

  const fetchLGUs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('lgus')
        .select('code, name')
        .eq('province_code', filters.province)
        .order('name');

      if (error) throw error;
      setLgus(data || []);
      setFilters(prev => ({ ...prev, lgu: '', barangay: '' }));
    } catch (error) {
      console.error('Error fetching LGUs:', error);
    }
  }, [filters.province]);

  const fetchBarangays = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('barangays')
        .select('code, name')
        .eq('lgu_code', filters.lgu)
        .order('name');

      if (error) throw error;
      setBarangays(data || []);
      setFilters(prev => ({ ...prev, barangay: '' }));
    } catch (error) {
      console.error('Error fetching barangays:', error);
    }
  }, [filters.lgu]);

  const resetFilters = useCallback(() => {
    setFilters({
      startDate: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      province: '',
      lgu: '',
      barangay: '',
      calendarYear: availableYears
    });
    setError(null);
  }, [availableYears]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center z-50">
        <div className="text-center bg-white p-8 rounded-2xl shadow-2xl">
          <div className="relative">
            <Loader2 className="h-16 w-16 text-blue-600 animate-spin mx-auto mb-4" />
            <div className="absolute inset-0 h-16 w-16 mx-auto rounded-full bg-blue-100 opacity-20 animate-ping"></div>
          </div>
          <p className="text-base font-semibold text-gray-800 mb-2">Loading Summary Data</p>
          <p className="text-sm text-gray-600">Please wait while we gather your statistics...</p>
          <div className="mt-4 flex items-center justify-center space-x-1">
            <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-5 p-2 sm:p-0">
      {/* Enhanced Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-4 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2.5 rounded-lg backdrop-blur-sm">
              <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Summary Report</h1>
              <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
                Comprehensive statistical overview and analytics
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={resetFilters}
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 border border-white/20"
              title="Reset all filters to default"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Reset Filters</span>
              <span className="sm:hidden">Reset</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 mb-1">Error Loading Data</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
        <h2 className="text-sm font-semibold mb-2 sm:mb-3 flex items-center">
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs mr-2">Filters</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Province</label>
            <select
              value={filters.province}
              onChange={(e) => setFilters(prev => ({ ...prev, province: e.target.value }))}
              className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 sm:py-1.5 touch-manipulation"
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
            <label className="block text-xs font-medium text-gray-700 mb-1">LGU</label>
            <select
              value={filters.lgu}
              onChange={(e) => setFilters(prev => ({ ...prev, lgu: e.target.value }))}
              className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 sm:py-1.5 touch-manipulation disabled:opacity-50"
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Barangay</label>
            <select
              value={filters.barangay}
              onChange={(e) => setFilters(prev => ({ ...prev, barangay: e.target.value }))}
              className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 sm:py-1.5 touch-manipulation disabled:opacity-50"
              disabled={!filters.lgu}
            >
              <option value="">All Barangays</option>
              {barangays.map(barangay => (
                <option key={barangay.code} value={barangay.code}>
                  {barangay.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-2 sm:mt-3 sm:col-span-2 lg:col-span-3">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Calendar Year</label>
          <div className="flex flex-wrap gap-2">
            {availableYears.map(year => (
              <button
                key={year}
                onClick={() => {
                  setFilters(prev => {
                    const currentYears = prev.calendarYear;
                    if (currentYears.includes(year)) {
                      const newYears = currentYears.filter(y => y !== year);
                      return { ...prev, calendarYear: newYears };
                    } else {
                      return { ...prev, calendarYear: [...currentYears, year] };
                    }
                  });
                }}
                className={`px-3 py-2 sm:px-2.5 sm:py-1 rounded-md text-xs sm:text-xs font-medium transition-all duration-150 touch-manipulation active:scale-95 ${
                  filters.calendarYear.includes(year)
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard 
          title="Senior Citizens" 
          value={stats.totalCitizens.toLocaleString()} 
          icon={<Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />} 
          color="bg-blue-50" 
        />
        <StatCard 
          title="Provinces" 
          value={stats.provinces.toString()} 
          icon={<FileText className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />} 
          color="bg-teal-50" 
        />
        <StatCard 
          title="LGUs" 
          value={stats.lgus.toString()} 
          icon={<Upload className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />} 
          color="bg-orange-50" 
        />
        <StatCard 
          title="Barangays" 
          value={stats.barangays.toString()} 
          icon={<Download className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />} 
          color="bg-purple-50" 
        />
      </div>

      {/* Payment Statistics */}
      <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
        <h2 className="text-sm font-semibold mb-2 sm:mb-3 flex items-center">
          <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs mr-2">Payment Status</span>
        </h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-2">
          <div className="bg-violet-50 rounded-md p-2 sm:p-3 border border-violet-100">
            <div className="flex items-center mb-1">
              <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-violet-600 mr-1" />
              <div className="text-violet-700 text-[10px] sm:text-xs font-semibold">Encoded</div>
            </div>
            <div className="text-lg sm:text-xl font-bold text-violet-800">{stats.paymentStats.encoded.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-violet-600 truncate">₱{stats.paymentStats.encodedAmount?.toLocaleString()}</div>
          </div>
          
          <div className="bg-orange-50 rounded-md p-2 sm:p-3 border border-orange-100">
            <div className="flex items-center mb-1">
              <CheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-orange-600 mr-1" />
              <div className="text-orange-700 text-[10px] sm:text-xs font-semibold">Validated</div>
            </div>
            <div className="text-lg sm:text-xl font-bold text-orange-800">{stats.paymentStats.validated.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-orange-600 truncate">₱{stats.paymentStats.validatedAmount?.toLocaleString()}</div>
          </div>
          
          <div className="bg-green-50 rounded-md p-2 sm:p-3 border border-green-100">
            <div className="flex items-center mb-1">
              <DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-600 mr-1" />
              <div className="text-green-700 text-[10px] sm:text-xs font-semibold">Paid</div>
            </div>
            <div className="text-lg sm:text-xl font-bold text-green-800">{stats.paymentStats.paid.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-green-600 truncate">₱{stats.paymentStats.paidAmount?.toLocaleString()}</div>
          </div>
          
          <div className="bg-yellow-50 rounded-md p-2 sm:p-3 border border-yellow-100">
            <div className="flex items-center mb-1">
              <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-600 mr-1" />
              <div className="text-yellow-700 text-[10px] sm:text-xs font-semibold">Unpaid</div>
            </div>
            <div className="text-lg sm:text-xl font-bold text-yellow-800">{stats.paymentStats.unpaid.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-yellow-600 truncate">₱{stats.paymentStats.unpaidAmount?.toLocaleString()}</div>
          </div>
          
          <div className="bg-blue-50 rounded-md p-2 sm:p-3 border border-blue-100">
            <div className="flex items-center mb-1">
              <CheckSquare className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-600 mr-1" />
              <div className="text-blue-700 text-[10px] sm:text-xs font-semibold">Cleanlisted</div>
            </div>
            <div className="text-lg sm:text-xl font-bold text-blue-800">{stats.paymentStats.cleanlisted.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-blue-600 truncate">₱{stats.paymentStats.cleanlistedAmount?.toLocaleString()}</div>
          </div>
          
          <div className="bg-red-50 rounded-md p-2 sm:p-3 border border-red-100">
            <div className="flex items-center mb-1">
              <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-600 mr-1" />
              <div className="text-red-700 text-[10px] sm:text-xs font-semibold">Compliance</div>
            </div>
            <div className="text-lg sm:text-xl font-bold text-red-800">{stats.paymentStats.compliance.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-red-600 truncate">₱{stats.paymentStats.complianceAmount?.toLocaleString()}</div>
          </div>
          
          <div className="bg-rose-50 rounded-md p-2 sm:p-3 border border-rose-100">
            <div className="flex items-center mb-1">
              <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-rose-600 mr-1" />
              <div className="text-rose-700 text-[10px] sm:text-xs font-semibold">Disqualified</div>
            </div>
            <div className="text-lg sm:text-xl font-bold text-rose-800">{stats.paymentStats.disqualified.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-rose-600 truncate">₱{stats.paymentStats.disqualifiedAmount?.toLocaleString()}</div>
          </div>

          <div className="bg-gray-50 rounded-md p-2 sm:p-3 border border-gray-200">
            <div className="flex items-center mb-1">
              <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-600 mr-1" />
              <div className="text-gray-700 text-[10px] sm:text-xs font-semibold">Waitlisted</div>
            </div>
            <div className="text-lg sm:text-xl font-bold text-gray-800">{stats.paymentStats.waitlisted.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-gray-600 truncate">₱{stats.paymentStats.waitlistedAmount?.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Provincial Statistics */}
<div className="bg-white rounded-lg shadow-sm p-4">
  <h2 className="text-sm font-semibold mb-3 flex items-center">
    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs mr-2">Provincial Statistics</span>
  </h2>

  {/** ***** COMPUTE TOTALS ***** **/}
  {(() => {
    const totals = {
      encoded: stats.provinceStats.reduce((s, r) => s + r.encoded, 0),
      validated: stats.provinceStats.reduce((s, r) => s + r.validated, 0),
      paid: stats.provinceStats.reduce((s, r) => s + r.paid, 0),
      unpaid: stats.provinceStats.reduce((s, r) => s + r.unpaid, 0),
      cleanlisted: stats.provinceStats.reduce((s, r) => s + r.cleanlisted, 0),
      waitlisted: stats.provinceStats.reduce((s, r) => s + r.waitlisted, 0),
      compliance: stats.provinceStats.reduce((s, r) => s + r.compliance, 0),
      disqualified: stats.provinceStats.reduce((s, r) => s + r.disqualified, 0),
      total: stats.provinceStats.reduce((s, r) => s + r.total, 0),
    };

    return (
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Province</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Encoded</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Validated</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Paid</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Unpaid</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Cleanlisted</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Waitlisted</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Compliance</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Disqualified</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Total</th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-100">

            {/* BODY ROWS WITH PERCENTAGES */}
            {stats.provinceStats.map((province) => (
              <tr key={province.name} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                  {province.name}
                </td>

                {/* Encoded */}
                <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-violet-600">
                  {province.encoded.toLocaleString()}
                  <div className="text-[10px] text-gray-500">
                    ({((province.encoded / totals.encoded) * 100).toFixed(1)}%)
                  </div>
                </td>

                {/* Validated */}
                <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-orange-600">
                  {province.validated.toLocaleString()}
                  <div className="text-[10px] text-gray-500">
                    ({((province.validated / totals.validated) * 100).toFixed(1)}%)
                  </div>
                </td>

                {/* Paid */}
                <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-green-600 font-semibold">
                  {province.paid.toLocaleString()}
                  <div className="text-[10px] text-gray-500">
                    ({((province.paid / totals.paid) * 100).toFixed(1)}%)
                  </div>
                </td>

                {/* Unpaid */}
                <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-yellow-600 font-semibold">
                  {province.unpaid.toLocaleString()}
                  <div className="text-[10px] text-gray-500">
                    ({((province.unpaid / totals.unpaid) * 100).toFixed(1)}%)
                  </div>
                </td>

                {/* Cleanlisted */}
                <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-blue-600">
                  {province.cleanlisted.toLocaleString()}
                  <div className="text-[10px] text-gray-500">
                    ({((province.cleanlisted / totals.cleanlisted) * 100).toFixed(1)}%)
                  </div>
                </td>

                {/* Waitlisted */}
                <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-gray-600">
                  {province.waitlisted.toLocaleString()}
                  <div className="text-[10px] text-gray-500">
                    ({((province.waitlisted / totals.waitlisted) * 100).toFixed(1)}%)
                  </div>
                </td>

                {/* Compliance */}
                <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-red-600">
                  {province.compliance.toLocaleString()}
                  <div className="text-[10px] text-gray-500">
                    ({((province.compliance / totals.compliance) * 100).toFixed(1)}%)
                  </div>
                </td>

                {/* Disqualified */}
                <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-rose-600">
                  {province.disqualified.toLocaleString()}
                  <div className="text-[10px] text-gray-500">
                    ({((province.disqualified / totals.disqualified) * 100).toFixed(1)}%)
                  </div>
                </td>

                {/* Total */}
                <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-gray-900 font-semibold">
                  {province.total.toLocaleString()}
                  <div className="text-[10px] text-gray-500">
                    ({((province.total / totals.total) * 100).toFixed(1)}%)
                  </div>
                </td>
              </tr>
            ))}

            {/* FINAL TOTAL ROW WITH PERCENTAGES (OPTION B) */}
            <tr className="bg-gray-100 font-semibold">
              <td className="px-3 py-2 text-xs text-gray-900">TOTAL</td>

              <td className="px-3 py-2 text-xs text-center text-violet-700">
                {totals.encoded.toLocaleString()}
                <div className="text-[10px] text-gray-500">
                  ({(totals.total ? ((totals.encoded / totals.total) * 100).toFixed(1) : "0.0")}%)
                </div>
              </td>

              <td className="px-3 py-2 text-xs text-center text-orange-700">
                {totals.validated.toLocaleString()}
                <div className="text-[10px] text-gray-500">
                  ({(totals.total ? ((totals.validated / totals.total) * 100).toFixed(1) : "0.0")}%)
                </div>
              </td>

              <td className="px-3 py-2 text-xs text-center text-green-700">
                {totals.paid.toLocaleString()}
                <div className="text-[10px] text-gray-500">
                  ({(totals.total ? ((totals.paid / totals.total) * 100).toFixed(1) : "0.0")}%)
                </div>
              </td>

              <td className="px-3 py-2 text-xs text-center text-yellow-700">
                {totals.unpaid.toLocaleString()}
                <div className="text-[10px] text-gray-500">
                  ({(totals.total ? ((totals.unpaid / totals.total) * 100).toFixed(1) : "0.0")}%)
                </div>
              </td>

              <td className="px-3 py-2 text-xs text-center text-blue-700">
                {totals.cleanlisted.toLocaleString()}
                <div className="text-[10px] text-gray-500">
                  ({(totals.total ? ((totals.cleanlisted / totals.total) * 100).toFixed(1) : "0.0")}%)
                </div>
              </td>

              <td className="px-3 py-2 text-xs text-center text-gray-700">
                {totals.waitlisted.toLocaleString()}
                <div className="text-[10px] text-gray-500">
                  ({(totals.total ? ((totals.waitlisted / totals.total) * 100).toFixed(1) : "0.0")}%)
                </div>
              </td>

              <td className="px-3 py-2 text-xs text-center text-red-700">
                {totals.compliance.toLocaleString()}
                <div className="text-[10px] text-gray-500">
                  ({(totals.total ? ((totals.compliance / totals.total) * 100).toFixed(1) : "0.0")}%)
                </div>
              </td>

              <td className="px-3 py-2 text-xs text-center text-rose-700">
                {totals.disqualified.toLocaleString()}
                <div className="text-[10px] text-gray-500">
                  ({(totals.total ? ((totals.disqualified / totals.total) * 100).toFixed(1) : "0.0")}%)
                </div>
              </td>

              <td className="px-3 py-2 text-xs text-center text-gray-900 font-bold">
                {totals.total.toLocaleString()}
                <div className="text-[10px] text-gray-500">(100.0%)</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  })()}
</div>


      {/* LGU Statistics (if province selected) */}
      {filters.province && lguStats.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center">
            <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs mr-2">
              LGU Statistics - {provinces.find(p => p.code === filters.province)?.name}
            </span>
          </h2>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">LGU</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Encoded</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Validated</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Paid</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Unpaid</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Cleanlisted</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Waitlisted</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Compliance</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Disqualified</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {lguStats.map((lgu) => (
                  <tr 
                    key={lgu.name} 
                    className={`transition-colors ${
                      lgu.total === 0 
                        ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className={`px-3 py-2 whitespace-nowrap text-xs font-medium ${
                      lgu.total === 0 ? 'text-red-900' : 'text-gray-900'
                    }`}>
                      {lgu.name}
                      {lgu.total === 0 && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-200 text-red-800">
                          No Data
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-violet-600">
                      {lgu.encoded.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-orange-600">
                      {lgu.validated.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-green-600 font-semibold">
                      {lgu.paid.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-yellow-600 font-semibold">
                      {lgu.unpaid.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-blue-600">
                      {lgu.cleanlisted.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-gray-600">
                      {lgu.waitlisted.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-red-600">
                      {lgu.compliance.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-rose-600">
                      {lgu.disqualified.toLocaleString()}
                    </td>
                    <td className={`px-3 py-2 whitespace-nowrap text-xs text-center font-semibold ${
                      lgu.total === 0 ? 'text-red-900' : 'text-gray-900'
                    }`}>
                      {lgu.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Provincial Statistics - Paid by Month */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-semibold mb-2 flex items-center">
          <span className="bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded text-xs mr-2">Provincial Statistics - Paid by Month</span>
          <span className="ml-2 text-xs text-gray-500">({provincialPaidByMonth.length} records)</span>
        </h2>
        <p className="text-xs text-gray-600 mb-3">
          Paid citizens by province, calendar year, and month (Grouped by Calendar Year)
        </p>
        {provincialPaidByMonth.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <p>No data available for the selected filters.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Group by calendar year */}
            {Array.from(new Set(provincialPaidByMonth.map(r => r.calendar_year)))
              .sort((a, b) => a - b)
              .map((year, index) => {
                const yearData = provincialPaidByMonth.filter(r => r.calendar_year === year);
                // Different color gradients for each year
                const yearColors = [
                  'from-cyan-500 to-blue-500',
                  'from-purple-500 to-pink-500',
                  'from-green-500 to-teal-500',
                  'from-orange-500 to-red-500',
                  'from-indigo-500 to-purple-500',
                  'from-rose-500 to-pink-500',
                  'from-emerald-500 to-green-500',
                  'from-amber-500 to-orange-500',
                ];
                const subtotalColors = [
                  'bg-cyan-50 border-cyan-200',
                  'bg-purple-50 border-purple-200',
                  'bg-green-50 border-green-200',
                  'bg-orange-50 border-orange-200',
                  'bg-indigo-50 border-indigo-200',
                  'bg-rose-50 border-rose-200',
                  'bg-emerald-50 border-emerald-200',
                  'bg-amber-50 border-amber-200',
                ];
                const subtotalTextColors = [
                  'text-cyan-900 border-r-cyan-200',
                  'text-purple-900 border-r-purple-200',
                  'text-green-900 border-r-green-200',
                  'text-orange-900 border-r-orange-200',
                  'text-indigo-900 border-r-indigo-200',
                  'text-rose-900 border-r-rose-200',
                  'text-emerald-900 border-r-emerald-200',
                  'text-amber-900 border-r-amber-200',
                ];
                const colorIndex = index % yearColors.length;
                
                return (
                  <div key={year} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className={`bg-gradient-to-r ${yearColors[colorIndex]} px-4 py-2 text-white`}>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Calendar Year {year}
                        <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded">
                          {yearData.length} {yearData.length === 1 ? 'province' : 'provinces'}
                        </span>
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th rowSpan={2} className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase border-r border-gray-200">Province</th>
                            <th colSpan={12} className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase border-r border-gray-200">Paid by Month</th>
                            <th rowSpan={2} className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Total</th>
                          </tr>
                          <tr>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase">Jan</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase">Feb</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase">Mar</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase">Apr</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase">May</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase">Jun</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase">Jul</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase">Aug</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase">Sep</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase">Oct</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase">Nov</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase border-r border-gray-200">Dec</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {yearData.map((row) => (
                            <tr key={`${row.province_code}-${row.calendar_year}`} className="hover:bg-gray-50 transition-colors">
                              <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900 border-r border-gray-200">
                                {row.province_name}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-blue-600">
                                {row.jan}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-blue-600">
                                {row.feb}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-green-600">
                                {row.mar}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-green-600">
                                {row.apr}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-green-600">
                                {row.may}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-teal-600">
                                {row.jun}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-teal-600">
                                {row.jul}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-teal-600">
                                {row.aug}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-orange-600">
                                {row.sep}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-orange-600">
                                {row.oct}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-orange-600">
                                {row.nov}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-red-600 border-r border-gray-200">
                                {row.dec}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-gray-900 font-semibold">
                                {row.total_paid}
                              </td>
                            </tr>
                          ))}
                          {/* Year Subtotal */}
                          <tr className="bg-cyan-50 font-semibold border-t-2 border-cyan-200">
                            <td className="px-3 py-2 text-xs text-cyan-900 border-r border-cyan-200">
                              Year {year} Total
                            </td>
                            <td className="px-2 py-2 text-xs text-center text-blue-700">
                              {yearData.reduce((sum, r) => sum + r.jan, 0)}
                            </td>
                            <td className="px-2 py-2 text-xs text-center text-blue-700">
                              {yearData.reduce((sum, r) => sum + r.feb, 0)}
                            </td>
                            <td className="px-2 py-2 text-xs text-center text-green-700">
                              {yearData.reduce((sum, r) => sum + r.mar, 0)}
                            </td>
                            <td className="px-2 py-2 text-xs text-center text-green-700">
                              {yearData.reduce((sum, r) => sum + r.apr, 0)}
                            </td>
                            <td className="px-2 py-2 text-xs text-center text-green-700">
                              {yearData.reduce((sum, r) => sum + r.may, 0)}
                            </td>
                            <td className="px-2 py-2 text-xs text-center text-teal-700">
                              {yearData.reduce((sum, r) => sum + r.jun, 0)}
                            </td>
                            <td className="px-2 py-2 text-xs text-center text-teal-700">
                              {yearData.reduce((sum, r) => sum + r.jul, 0)}
                            </td>
                            <td className="px-2 py-2 text-xs text-center text-teal-700">
                              {yearData.reduce((sum, r) => sum + r.aug, 0)}
                            </td>
                            <td className="px-2 py-2 text-xs text-center text-orange-700">
                              {yearData.reduce((sum, r) => sum + r.sep, 0)}
                            </td>
                            <td className="px-2 py-2 text-xs text-center text-orange-700">
                              {yearData.reduce((sum, r) => sum + r.oct, 0)}
                            </td>
                            <td className="px-2 py-2 text-xs text-center text-orange-700">
                              {yearData.reduce((sum, r) => sum + r.nov, 0)}
                            </td>
                            <td className="px-2 py-2 text-xs text-center text-red-700 border-r border-cyan-200">
                              {yearData.reduce((sum, r) => sum + r.dec, 0)}
                            </td>
                            <td className="px-3 py-2 text-xs text-center text-cyan-900 font-bold">
                              {yearData.reduce((sum, r) => sum + r.total_paid, 0)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            
            {/* Grand Total Section */}
            <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50">
              <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-4 py-2 text-white">
                <h3 className="text-sm font-bold">Grand Total (All Years)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <tbody>
                    <tr className="bg-gray-100 font-bold">
                      <td className="px-3 py-3 text-xs text-gray-900 border-r border-gray-300">
                        ALL YEARS TOTAL
                      </td>
                      <td className="px-2 py-3 text-xs text-center text-blue-800">
                        {provincialPaidByMonth.reduce((sum, r) => sum + r.jan, 0)}
                      </td>
                      <td className="px-2 py-3 text-xs text-center text-blue-800">
                        {provincialPaidByMonth.reduce((sum, r) => sum + r.feb, 0)}
                      </td>
                      <td className="px-2 py-3 text-xs text-center text-green-800">
                        {provincialPaidByMonth.reduce((sum, r) => sum + r.mar, 0)}
                      </td>
                      <td className="px-2 py-3 text-xs text-center text-green-800">
                        {provincialPaidByMonth.reduce((sum, r) => sum + r.apr, 0)}
                      </td>
                      <td className="px-2 py-3 text-xs text-center text-green-800">
                        {provincialPaidByMonth.reduce((sum, r) => sum + r.may, 0)}
                      </td>
                      <td className="px-2 py-3 text-xs text-center text-teal-800">
                        {provincialPaidByMonth.reduce((sum, r) => sum + r.jun, 0)}
                      </td>
                      <td className="px-2 py-3 text-xs text-center text-teal-800">
                        {provincialPaidByMonth.reduce((sum, r) => sum + r.jul, 0)}
                      </td>
                      <td className="px-2 py-3 text-xs text-center text-teal-800">
                        {provincialPaidByMonth.reduce((sum, r) => sum + r.aug, 0)}
                      </td>
                      <td className="px-2 py-3 text-xs text-center text-orange-800">
                        {provincialPaidByMonth.reduce((sum, r) => sum + r.sep, 0)}
                      </td>
                      <td className="px-2 py-3 text-xs text-center text-orange-800">
                        {provincialPaidByMonth.reduce((sum, r) => sum + r.oct, 0)}
                      </td>
                      <td className="px-2 py-3 text-xs text-center text-orange-800">
                        {provincialPaidByMonth.reduce((sum, r) => sum + r.nov, 0)}
                      </td>
                      <td className="px-2 py-3 text-xs text-center text-red-800 border-r border-gray-300">
                        {provincialPaidByMonth.reduce((sum, r) => sum + r.dec, 0)}
                      </td>
                      <td className="px-3 py-3 text-xs text-center text-gray-900 font-bold text-base">
                        {provincialPaidByMonth.reduce((sum, r) => sum + r.total_paid, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Provincial Statistics - Paid by Age */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-semibold mb-2 flex items-center">
          <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded text-xs mr-2">Provincial Statistics - Paid by Age</span>
          <span className="ml-2 text-xs text-gray-500">({provincialPaidByAge.length} records)</span>
        </h2>
        <p className="text-xs text-gray-600 mb-3">
          Paid citizens aged 80, 85, 90, 95, and 100 by province and calendar year (Grouped by Calendar Year)
        </p>
        {provincialPaidByAge.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <p>No data available for the selected filters.</p>
            <p className="text-xs mt-2">This could mean:</p>
            <ul className="text-xs mt-1 space-y-1">
              <li>• No paid citizens aged 80, 85, 90, 95, or 100 for the selected calendar years</li>
              <li>• The database function may not be returning data correctly</li>
              <li>• Check the browser console for errors</li>
            </ul>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Group by calendar year */}
            {Array.from(new Set(provincialPaidByAge.map(r => r.calendar_year)))
              .sort((a, b) => a - b)
              .map((year, index) => {
                const yearData = provincialPaidByAge.filter(r => r.calendar_year === year);
                // Different color gradients for each year
                const yearColors = [
                  'from-teal-500 to-green-500',
                  'from-violet-500 to-purple-500',
                  'from-sky-500 to-blue-500',
                  'from-rose-500 to-red-500',
                  'from-fuchsia-500 to-pink-500',
                  'from-lime-500 to-green-500',
                  'from-amber-500 to-yellow-500',
                  'from-cyan-500 to-teal-500',
                ];
                const subtotalColors = [
                  'bg-teal-50 border-teal-200',
                  'bg-violet-50 border-violet-200',
                  'bg-sky-50 border-sky-200',
                  'bg-rose-50 border-rose-200',
                  'bg-fuchsia-50 border-fuchsia-200',
                  'bg-lime-50 border-lime-200',
                  'bg-amber-50 border-amber-200',
                  'bg-cyan-50 border-cyan-200',
                ];
                const subtotalTextColors = [
                  'text-teal-900 border-r-teal-200',
                  'text-violet-900 border-r-violet-200',
                  'text-sky-900 border-r-sky-200',
                  'text-rose-900 border-r-rose-200',
                  'text-fuchsia-900 border-r-fuchsia-200',
                  'text-lime-900 border-r-lime-200',
                  'text-amber-900 border-r-amber-200',
                  'text-cyan-900 border-r-cyan-200',
                ];
                const colorIndex = index % yearColors.length;
                
                return (
                  <div key={year} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className={`bg-gradient-to-r ${yearColors[colorIndex]} px-4 py-2 text-white`}>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Calendar Year {year}
                        <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded">
                          {yearData.length} {yearData.length === 1 ? 'province' : 'provinces'}
                        </span>
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th rowSpan={2} className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase border-r border-gray-200">Province</th>
                            <th colSpan={5} className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase border-r border-gray-200">Paid by Age</th>
                            <th rowSpan={2} className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Total</th>
                          </tr>
                          <tr>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">80</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">85</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">90</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">95</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase border-r border-gray-200">100</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {yearData.map((row) => (
                            <tr key={`${row.province_code}-${row.calendar_year}`} className="hover:bg-gray-50 transition-colors">
                              <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900 border-r border-gray-200">
                                {row.province_name}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-blue-600">
                                {row.age_80}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-green-600">
                                {row.age_85}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-purple-600">
                                {row.age_90}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-orange-600">
                                {row.age_95}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-red-600 border-r border-gray-200">
                                {row.age_100}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-gray-900 font-semibold">
                                {row.total_paid}
                              </td>
                            </tr>
                          ))}
                          {/* Year Subtotal */}
                          <tr className="bg-teal-50 font-semibold border-t-2 border-teal-200">
                            <td className="px-3 py-2 text-xs text-teal-900 border-r border-teal-200">
                              Year {year} Total
                            </td>
                            <td className="px-3 py-2 text-xs text-center text-blue-700">
                              {yearData.reduce((sum, r) => sum + r.age_80, 0)}
                            </td>
                            <td className="px-3 py-2 text-xs text-center text-green-700">
                              {yearData.reduce((sum, r) => sum + r.age_85, 0)}
                            </td>
                            <td className="px-3 py-2 text-xs text-center text-purple-700">
                              {yearData.reduce((sum, r) => sum + r.age_90, 0)}
                            </td>
                            <td className="px-3 py-2 text-xs text-center text-orange-700">
                              {yearData.reduce((sum, r) => sum + r.age_95, 0)}
                            </td>
                            <td className="px-3 py-2 text-xs text-center text-red-700 border-r border-teal-200">
                              {yearData.reduce((sum, r) => sum + r.age_100, 0)}
                            </td>
                            <td className="px-3 py-2 text-xs text-center text-teal-900 font-bold">
                              {yearData.reduce((sum, r) => sum + r.total_paid, 0)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            
            {/* Grand Total Section */}
            <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50">
              <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-4 py-2 text-white">
                <h3 className="text-sm font-bold">Grand Total (All Years)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <tbody>
                    <tr className="bg-gray-100 font-bold">
                      <td className="px-3 py-3 text-xs text-gray-900 border-r border-gray-300">
                        ALL YEARS TOTAL
                      </td>
                      <td className="px-3 py-3 text-xs text-center text-blue-800">
                        {provincialPaidByAge.reduce((sum, r) => sum + r.age_80, 0)}
                      </td>
                      <td className="px-3 py-3 text-xs text-center text-green-800">
                        {provincialPaidByAge.reduce((sum, r) => sum + r.age_85, 0)}
                      </td>
                      <td className="px-3 py-3 text-xs text-center text-purple-800">
                        {provincialPaidByAge.reduce((sum, r) => sum + r.age_90, 0)}
                      </td>
                      <td className="px-3 py-3 text-xs text-center text-orange-800">
                        {provincialPaidByAge.reduce((sum, r) => sum + r.age_95, 0)}
                      </td>
                      <td className="px-3 py-3 text-xs text-center text-red-800 border-r border-gray-300">
                        {provincialPaidByAge.reduce((sum, r) => sum + r.age_100, 0)}
                      </td>
                      <td className="px-3 py-3 text-xs text-center text-gray-900 font-bold text-base">
                        {provincialPaidByAge.reduce((sum, r) => sum + r.total_paid, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* NEW: Quarterly Paid Data Charts */}
      {provincialPaidByMonth.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-sm font-semibold mb-2 flex items-center">
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs mr-2">
              <BarChart3 className="h-3 w-3 inline mr-1" />
              Quarterly Paid Analysis
            </span>
          </h2>
          <p className="text-xs text-gray-600 mb-4">
            Visual representation of paid citizens by quarter (Q1-Q4) across calendar years
          </p>

          {/* Quarterly Data by Year Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {Array.from(new Set(provincialPaidByMonth.map(r => r.calendar_year)))
              .sort((a, b) => a - b)
              .map((year) => {
                const yearData = provincialPaidByMonth.filter(r => r.calendar_year === year);
                
                // Calculate quarterly totals
                const quarterlyData = yearData.map(row => ({
                  province: row.province_name,
                  Q1: row.jan + row.feb + row.mar,
                  Q2: row.apr + row.may + row.jun,
                  Q3: row.jul + row.aug + row.sep,
                  Q4: row.oct + row.nov + row.dec,
                }));

                return (
                  <div key={year} className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-emerald-50 to-teal-50">
                    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-emerald-600" />
                      Calendar Year {year} - Quarterly Distribution
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={quarterlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                          dataKey="province" 
                          angle={-45} 
                          textAnchor="end" 
                          height={100}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ fontSize: '12px', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="Q1" fill="#3b82f6" name="Q1 (Jan-Mar)" />
                        <Bar dataKey="Q2" fill="#10b981" name="Q2 (Apr-Jun)" />
                        <Bar dataKey="Q3" fill="#f59e0b" name="Q3 (Jul-Sep)" />
                        <Bar dataKey="Q4" fill="#ef4444" name="Q4 (Oct-Dec)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
          </div>

          {/* Overall Quarterly Trends */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Overall Quarterly Trends (All Years Combined)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={
                Array.from(new Set(provincialPaidByMonth.map(r => r.calendar_year)))
                  .sort((a, b) => a - b)
                  .map(year => {
                    const yearData = provincialPaidByMonth.filter(r => r.calendar_year === year);
                    return {
                      year: year.toString(),
                      Q1: yearData.reduce((sum, r) => sum + r.jan + r.feb + r.mar, 0),
                      Q2: yearData.reduce((sum, r) => sum + r.apr + r.may + r.jun, 0),
                      Q3: yearData.reduce((sum, r) => sum + r.jul + r.aug + r.sep, 0),
                      Q4: yearData.reduce((sum, r) => sum + r.oct + r.nov + r.dec, 0),
                    };
                  })
              }>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: '12px', backgroundColor: 'rgba(255, 255, 255, 0.95)' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="Q1" stroke="#3b82f6" strokeWidth={2} name="Q1 (Jan-Mar)" />
                <Line type="monotone" dataKey="Q2" stroke="#10b981" strokeWidth={2} name="Q2 (Apr-Jun)" />
                <Line type="monotone" dataKey="Q3" stroke="#f59e0b" strokeWidth={2} name="Q3 (Jul-Sep)" />
                <Line type="monotone" dataKey="Q4" stroke="#ef4444" strokeWidth={2} name="Q4 (Oct-Dec)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* NEW: Sex-Disaggregated Data Charts */}
      {stats.paidBySpecificAge.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-sm font-semibold mb-2 flex items-center">
            <span className="bg-fuchsia-100 text-fuchsia-800 px-2 py-0.5 rounded text-xs mr-2">
              <PieChartIcon className="h-3 w-3 inline mr-1" />
              Sex-Disaggregated Data Analysis
            </span>
          </h2>
          <p className="text-xs text-gray-600 mb-4">
            Gender distribution analysis for paid citizens by age group
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Male vs Female by Age - Bar Chart */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-fuchsia-50 to-pink-50">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Gender Distribution by Age Group</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.paidBySpecificAge.map(item => ({
                  age: `Age ${item.age}`,
                  Male: item.maleCount,
                  Female: item.femaleCount,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="age" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: '12px', backgroundColor: 'rgba(255, 255, 255, 0.95)' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Male" fill="#3b82f6" name="Male" />
                  <Bar dataKey="Female" fill="#ec4899" name="Female" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Overall Gender Distribution - Pie Chart */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-blue-50 to-cyan-50">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Overall Gender Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { 
                        name: 'Male', 
                        value: stats.paidBySpecificAge.reduce((sum, item) => sum + item.maleCount, 0),
                        percentage: (() => {
                          const total = stats.paidBySpecificAge.reduce((sum, item) => sum + item.count, 0);
                          const male = stats.paidBySpecificAge.reduce((sum, item) => sum + item.maleCount, 0);
                          return total > 0 ? ((male / total) * 100).toFixed(1) : 0;
                        })()
                      },
                      { 
                        name: 'Female', 
                        value: stats.paidBySpecificAge.reduce((sum, item) => sum + item.femaleCount, 0),
                        percentage: (() => {
                          const total = stats.paidBySpecificAge.reduce((sum, item) => sum + item.count, 0);
                          const female = stats.paidBySpecificAge.reduce((sum, item) => sum + item.femaleCount, 0);
                          return total > 0 ? ((female / total) * 100).toFixed(1) : 0;
                        })()
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#ec4899" />
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => value.toLocaleString()}
                    contentStyle={{ fontSize: '12px', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Gender Percentage by Age - Stacked Bar */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-violet-50 to-purple-50">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Gender Percentage by Age (100% Stacked)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart 
                  data={stats.paidBySpecificAge.map(item => ({
                    age: `Age ${item.age}`,
                    MalePercent: item.malePercentage,
                    FemalePercent: item.femalePercentage,
                  }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="age" type="category" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip 
                    formatter={(value: any) => `${value.toFixed(1)}%`}
                    contentStyle={{ fontSize: '12px', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="MalePercent" stackId="a" fill="#3b82f6" name="Male %" />
                  <Bar dataKey="FemalePercent" stackId="a" fill="#ec4899" name="Female %" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gender Comparison Line Chart */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-amber-50 to-orange-50">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Gender Count Trend by Age</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={stats.paidBySpecificAge.map(item => ({
                  age: item.age,
                  Male: item.maleCount,
                  Female: item.femaleCount,
                  Total: item.count,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="age" tick={{ fontSize: 10 }} label={{ value: 'Age', position: 'insideBottom', offset: -5, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: '12px', backgroundColor: 'rgba(255, 255, 255, 0.95)' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Total" fill="#9ca3af" name="Total" opacity={0.3} />
                  <Line type="monotone" dataKey="Male" stroke="#3b82f6" strokeWidth={2} name="Male" />
                  <Line type="monotone" dataKey="Female" stroke="#ec4899" strokeWidth={2} name="Female" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Paid Citizens by Specific Ages */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-semibold mb-2 flex items-center">
          <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs mr-2">Paid Citizens by Specific Ages</span>
        </h2>
        <p className="text-xs text-gray-600 mb-2">
          Analysis of citizens with "Paid" status at specific ages: 80, 85, 90, 95, and 100 years old
        </p>
        <p className="text-xs text-blue-600 font-medium mb-3">
          {filters.calendarYear.length > 0 
            ? `Using Calendar Years: ${filters.calendarYear.join(', ')} for age calculations`
            : `Using Calendar Year: ${new Date().getFullYear()} for age calculations`
          }
        </p>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Exact Age</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Total Count</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Male</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Female</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Percentage</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Cash Gift (PHP)</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Total Amount (PHP)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {stats.paidBySpecificAge.map((ageGroup) => (
                <tr key={ageGroup.age} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                    {ageGroup.age} years old
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-green-600 font-semibold">
                    {ageGroup.count}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-blue-600 font-medium">
                    {ageGroup.maleCount} ({ageGroup.malePercentage.toFixed(1)}%)
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-pink-600 font-medium">
                    {ageGroup.femaleCount} ({ageGroup.femalePercentage.toFixed(1)}%)
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-gray-900">
                    {ageGroup.percentage.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-blue-600 font-medium">
                    {ageGroup.cashGift.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-indigo-600 font-medium">
                    {ageGroup.totalAmount.toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-gray-900">
                  Total
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-green-600 font-semibold">
                  {stats.paidBySpecificAge.reduce((sum, item) => sum + item.count, 0)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-blue-600 font-medium">
                  {(() => {
                    const totalMale = stats.paidBySpecificAge.reduce((sum, item) => sum + item.maleCount, 0);
                    const totalCount = stats.paidBySpecificAge.reduce((sum, item) => sum + item.count, 0);
                    const percentage = totalCount > 0 ? (totalMale / totalCount) * 100 : 0;
                    return `${totalMale} (${percentage.toFixed(1)}%)`;
                  })()}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-pink-600 font-medium">
                  {(() => {
                    const totalFemale = stats.paidBySpecificAge.reduce((sum, item) => sum + item.femaleCount, 0);
                    const totalCount = stats.paidBySpecificAge.reduce((sum, item) => sum + item.count, 0);
                    const percentage = totalCount > 0 ? (totalFemale / totalCount) * 100 : 0;
                    return `${totalFemale} (${percentage.toFixed(1)}%)`;
                  })()}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-gray-900 font-semibold">
                  100%
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-blue-600 font-medium">
                  -
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-indigo-600 font-semibold">
                  {stats.paidBySpecificAge.reduce((sum, item) => sum + item.totalAmount, 0).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className={`${color} p-2 sm:p-3 rounded-lg shadow-sm border border-opacity-20 transition-all duration-200 hover:shadow-md active:scale-95 sm:hover:scale-[1.02]`}>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[10px] sm:text-xs font-medium text-gray-700 truncate">{title}</h3>
          <p className="text-base sm:text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default Summary;
