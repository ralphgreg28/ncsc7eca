import { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, FileText, Upload, Download, RefreshCw, Calendar, ChevronDown, ChevronUp, AlertCircle, Loader2, CheckCircle, DollarSign, Clock, CheckSquare, AlertTriangle, XCircle, Pencil } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, LabelList, RadialBarChart, RadialBar, AreaChart, Area } from 'recharts';
import { supabase } from '../lib/supabase';

interface Filters {
  startDate: string;
  endDate: string;
  province: string;
  lgu: string;
  barangay: string;
  status: string[];
  paymentDateStart: string;
  paymentDateEnd: string;
  ageStart: string;
  ageEnd: string;
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
  byMonth: {
    month: string;
    count: number;
  }[];
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
    percentage: number;
  }[];
}

const COLORS = {
  Encoded: '#6366F1', // Indigo
  Validated: '#10B981', // Emerald
  Cleanlisted: '#0EA5E9', // Sky
  Waitlisted: '#F59E0B', // Amber
  Paid: '#22C55E', // Green
  Unpaid: '#F97316', // Orange
  Compliance: '#EF4444', // Red
  Disqualified: '#6B7280', // Gray
  Male: '#3B82F6', // Blue
  Female: '#EC4899' // Pink
};

// Modern gradients for charts
const GRADIENTS = {
  blue: ['#3B82F6', '#1E40AF'],
  green: ['#10B981', '#047857'],
  purple: ['#8B5CF6', '#6D28D9'],
  orange: ['#F97316', '#C2410C'],
  teal: ['#14B8A6', '#0F766E']
};

const AGE_RANGES = [
  //{ min: 60, max: 79, label: '60-79' },
  { min: 80, max: 84, label: '80' },
  { min: 85, max: 89, label: '85' },
  { min: 90, max: 94, label: '90' },
  { min: 95, max: 99, label: '95' },
  { min: 100, max: Infinity, label: '100+' }
];

