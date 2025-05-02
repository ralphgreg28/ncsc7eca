import { useState, useEffect, useMemo } from 'react';
import { Users, FileText, Upload, Download, RefreshCw, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';

interface Filters {
  startDate: string;
  endDate: string;
  birthDateStart: string;
  birthDateEnd: string;
  province: string;
  lgu: string;
  barangay: string;
  status: string[];
  paymentDateStart: string;
  paymentDateEnd: string;
  ageStart: string;
  ageEnd: string;
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
  byStatus: {
    status: string;
    count: number;
  }[];
  bySex: {
    sex: string;
    count: number;
  }[];
  byAge: {
    range: string;
    count: number;
  }[];
  byQuarter: {
    quarter: string;
    count: number;
  }[];
  paymentStats: {
    paid: number;
    unpaid: number;
    encoded: number;
    validated: number;
    cleanlisted: number;
    liquidated: number;
    disqualified: number;
    total: number;
  };
  provinceStats: {
    name: string;
    paid: number;
    unpaid: number;
    encoded: number;
    validated: number;
    cleanlisted: number;
    liquidated: number;
    disqualified: number;
    total: number;
  }[];
}

const COLORS = {
  Encoded: '#87CEEB',
  Validated: '#28A745',
  Cleanlisted: '#008080',
  Paid: '#006400',
  Unpaid: '#FFA500',
  Liquidated: '#DC3545',
  Disqualified: '#808080',
  Male: '#3B82F6',
  Female: '#EC4899'
};

const AGE_RANGES = [
  { min: 60, max: 79, label: '60-79' },
  { min: 80, max: 84, label: '80-84' },
  { min: 85, max: 89, label: '85-89' },
  { min: 90, max: 94, label: '90-94' },
  { min: 95, max: 99, label: '95-99' },
  { min: 100, max: Infinity, label: '100+' }
];

function Dashboard() {
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalCitizens: 0,
    provinces: 0,
    lgus: 0,
    barangays: 0,
    byStatus: [],
    bySex: [],
    byAge: [],
    byQuarter: [],
    paymentStats: {
      encoded: 0,
      validated: 0,
      cleanlisted: 0,
      paid: 0,
      unpaid: 0,
      liquified: 0,
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
    birthDateStart: '',
    birthDateEnd: '',
    province: '',
    lgu: '',
    barangay: '',
    status: [],
    paymentDateStart: '',
    paymentDateEnd: '',
    ageStart: '',
    ageEnd: ''
  });

  const [lguStats, setLguStats] = useState<{
    name: string;
    paid: number;
    unpaid: number;
    encoded: number;
    validated: number;
    cleanlisted: number;
    liquidated: number;
    disqualified: number;
    total: number;
  }[]>([]);

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
    fetchProvinces();
    fetchStats();
  }, []);

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

  useEffect(() => {
    fetchStats();
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
      setFilters(prev => ({ ...prev, lgu: '', barangay: '' }));
    } catch (error) {
      console.error('Error fetching LGUs:', error);
    }
  };

  const fetchBarangays = async () => {
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
  };

  const resetFilters = () => {
    setFilters({
      startDate: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      birthDateStart: '',
      birthDateEnd: '',
      province: '',
      lgu: '',
      barangay: '',
      status: [],
      paymentDateStart: '',
      paymentDateEnd: '',
      ageStart: '',
      ageEnd: ''
    });
  };

  const fetchAllCitizens = async (query) => {
    const PAGE_SIZE = 1000;
    let allCitizens = [];
    let hasMore = true;
    let page = 0;

    while (hasMore) {
      const { data, error } = await query
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      if (data) {
        allCitizens = [...allCitizens, ...data];
      }

      hasMore = data && data.length === PAGE_SIZE;
      page++;
    }

    return allCitizens;
  };

  const fetchStats = async () => {
    try {
      setLoading(true);

      let query = supabase.from('citizens').select('*');

      if (filters.startDate) {
        query = query.gte('created_at', startOfDay(parseISO(filters.startDate)).toISOString());
      }
      if (filters.endDate) {
        query = query.lte('created_at', endOfDay(parseISO(filters.endDate)).toISOString());
      }

      if (filters.birthDateStart) {
        query = query.gte('birth_date', filters.birthDateStart);
      }
      if (filters.birthDateEnd) {
        query = query.lte('birth_date', filters.birthDateEnd);
      }

      if (filters.paymentDateStart) {
        query = query.gte('payment_date', filters.paymentDateStart);
      }
      if (filters.paymentDateEnd) {
        query = query.lte('payment_date', filters.paymentDateEnd);
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

      if (filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      const citizens = await fetchAllCitizens(query);

      const filteredCitizens = citizens.filter(citizen => {
        const age = new Date().getFullYear() - new Date(citizen.birth_date).getFullYear();
        const meetsAgeStart = !filters.ageStart || age >= parseInt(filters.ageStart);
        const meetsAgeEnd = !filters.ageEnd || age <= parseInt(filters.ageEnd);
        return meetsAgeStart && meetsAgeEnd;
      });

      const byStatus = Object.entries(
        filteredCitizens.reduce((acc, citizen) => {
          acc[citizen.status] = (acc[citizen.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([status, count]) => ({ status, count }));

      const bySex = Object.entries(
        filteredCitizens.reduce((acc, citizen) => {
          acc[citizen.sex] = (acc[citizen.sex] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([sex, count]) => ({ sex, count }));

      const byAge = AGE_RANGES.map(range => ({
        range: range.label,
        count: filteredCitizens.filter(citizen => {
          const age = new Date().getFullYear() - new Date(citizen.birth_date).getFullYear();
          return age >= range.min && age <= range.max;
        }).length
      }));

      const byQuarter = [1, 2, 3, 4].map(q => ({
        quarter: `Q${q}`,
        count: filteredCitizens.filter(citizen => {
          const date = new Date(citizen.birth_date);
          return Math.floor(date.getMonth() / 3) + 1 === q;
        }).length
      }));

      const paymentStats = {
        paid: filteredCitizens.filter(c => c.status === 'Paid').length,
        unpaid: filteredCitizens.filter(c => c.status === 'Unpaid').length,
        liquidated: filteredCitizens.filter(c => c.status === 'Liquidated').length,
        disqualified: filteredCitizens.filter(c => c.status === 'Disqualified').length,
        encoded: filteredCitizens.filter(c => c.status === 'Encoded').length,
        validated: filteredCitizens.filter(c => c.status === 'Validated').length,
        cleanlisted: filteredCitizens.filter(c => c.status === 'Cleanlisted').length,


        
        total: filteredCitizens.length
      };

      const { data: allProvinces } = await supabase
        .from('provinces')
        .select('code, name')
        .order('name');

      const provinceStats = await Promise.all(
        (allProvinces || []).map(async (province) => {
          const provinceCitizens = filteredCitizens.filter(c => c.province_code === province.code);
          return {
            name: province.name,
            paid: provinceCitizens.filter(c => c.status === 'Paid').length,
            unpaid: provinceCitizens.filter(c => c.status === 'Unpaid').length,
            encoded: provinceCitizens.filter(c => c.status === 'Encoded').length,
            validated: provinceCitizens.filter(c => c.status === 'Validated').length,
            cleanlisted: provinceCitizens.filter(c => c.status === 'Cleanlisted').length,
            liquidated: provinceCitizens.filter(c => c.status === 'Liquidated').length,
            disqualified: provinceCitizens.filter(c => c.status === 'Disqualified').length,
            total: provinceCitizens.length
          };
        })
      );

      if (filters.province) {
        const { data: lgus } = await supabase
          .from('lgus')
          .select('code, name')
          .eq('province_code', filters.province)
          .order('name');

        if (lgus) {
          const lguStatsData = await Promise.all(
            lgus.map(async (lgu) => {
              const lguCitizens = filteredCitizens.filter(c => c.lgu_code === lgu.code);
              return {
                name: lgu.name,
                paid: lguCitizens.filter(c => c.status === 'Paid').length,
                unpaid: lguCitizens.filter(c => c.status === 'Unpaid').length,
                encoded: lguCitizens.filter(c => c.status === 'Encoded').length,
                validated: lguCitizens.filter(c => c.status === 'Validated').length,
                cleanlisted: lguCitizens.filter(c => c.status === 'Cleanlisted').length,
                disqualified: lguCitizens.filter(c => c.status === 'Disqualified').length,
                total: lguCitizens.length
              };
            })
          );
          setLguStats(lguStatsData);
        }
      } else {
        setLguStats([]);
      }

      const [
        { count: provincesCount },
        { count: lgusCount },
        { count: barangaysCount }
      ] = await Promise.all([
        supabase.from('provinces').select('*', { count: 'exact', head: true }),
        supabase.from('lgus').select('*', { count: 'exact', head: true }),
        supabase.from('barangays').select('*', { count: 'exact', head: true })
      ]);

      setStats({
        totalCitizens: filteredCitizens.length,
        provinces: provincesCount || 0,
        lgus: lgusCount || 0,
        barangays: barangaysCount || 0,
        byStatus,
        bySex,
        byAge,
        byQuarter,
        paymentStats,
        provinceStats
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-gray-600">Analytics and Overview</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-outline flex items-center space-x-2"
          >
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
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Registration Date Range</label>
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

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Birth Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={filters.birthDateStart}
                  onChange={(e) => setFilters(prev => ({ ...prev, birthDateStart: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={filters.birthDateEnd}
                  onChange={(e) => setFilters(prev => ({ ...prev, birthDateEnd: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Age Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="60"
                  max="150"
                  value={filters.ageStart}
                  onChange={(e) => setFilters(prev => ({ ...prev, ageStart: e.target.value }))}
                  placeholder="Min Age"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <input
                  type="number"
                  min="60"
                  max="150"
                  value={filters.ageEnd}
                  onChange={(e) => setFilters(prev => ({ ...prev, ageEnd: e.target.value }))}
                  placeholder="Max Age"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Payment Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={filters.paymentDateStart}
                  onChange={(e) => setFilters(prev => ({ ...prev, paymentDateStart: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={filters.paymentDateEnd}
                  onChange={(e) => setFilters(prev => ({ ...prev, paymentDateEnd: e.target.value }))}
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
              <label className="block text-sm font-medium text-gray-700">Barangay</label>
              <select
                value={filters.barangay}
                onChange={(e) => setFilters(prev => ({ ...prev, barangay: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(status => (
                <button
                  key={status}
                  onClick={() => {
                    setFilters(prev => ({
                      ...prev,
                      status: prev.status.includes(status)
                        ? prev.status.filter(s => s !== status)
                        : [...prev.status, status]
                    }));
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors duration-150 ${
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Senior Citizens" 
          value={loading ? "Loading..." : stats.totalCitizens.toString()} 
          icon={<Users className="h-10 w-10 text-blue-600" />} 
          color="bg-blue-50" 
        />
        <StatCard 
          title="Provinces" 
          value={loading ? "Loading..." : stats.provinces.toString()} 
          icon={<FileText className="h-10 w-10 text-teal-600" />} 
          color="bg-teal-50" 
        />
        <StatCard 
          title="Cities/Municipalities" 
          value={loading ? "Loading..." : stats.lgus.toString()} 
          icon={<Upload className="h-10 w-10 text-orange-600" />} 
          color="bg-orange-50" 
        />
        <StatCard 
          title="Barangays" 
          value={loading ? "Loading..." : stats.barangays.toString()} 
          icon={<Download className="h-10 w-10 text-purple-600" />} 
          color="bg-purple-50" 
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Expanded Centenarian Act Overview</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">


          <div className="bg-violet-50 rounded-lg p-4">
            <div className="text-violet-600 text-lg font-semibold">Encoded</div>
            <div className="text-3xl font-bold text-violet-700">{stats.paymentStats.encoded}</div>
          
           </div>
          
            <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-orange-600 text-lg font-semibold">Validated</div>
            <div className="text-3xl font-bold text-orange-700">{stats.paymentStats.validated}</div>
            
           </div> 
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-green-600 text-lg font-semibold">Paid</div>
            <div className="text-3xl font-bold text-green-700">{stats.paymentStats.paid}</div>
            <div className="text-sm text-green-600">
              {((stats.paymentStats.paid / (stats.paymentStats.paid + stats.paymentStats.unpaid)) * 100).toFixed(2)}%
            </div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="text-yellow-600 text-lg font-semibold">Unpaid</div>
            <div className="text-3xl font-bold text-yellow-700">{stats.paymentStats.unpaid}</div>
            <div className="text-sm text-yellow-600">
              {((stats.paymentStats.unpaid / (stats.paymentStats.paid + stats.paymentStats.unpaid)) * 100).toFixed(2)}%
            </div>
          </div>
    
                        
           <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-blue-600 text-lg font-semibold">Cleanlisted</div>
            <div className="text-3xl font-bold text-blue-700">{stats.paymentStats.cleanlisted}</div>
           </div>
           
           
                    
           <div className="bg-green-50 rounded-lg p-4">
            <div className="text-green-600 text-lg font-semibold">Liquidated</div>
            <div className="text-3xl font-bold text-green-700">{stats.paymentStats.liquidated}</div>
           </div>
        
           <div className="bg-red-50 rounded-lg p-4">
            <div className="text-red-600 text-lg font-semibold">Disqualified</div>
            <div className="text-3xl font-bold text-red-700">{stats.paymentStats.disqualified}</div>
          
           </div>
      
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-gray-600 text-lg font-semibold">Total</div>
            <div className="text-3xl font-bold text-gray-700">{stats.paymentStats.total}</div>
            <div className="text-sm text-gray-600">All Records</div>
          </div>
     
          
         </div>
    
        
        <div className="mt-6">
          <h3 className="text-md font-semibold mb-4">Provincial Statistics</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Province</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unpaid</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Encoded</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Validated</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cleanlisted</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Liquidated</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Disqualified</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid %</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.provinceStats.map((province) => (
                  <tr key={province.name} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {province.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                      {province.paid}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-yellow-600 font-medium">
                      {province.unpaid}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 font-medium">
                      {province.encoded}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 font-medium">
                      {province.validated}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 font-medium">
                      {province.cleanlisted}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 font-medium">
                      {province.liquidated}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                      {province.disqualified}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                      {province.total}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {province.total > 0 ? ((province.paid / province.total) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filters.province && lguStats.length > 0 && (
          <>
            <h3 className="text-lg font-semibold mt-8 mb-4">
              LGU Statistics for {provinces.find(p => p.code === filters.province)?.name}
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LGU</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unpaid</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Encoded</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Validated</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cleanlisted</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Liquidated</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Disqualified</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid %</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lguStats.map((lgu) => (
                    <tr key={lgu.name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {lgu.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                        {lgu.paid}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-yellow-600 font-medium">
                        {lgu.unpaid}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 font-medium">
                        {lgu.encoded}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 font-medium">
                        {lgu.validated}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 font-medium">
                        {lgu.cleanlisted}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                        {lgu.disqualified}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                        {lgu.total}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {lgu.total > 0 ? ((lgu.paid / lgu.total) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Status Distribution</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.byStatus}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Count">
                  {stats.byStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.status as keyof typeof COLORS]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Gender Distribution</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.bySex}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="sex"
                >
                  {stats.bySex.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.sex as keyof typeof COLORS]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Age Distribution</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.byAge}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Count" fill="#1d3694" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Quarterly Registration Trend</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.byQuarter}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quarter" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Registrations" fill="#1d3694" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div className={`${color} p-6 rounded-lg shadow-sm transition-all duration-300 hover:shadow-md`}>
      <div className="flex items-center">
        <div className="mr-4">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;