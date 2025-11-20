import { useState, useEffect, useCallback } from 'react';
import { Users, FileText, Upload, Download, RefreshCw, Loader2, CheckCircle, DollarSign, Clock, CheckSquare, AlertTriangle, XCircle, Pencil, AlertCircle } from 'lucide-react';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';

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
    provinceStats: []
  });
  
  const [provinces, setProvinces] = useState<AddressOption[]>([]);
  const [lgus, setLgus] = useState<AddressOption[]>([]);
  const [barangays, setBarangays] = useState<AddressOption[]>([]);
  
  const [filters, setFilters] = useState<Filters>({
    startDate: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    province: '',
    lgu: '',
    barangay: '',
    calendarYear: ['2024', '2025', '2026', '2027', '2028']
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
        provinceStats: provinceStats
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
    fetchStats();
  }, [fetchStats]);

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
      calendarYear: ['2024', '2025', '2026', '2027', '2028']
    });
    setError(null);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center z-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Loading Summary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Summary Report</h1>
          <p className="text-xs text-gray-600">Aggregated statistics overview</p>
        </div>
        
        <button
          onClick={resetFilters}
          className="btn-outline flex items-center text-xs px-3 py-1.5 self-start sm:self-auto"
          title="Reset Filters"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Reset Filters
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center">
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs mr-2">Filters</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Province</label>
            <select
              value={filters.province}
              onChange={(e) => setFilters(prev => ({ ...prev, province: e.target.value }))}
              className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5"
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
              className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5"
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
              className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5"
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

        <div className="mt-3 sm:col-span-2 lg:col-span-3">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Calendar Year</label>
          <div className="flex flex-wrap gap-1.5">
            {['2024', '2025', '2026', '2027', '2028'].map(year => (
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
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard 
          title="Senior Citizens" 
          value={stats.totalCitizens.toLocaleString()} 
          icon={<Users className="h-6 w-6 text-blue-600" />} 
          color="bg-blue-50" 
        />
        <StatCard 
          title="Provinces" 
          value={stats.provinces.toString()} 
          icon={<FileText className="h-6 w-6 text-teal-600" />} 
          color="bg-teal-50" 
        />
        <StatCard 
          title="LGUs" 
          value={stats.lgus.toString()} 
          icon={<Upload className="h-6 w-6 text-orange-600" />} 
          color="bg-orange-50" 
        />
        <StatCard 
          title="Barangays" 
          value={stats.barangays.toString()} 
          icon={<Download className="h-6 w-6 text-purple-600" />} 
          color="bg-purple-50" 
        />
      </div>

      {/* Payment Statistics */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center">
          <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs mr-2">Payment Status</span>
        </h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <div className="bg-violet-50 rounded-md p-3 border border-violet-100">
            <div className="flex items-center mb-1">
              <Pencil className="h-3.5 w-3.5 text-violet-600 mr-1" />
              <div className="text-violet-700 text-xs font-semibold">Encoded</div>
            </div>
            <div className="text-xl font-bold text-violet-800">{stats.paymentStats.encoded.toLocaleString()}</div>
            <div className="text-xs text-violet-600 truncate">₱{stats.paymentStats.encodedAmount?.toLocaleString()}</div>
          </div>
          
          <div className="bg-orange-50 rounded-md p-3 border border-orange-100">
            <div className="flex items-center mb-1">
              <CheckCircle className="h-3.5 w-3.5 text-orange-600 mr-1" />
              <div className="text-orange-700 text-xs font-semibold">Validated</div>
            </div>
            <div className="text-xl font-bold text-orange-800">{stats.paymentStats.validated.toLocaleString()}</div>
            <div className="text-xs text-orange-600 truncate">₱{stats.paymentStats.validatedAmount?.toLocaleString()}</div>
          </div>
          
          <div className="bg-green-50 rounded-md p-3 border border-green-100">
            <div className="flex items-center mb-1">
              <DollarSign className="h-3.5 w-3.5 text-green-600 mr-1" />
              <div className="text-green-700 text-xs font-semibold">Paid</div>
            </div>
            <div className="text-xl font-bold text-green-800">{stats.paymentStats.paid.toLocaleString()}</div>
            <div className="text-xs text-green-600 truncate">₱{stats.paymentStats.paidAmount?.toLocaleString()}</div>
          </div>
          
          <div className="bg-yellow-50 rounded-md p-3 border border-yellow-100">
            <div className="flex items-center mb-1">
              <AlertCircle className="h-3.5 w-3.5 text-yellow-600 mr-1" />
              <div className="text-yellow-700 text-xs font-semibold">Unpaid</div>
            </div>
            <div className="text-xl font-bold text-yellow-800">{stats.paymentStats.unpaid.toLocaleString()}</div>
            <div className="text-xs text-yellow-600 truncate">₱{stats.paymentStats.unpaidAmount?.toLocaleString()}</div>
          </div>
          
          <div className="bg-blue-50 rounded-md p-3 border border-blue-100">
            <div className="flex items-center mb-1">
              <CheckSquare className="h-3.5 w-3.5 text-blue-600 mr-1" />
              <div className="text-blue-700 text-xs font-semibold">Cleanlisted</div>
            </div>
            <div className="text-xl font-bold text-blue-800">{stats.paymentStats.cleanlisted.toLocaleString()}</div>
            <div className="text-xs text-blue-600 truncate">₱{stats.paymentStats.cleanlistedAmount?.toLocaleString()}</div>
          </div>
          
          <div className="bg-red-50 rounded-md p-3 border border-red-100">
            <div className="flex items-center mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mr-1" />
              <div className="text-red-700 text-xs font-semibold">Compliance</div>
            </div>
            <div className="text-xl font-bold text-red-800">{stats.paymentStats.compliance.toLocaleString()}</div>
            <div className="text-xs text-red-600 truncate">₱{stats.paymentStats.complianceAmount?.toLocaleString()}</div>
          </div>
          
          <div className="bg-rose-50 rounded-md p-3 border border-rose-100">
            <div className="flex items-center mb-1">
              <XCircle className="h-3.5 w-3.5 text-rose-600 mr-1" />
              <div className="text-rose-700 text-xs font-semibold">Disqualified</div>
            </div>
            <div className="text-xl font-bold text-rose-800">{stats.paymentStats.disqualified.toLocaleString()}</div>
            <div className="text-xs text-rose-600 truncate">₱{stats.paymentStats.disqualifiedAmount?.toLocaleString()}</div>
          </div>

          <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
            <div className="flex items-center mb-1">
              <Clock className="h-3.5 w-3.5 text-gray-600 mr-1" />
              <div className="text-gray-700 text-xs font-semibold">Waitlisted</div>
            </div>
            <div className="text-xl font-bold text-gray-800">{stats.paymentStats.waitlisted.toLocaleString()}</div>
            <div className="text-xs text-gray-600 truncate">₱{stats.paymentStats.waitlistedAmount?.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Provincial Statistics */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center">
          <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs mr-2">Provincial Statistics</span>
        </h2>
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
              {stats.provinceStats.map((province) => (
                <tr key={province.name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                    {province.name}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-violet-600">
                    {province.encoded.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-orange-600">
                    {province.validated.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-green-600 font-semibold">
                    {province.paid.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-yellow-600 font-semibold">
                    {province.unpaid.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-blue-600">
                    {province.cleanlisted.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-gray-600">
                    {province.waitlisted.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-red-600">
                    {province.compliance.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-rose-600">
                    {province.disqualified.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-center text-gray-900 font-semibold">
                    {province.total.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">Encoded</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">Validated</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">Paid</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">Unpaid</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">Cleanlisted</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">Waitlisted</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">Compliance</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">Disqualified</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {lguStats.map((lgu) => (
                  <tr key={lgu.name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                      {lgu.name}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-violet-600">
                      {lgu.encoded.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-orange-600">
                      {lgu.validated.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-green-600 font-semibold">
                      {lgu.paid.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-yellow-600 font-semibold">
                      {lgu.unpaid.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-blue-600">
                      {lgu.cleanlisted.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-gray-600">
                      {lgu.waitlisted.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-red-600">
                      {lgu.compliance.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-rose-600">
                      {lgu.disqualified.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-gray-900 font-semibold">
                      {lgu.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
    <div className={`${color} p-3 rounded-lg shadow-sm border border-opacity-20 transition-all duration-200 hover:shadow-md hover:scale-[1.02]`}>
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-medium text-gray-700 truncate">{title}</h3>
          <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default Summary;