function Dashboard() {
  const [showFilters, setShowFilters] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const [stats, setStats] = useState<Stats>({
    totalCitizens: 0,
    provinces: 0,
    lgus: 0,
    barangays: 0,
    byStatus: [],
    bySex: [],
    byAge: [],
    byQuarter: [],
    byMonth: [],
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
  
  const [filters, setFilters] = useState<Filters>({
    startDate: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    province: '',
    lgu: '',
    barangay: '',
    status: [],
    paymentDateStart: '',
    paymentDateEnd: '',
    ageStart: '',
    ageEnd: '',
    calendarYear: ['2023','2024', '2025', '2026', '2027', '2028']
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

  const statusOptions = useMemo(() => [
    'Encoded',
    'Validated',
    'Cleanlisted',
    'Waitlisted',
    'Paid',
    'Unpaid',
    'Compliance',
    'Disqualified'
  ], []);

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
      setError('Failed to load provinces');
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
      setError('Failed to load LGUs');
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
      setError('Failed to load barangays');
    }
  }, [filters.lgu]);

  const resetFilters = useCallback(() => {
    setFilters({
      startDate: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      province: '',
      lgu: '',
      barangay: '',
      status: [],
      paymentDateStart: '',
      paymentDateEnd: '',
      ageStart: '',
      ageEnd: '',
      calendarYear: ['2023','2024', '2025', '2026', '2027', '2028']
    });
    setError(null);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await fetchStats();
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Define a type for the citizen object
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
    created_at: string;
    [key: string]: any;
  }

  const fetchAllCitizens = async (query: any): Promise<Citizen[]> => {
    const PAGE_SIZE = 1000;
    let allCitizens: Citizen[] = [];
    let hasMore = true;
    let page = 0;

    while (hasMore) {
      const { data, error } = await query
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      if (data) {
        allCitizens = [...allCitizens, ...data as Citizen[]];
      }

      hasMore = data && data.length === PAGE_SIZE;
      page++;
    }

    return allCitizens;
  };

  // Calculate total amount based on age using calendar year
  const calculateTotalAmount = useCallback((citizens: Citizen[], selectedYears: string[]) => {
    return citizens.reduce((total, citizen) => {
      const qualifiesForPayment = selectedYears.some(yearStr => {
        const year = parseInt(yearStr);
        const age = year - new Date(citizen.birth_date).getFullYear();
        return age >= 80;
      });
      
      if (qualifiesForPayment) {
        const maxAge = Math.max(...selectedYears.map(yearStr => {
          const year = parseInt(yearStr);
          return year - new Date(citizen.birth_date).getFullYear();
        }));
        
        if (maxAge >= 100) {
          return total + 100000;
        } else if (maxAge >= 80) {
          return total + 10000;
        }
      }
      return total;
    }, 0);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase.from('citizens').select('*');

      if (filters.startDate) {
        query = query.gte('created_at', startOfDay(parseISO(filters.startDate)).toISOString());
      }
      if (filters.endDate) {
        query = query.lte('created_at', endOfDay(parseISO(filters.endDate)).toISOString());
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

      const selectedYears = filters.calendarYear.length > 0 
        ? filters.calendarYear 
        : ['2023','2024', '2025', '2026', '2027', '2028'];
      
      query = query.in('calendar_year', selectedYears.map(year => parseInt(year)));

      const citizens = await fetchAllCitizens(query);

      const filteredCitizens = citizens.filter(citizen => {
        return selectedYears.some(yearStr => {
          const year = parseInt(yearStr);
          const age = year - new Date(citizen.birth_date).getFullYear();
          const meetsAgeStart = !filters.ageStart || age >= parseInt(filters.ageStart);
          const meetsAgeEnd = !filters.ageEnd || age <= parseInt(filters.ageEnd);
          return meetsAgeStart && meetsAgeEnd;
        });
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

      const referenceYear = filters.calendarYear.length > 0 ? parseInt(filters.calendarYear[0]) : new Date().getFullYear();
      
      const byAge = AGE_RANGES.map(range => ({
        range: range.label,
        count: filteredCitizens.filter(citizen => {
          if (filters.calendarYear.length > 0) {
            return filters.calendarYear.some(yearStr => {
              const year = parseInt(yearStr);
              const age = year - new Date(citizen.birth_date).getFullYear();
              return age >= range.min && age <= range.max;
            });
          } else {
            const age = referenceYear - new Date(citizen.birth_date).getFullYear();
            return age >= range.min && age <= range.max;
          }
        }).length
      }));

      const byQuarter = [1, 2, 3, 4].map(q => ({
        quarter: `Q${q}`,
        count: filteredCitizens.filter(citizen => {
          const date = new Date(citizen.birth_date);
          return Math.floor(date.getMonth() / 3) + 1 === q;
        }).length
      }));

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      const byMonth = monthNames.map((month, index) => ({
        month,
        count: filteredCitizens.filter(citizen => {
          const date = new Date(citizen.birth_date);
          return date.getMonth() === index;
        }).length
      }));

      const encodedCitizens = filteredCitizens.filter(c => c.status === 'Encoded');
      const validatedCitizens = filteredCitizens.filter(c => c.status === 'Validated');
      const paidStatusCitizens = filteredCitizens.filter(c => c.status === 'Paid');
      const unpaidCitizens = filteredCitizens.filter(c => c.status === 'Unpaid');
      const cleanlistedCitizens = filteredCitizens.filter(c => c.status === 'Cleanlisted');
      const complianceCitizens = filteredCitizens.filter(c => c.status === 'Compliance');
      const disqualifiedCitizens = filteredCitizens.filter(c => c.status === 'Disqualified');
      const waitlistedCitizens = filteredCitizens.filter(c => c.status === 'Waitlisted');
      
      const paymentStats = {
        paid: paidStatusCitizens.length,
        unpaid: unpaidCitizens.length,
        compliance: complianceCitizens.length,
        disqualified: disqualifiedCitizens.length,
        encoded: encodedCitizens.length,
        validated: validatedCitizens.length,
        cleanlisted: cleanlistedCitizens.length,
        waitlisted: waitlistedCitizens.length,
        total: filteredCitizens.length,
        paidAmount: calculateTotalAmount(paidStatusCitizens, selectedYears),
        unpaidAmount: calculateTotalAmount(unpaidCitizens, selectedYears),
        complianceAmount: calculateTotalAmount(complianceCitizens, selectedYears),
        disqualifiedAmount: calculateTotalAmount(disqualifiedCitizens, selectedYears),
        encodedAmount: calculateTotalAmount(encodedCitizens, selectedYears),
        validatedAmount: calculateTotalAmount(validatedCitizens, selectedYears),
        cleanlistedAmount: calculateTotalAmount(cleanlistedCitizens, selectedYears),
        waitlistedAmount: calculateTotalAmount(waitlistedCitizens, selectedYears)
      };

      const specificAges = [80, 85, 90, 95, 100];
      const paidCitizens = filteredCitizens.filter(c => c.status === 'Paid');
      const totalPaid = paidCitizens.length;

      const paidBySpecificAge = specificAges.map(targetAge => {
        const exactAgeCitizens = paidCitizens.filter(citizen => {
          if (filters.calendarYear.length > 0) {
            return filters.calendarYear.some(yearStr => {
              const year = parseInt(yearStr);
              const age = year - new Date(citizen.birth_date).getFullYear();
              return age === targetAge;
            });
          } else {
            const age = referenceYear - new Date(citizen.birth_date).getFullYear();
            return age === targetAge;
          }
        });
        
        const count = exactAgeCitizens.length;
        const maleCount = exactAgeCitizens.filter(c => c.sex === 'Male').length;
        const femaleCount = exactAgeCitizens.filter(c => c.sex === 'Female').length;
        const cashGift = targetAge === 100 ? 100000 : 10000;
        
        return {
          age: targetAge,
          count,
          maleCount,
          femaleCount,
          malePercentage: count > 0 ? (maleCount / count) * 100 : 0,
          femalePercentage: count > 0 ? (femaleCount / count) * 100 : 0,
          percentage: totalPaid > 0 ? (count / totalPaid) * 100 : 0,
          cashGift,
          totalAmount: count * cashGift
        };
      });

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
            waitlisted: provinceCitizens.filter(c => c.status === 'Waitlisted').length,
            compliance: provinceCitizens.filter(c => c.status === 'Compliance').length,
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
                waitlisted: lguCitizens.filter(c => c.status === 'Waitlisted').length,
                compliance: lguCitizens.filter(c => c.status === 'Compliance').length,
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
        byMonth,
        paymentStats,
        provinceStats,
        paidBySpecificAge
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center z-50 overflow-hidden">
        <div className="relative">
          {/* Outer rotating ring - MAXIMIZED */}
          <div className="absolute inset-0 rounded-full border-8 border-transparent border-t-blue-500 border-r-purple-500 animate-spin w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96"></div>
          
          {/* Middle rotating ring - MAXIMIZED */}
          <div className="absolute inset-8 rounded-full border-8 border-transparent border-t-indigo-400 border-l-pink-400 animate-spin w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80" style={{ animationDirection: 'reverse', animationDuration: '1.2s' }}></div>
          
          {/* Inner pulsing circle - MAXIMIZED */}
          <div className="absolute inset-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 animate-pulse w-32 h-32 md:w-48 md:h-48 lg:w-64 lg:h-64 flex items-center justify-center shadow-2xl">
            <Loader2 className="h-16 w-16 md:h-24 md:w-24 lg:h-32 lg:w-32 text-white animate-spin" />
          </div>
          
          {/* Loading text - MAXIMIZED */}
          <div className="absolute -bottom-24 md:-bottom-32 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
            <div className="flex flex-col items-center space-y-4">
              <div className="flex items-center space-x-3">
                <span className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent animate-pulse">
                  Loading Dashboard
                </span>
              </div>
              <div className="flex space-x-2">
                <div className="w-4 h-4 md:w-5 md:h-5 bg-blue-500 rounded-full animate-bounce shadow-lg" style={{ animationDelay: '0ms' }}></div>
                <div className="w-4 h-4 md:w-5 md:h-5 bg-indigo-500 rounded-full animate-bounce shadow-lg" style={{ animationDelay: '150ms' }}></div>
                <div className="w-4 h-4 md:w-5 md:h-5 bg-purple-500 rounded-full animate-bounce shadow-lg" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Floating particles effect - MAXIMIZED */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-6 h-6 md:w-8 md:h-8 bg-blue-400 rounded-full animate-ping opacity-75" style={{ animationDuration: '2s' }}></div>
          <div className="absolute top-1/3 right-1/4 w-5 h-5 md:w-6 md:h-6 bg-purple-400 rounded-full animate-ping opacity-75" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}></div>
          <div className="absolute bottom-1/3 left-1/3 w-5 h-5 md:w-6 md:h-6 bg-indigo-400 rounded-full animate-ping opacity-75" style={{ animationDuration: '3s', animationDelay: '1s' }}></div>
          <div className="absolute bottom-1/4 right-1/3 w-6 h-6 md:w-8 md:h-8 bg-pink-400 rounded-full animate-ping opacity-75" style={{ animationDuration: '2.2s', animationDelay: '0.7s' }}></div>
          <div className="absolute top-1/2 left-1/6 w-4 h-4 md:w-5 md:h-5 bg-teal-400 rounded-full animate-ping opacity-75" style={{ animationDuration: '2.8s', animationDelay: '0.3s' }}></div>
          <div className="absolute top-3/4 right-1/6 w-4 h-4 md:w-5 md:h-5 bg-cyan-400 rounded-full animate-ping opacity-75" style={{ animationDuration: '2.3s', animationDelay: '0.8s' }}></div>
          <div className="absolute bottom-1/2 right-1/2 w-5 h-5 md:w-7 md:h-7 bg-violet-400 rounded-full animate-ping opacity-75" style={{ animationDuration: '2.7s', animationDelay: '0.2s' }}></div>
          <div className="absolute top-1/6 right-1/3 w-4 h-4 md:w-6 md:h-6 bg-fuchsia-400 rounded-full animate-ping opacity-75" style={{ animationDuration: '2.6s', animationDelay: '0.6s' }}></div>
        </div>
        
        {/* Additional glow effect */}
        <div className="absolute inset-0 bg-gradient-radial from-blue-200/20 via-purple-200/10 to-transparent pointer-events-none"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-600">Analytics and Overview</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowCharts(!showCharts)}
            className="btn-primary flex items-center space-x-1.5 text-sm px-3 py-1.5"
          >
            <span>{showCharts ? 'Hide Charts' : 'Show Charts'}</span>
            {showCharts ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-outline flex items-center space-x-1.5 text-sm px-3 py-1.5"
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
            className="btn-outline flex items-center text-sm px-3 py-1.5"
            title="Reset Filters"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Reset Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
          

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

          <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Calendar Year</label>
              <div className="flex flex-wrap gap-2">
                {['2024', '2025','2026','2027','2028'].map(year => (
                  <button
                    key={year}
                    onClick={() => {
                      setFilters(prev => {
                        const currentYears = prev.calendarYear;
                        
                        if (currentYears.includes(year)) {
                          // If clicking on a selected year, deselect it
                          const newYears = currentYears.filter(y => y !== year);
                          return {
                            ...prev,
                            calendarYear: newYears
                          };
                        } else {
                          // If clicking on an unselected year, add it
                          return {
                            ...prev,
                            calendarYear: [...currentYears, year]
                          };
                        }
                      });
                    }}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors duration-150 ${
                      filters.calendarYear.includes(year)
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {year}
                  </button>
                ))}
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
            <div className="flex items-center">
              <Pencil className="h-5 w-5 text-violet-600 mr-2" />
              <div className="text-violet-600 text-lg font-semibold">Encoded</div>
            </div>
            <div className="text-3xl font-bold text-violet-700">{stats.paymentStats.encoded}</div>
            <div className="text-sm text-violet-600">₱{stats.paymentStats.encodedAmount?.toLocaleString()}</div>
          </div>
          
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-orange-600 mr-2" />
                <div className="text-orange-600 text-lg font-semibold">Validated</div>
              </div>
              <div className="text-3xl font-bold text-orange-700">{stats.paymentStats.validated}</div>
              <div className="text-sm text-orange-600">₱{stats.paymentStats.validatedAmount?.toLocaleString()}</div>
            </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <DollarSign className="h-5 w-5 text-green-600 mr-2" />
              <div className="text-green-600 text-lg font-semibold">Paid</div>
            </div>
            <div className="text-3xl font-bold text-green-700">{stats.paymentStats.paid}</div>
            <div className="text-sm text-green-600">
              {((stats.paymentStats.paid / (stats.paymentStats.paid + stats.paymentStats.unpaid)) * 100).toFixed(2)}%
            </div>
            <div className="text-sm text-green-600">₱{stats.paymentStats.paidAmount?.toLocaleString()}</div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
              <div className="text-yellow-600 text-lg font-semibold">Unpaid</div>
            </div>
            <div className="text-3xl font-bold text-yellow-700">{stats.paymentStats.unpaid}</div>
            <div className="text-sm text-yellow-600">
              {((stats.paymentStats.unpaid / (stats.paymentStats.paid + stats.paymentStats.unpaid)) * 100).toFixed(2)}%
            </div>
            <div className="text-sm text-yellow-600">₱{stats.paymentStats.unpaidAmount?.toLocaleString()}</div>
          </div>
    
                        
           <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <CheckSquare className="h-5 w-5 text-blue-600 mr-2" />
              <div className="text-blue-600 text-lg font-semibold">Cleanlisted</div>
            </div>
            <div className="text-3xl font-bold text-blue-700">{stats.paymentStats.cleanlisted}</div>
            <div className="text-sm text-blue-600">₱{stats.paymentStats.cleanlistedAmount?.toLocaleString()}</div>
           </div>
           
           
                    
           <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
              <div className="text-red-600 text-lg font-semibold">Compliance</div>
            </div>
            <div className="text-3xl font-bold text-red-700">{stats.paymentStats.compliance}</div>
            <div className="text-sm text-red-600">₱{stats.paymentStats.complianceAmount?.toLocaleString()}</div>
           </div>
        
           <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-red-600 mr-2" />
              <div className="text-red-600 text-lg font-semibold">Disqualified</div>
            </div>
            <div className="text-3xl font-bold text-red-700">{stats.paymentStats.disqualified}</div>
            <div className="text-sm text-red-600">₱{stats.paymentStats.disqualifiedAmount?.toLocaleString()}</div>
           </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-gray-600 mr-2" />
                <div className="text-gray-600 text-lg font-semibold">Waitlisted</div>
              </div>
              <div className="text-3xl font-bold text-gray-700">{stats.paymentStats.waitlisted}</div>
              <div className="text-sm text-gray-600">Not yet included for Payout</div>
              <div className="text-sm text-gray-600">₱{stats.paymentStats.waitlistedAmount?.toLocaleString()}</div>
            </div>
     
         </div>
    
        
        {showCharts && (
          <>
            {/* Monthly Distribution Chart */}
            <div className="mt-6">
              <h3 className="text-md font-semibold mb-4">Monthly Distribution by Birth Date</h3>
              <p className="text-sm text-gray-600 mb-4">
                Distribution of records by birth month for easy data analysis
              </p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={stats.byMonth}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GRADIENTS.blue[0]} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={GRADIENTS.blue[1]} stopOpacity={0.2}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                      axisLine={{ stroke: '#E5E7EB' }}
                    />
                    <YAxis 
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                      axisLine={{ stroke: '#E5E7EB' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        border: 'none'
                      }}
                      labelStyle={{ fontWeight: 'bold', color: '#111827' }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '10px' }}
                      iconType="circle"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      name="Number of Records" 
                      stroke={GRADIENTS.blue[0]} 
                      fillOpacity={1} 
                      fill="url(#monthlyGradient)"
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    >
                      <LabelList 
                        dataKey="count" 
                        position="top" 
                        style={{ fill: '#4B5563', fontSize: 11, fontWeight: 'bold' }}
                      />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Compliance</th>
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
                      {province.compliance}
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
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LGU</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unpaid</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Encoded</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Validated</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cleanlisted</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Compliance</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Disqualified</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid %</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lguStats.map((lgu) => (
                    <tr key={lgu.name} className="hover:bg-gray-50">
                      <td className="px-2 py-1 whitespace-nowrap text-sm font-small text-gray-900">
                        {lgu.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-small">
                        {lgu.paid}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-yellow-600 font-small">
                        {lgu.unpaid}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 font-small">
                        {lgu.encoded}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 font-small">
                        {lgu.validated}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 font-small">
                        {lgu.cleanlisted}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 font-small">
                        {lgu.compliance}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-small">
                        {lgu.disqualified} 
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-small">
                        {lgu.total}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-900">
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

      {/* Paid by Specific Age Statistics */}
      <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
        <h2 className="text-lg font-semibold mb-4">Paid Citizens by Specific Ages</h2>
        <p className="text-sm text-gray-600 mb-2">
          Analysis of citizens with "Paid" status at specific ages: 80, 85, 90, 95, and 100 years old
        </p>
        <p className="text-sm text-blue-600 font-medium mb-4">
          {filters.calendarYear.length > 0 
            ? `Using Calendar Years: ${filters.calendarYear.join(', ')} for age calculations`
            : `Using Calendar Year: ${new Date().getFullYear()} for age calculations`
          }
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exact Age</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Count</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Male</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Female</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cash Gift (PHP)</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount (PHP)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.paidBySpecificAge.map((ageGroup: any) => (
                <tr key={ageGroup.age} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {ageGroup.age} years old
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                    {ageGroup.count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 font-medium">
                    {ageGroup.maleCount} ({ageGroup.malePercentage.toFixed(1)}%)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-pink-600 font-medium">
                    {ageGroup.femaleCount} ({ageGroup.femalePercentage.toFixed(1)}%)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {ageGroup.percentage.toFixed(2)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 font-medium">
                    {ageGroup.cashGift?.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-indigo-600 font-medium">
                    {ageGroup.totalAmount?.toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Total
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                  {stats.paidBySpecificAge.reduce((sum: number, item: any) => sum + item.count, 0)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 font-medium">
                  {(() => {
                    const totalMale = stats.paidBySpecificAge.reduce((sum: number, item: any) => sum + item.maleCount, 0);
                    const totalCount = stats.paidBySpecificAge.reduce((sum: number, item: any) => sum + item.count, 0);
                    const percentage = totalCount > 0 ? (totalMale / totalCount) * 100 : 0;
                    return `${totalMale} (${percentage.toFixed(1)}%)`;
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-pink-600 font-medium">
                  {(() => {
                    const totalFemale = stats.paidBySpecificAge.reduce((sum: number, item: any) => sum + item.femaleCount, 0);
                    const totalCount = stats.paidBySpecificAge.reduce((sum: number, item: any) => sum + item.count, 0);
                    const percentage = totalCount > 0 ? (totalFemale / totalCount) * 100 : 0;
                    return `${totalFemale} (${percentage.toFixed(1)}%)`;
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  100%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 font-medium">
                  -
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-indigo-600 font-medium">
                  {stats.paidBySpecificAge.reduce((sum: number, item: any) => sum + item.totalAmount, 0).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {showCharts && (
          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.paidBySpecificAge}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                barSize={30}
                barGap={8}
              >
                <defs>
                  <linearGradient id="countGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GRADIENTS.green[0]} stopOpacity={0.9}/>
                    <stop offset="95%" stopColor={GRADIENTS.green[1]} stopOpacity={0.6}/>
                  </linearGradient>
                  <linearGradient id="percentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GRADIENTS.orange[0]} stopOpacity={0.9}/>
                    <stop offset="95%" stopColor={GRADIENTS.orange[1]} stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis 
                  dataKey="age" 
                  label={{ value: 'Exact Age (years)', position: 'insideBottom', offset: -5 }}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis 
                  yAxisId="left" 
                  label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6B7280' } }}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  label={{ value: 'Percentage', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#6B7280' } }}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    border: 'none'
                  }}
                  cursor={{ fill: 'rgba(224, 231, 255, 0.2)' }}
                  formatter={(value: number | string, name) => {
                    if (name === 'Number of Paid Senior Citizens') return [`${value} citizens`, name];
                    return [`${typeof value === 'number' ? value.toFixed(2) : value}%`, name];
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px' }}
                  iconType="circle"
                />
                <Bar 
                  yAxisId="left" 
                  dataKey="count" 
                  name="Number of Paid Senior Citizens" 
                  fill="url(#countGradient)"
                  radius={[4, 4, 0, 0]}
                >
                  <LabelList 
                    dataKey="count" 
                    position="top" 
                    style={{ fill: '#4B5563', fontSize: 11, fontWeight: 'bold' }}
                  />
                </Bar>
                <Bar 
                  yAxisId="right" 
                  dataKey="percentage" 
                  name="Percentage of Paid Citizens" 
                  fill="url(#percentGradient)"
                  radius={[4, 4, 0, 0]}
                >
                  <LabelList 
                    dataKey="percentage" 
                    position="top" 
                    formatter={(value: number | string) => `${typeof value === 'number' ? value.toFixed(1) : value}%`}
                    style={{ fill: '#4B5563', fontSize: 11, fontWeight: 'bold' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Status Distribution</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.byStatus}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  barSize={40}
                  barGap={4}
                >
                  <defs>
                    {stats.byStatus.map((entry, index) => (
                      <linearGradient 
                        key={`gradient-${index}`} 
                        id={`colorStatus${index}`} 
                        x1="0" y1="0" 
                        x2="0" y2="1"
                      >
                        <stop 
                          offset="5%" 
                          stopColor={COLORS[entry.status as keyof typeof COLORS]} 
                          stopOpacity={0.9}
                        />
                        <stop 
                          offset="95%" 
                          stopColor={COLORS[entry.status as keyof typeof COLORS]} 
                          stopOpacity={0.6}
                        />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="status" 
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis 
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      border: 'none'
                    }}
                    cursor={{ fill: 'rgba(224, 231, 255, 0.2)' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    iconType="circle"
                  />
                  <Bar 
                    dataKey="count" 
                    name="Count" 
                    radius={[4, 4, 0, 0]}
                  >
                    {stats.byStatus.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`url(#colorStatus${index})`} 
                      />
                    ))}
                    <LabelList 
                      dataKey="count" 
                      position="top" 
                      style={{ fill: '#4B5563', fontSize: 11, fontWeight: 'bold' }}
                    />
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
                  <defs>
                    <linearGradient id="maleGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#1E40AF" stopOpacity={1}/>
                    </linearGradient>
                    <linearGradient id="femaleGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EC4899" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#BE185D" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <Pie
                    data={stats.bySex}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    innerRadius={60}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="sex"
                  >
                    {stats.bySex.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.sex === 'Male' ? 'url(#maleGradient)' : 'url(#femaleGradient)'} 
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      border: 'none'
                    }}
                    formatter={(value, name) => [`${value} senior citizens`, name]}
                  />
                  <Legend 
                    iconType="circle"
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ paddingTop: '20px' }}
                  />
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
                  barSize={40}
                  barGap={4}
                >
                  <defs>
                    <linearGradient id="ageGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GRADIENTS.purple[0]} stopOpacity={0.9}/>
                      <stop offset="95%" stopColor={GRADIENTS.purple[1]} stopOpacity={0.6}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="range" 
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis 
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      border: 'none'
                    }}
                    cursor={{ fill: 'rgba(224, 231, 255, 0.2)' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    iconType="circle"
                  />
                  <Bar 
                    dataKey="count" 
                    name="Number of Senior Citizens" 
                    fill="url(#ageGradient)" 
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList 
                      dataKey="count" 
                      position="top" 
                      style={{ fill: '#4B5563', fontSize: 11, fontWeight: 'bold' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 transform transition-all duration-300 hover:shadow-lg">
            <h2 className="text-lg font-semibold mb-2 text-gray-800">Quarterly Distribution by Birth Month</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="110%">
                <PieChart>
                  <defs>
                    <radialGradient id="q1RadialGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={1} />
                      <stop offset="100%" stopColor="#0284c7" stopOpacity={1} />
                    </radialGradient>
                    <radialGradient id="q2RadialGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                      <stop offset="0%" stopColor="#4ade80" stopOpacity={1} />
                      <stop offset="100%" stopColor="#16a34a" stopOpacity={1} />
                    </radialGradient>
                    <radialGradient id="q3RadialGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={1} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={1} />
                    </radialGradient>
                    <radialGradient id="q4RadialGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                      <stop offset="0%" stopColor="#fb923c" stopOpacity={1} />
                      <stop offset="100%" stopColor="#ea580c" stopOpacity={1} />
                    </radialGradient>
                  </defs>
                  <Pie
                    data={stats.byQuarter}
                    cx="50%"
                    cy="50%"
                    labelLine={{
                      stroke: '#9ca3af',
                      strokeWidth: 1,
                      strokeDasharray: '3 3'
                    }}
                    label={({ name, value, percent }) => {
                      const quarterMap = {
                        'Q1': 'Q1',
                        'Q2': 'Q2',
                        'Q3': 'Q3',
                        'Q4': 'Q4'
                      };
                      const quarterName = quarterMap[name as keyof typeof quarterMap] || name;
                      return `${quarterName}: ${(percent * 100).toFixed(0)}%`;
                    }}
                    outerRadius={120}
                    innerRadius={70}
                    paddingAngle={6}
                    dataKey="count"
                    nameKey="quarter"
                    animationBegin={0}
                    animationDuration={1500}
                    animationEasing="ease-out"
                  >
                    {stats.byQuarter.map((entry, index) => {
                      const gradients = [
                        'url(#q1RadialGradient)', 
                        'url(#q2RadialGradient)', 
                        'url(#q3RadialGradient)', 
                        'url(#q4RadialGradient)'
                      ];
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={gradients[index % gradients.length]} 
                          stroke="#ffffff"
                          strokeWidth={3}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                      border: 'none',
                      padding: '12px 16px'
                    }}
                    formatter={(value, name) => {
                      const quarterMap = {
                        'Q1': 'Q1: January - March',
                        'Q2': 'Q2: April - June',
                        'Q3': 'Q3: July - September',
                        'Q4': 'Q4: October - December'
                      };
                      const quarterName = quarterMap[name as keyof typeof quarterMap] || name;
                      return [
                        <span style={{ fontWeight: 'bold', color: '#111827' }}>{value} senior citizens</span>,
                        <span style={{ color: '#4B5563' }}>{quarterName}</span>
                      ];
                    }}
                    wrapperStyle={{ zIndex: 10 }}
                    animationDuration={300}
                    animationEasing="ease-in-out"
                  />
                  <Legend 
                    iconType="circle"
                    iconSize={10}
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ 
                      paddingTop: '20px',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#4B5563'
                    }}
                    formatter={(value) => {
                      const quarterMap = {
                        'Q1': 'Q1: Jan-Mar',
                        'Q2': 'Q2: Apr-Jun',
                        'Q3': 'Q3: Jul-Sep',
                        'Q4': 'Q4: Oct-Dec'
                      };
                      return <span style={{ color: '#4B5563' }}>{quarterMap[value as keyof typeof quarterMap] || value}</span>;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
           
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
