import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ECAStatistics {
  eca_year: number;
  eca_type: string;
  eca_status: string;
  application_count: number;
  total_amount: number;
  average_amount: number;
}

interface ECAYearSummary {
  year: number;
  totalApplications: number;
  totalAmount: number;
  paidApplications: number;
  paidAmount: number;
  pendingApplications: number;
  disqualifiedApplications: number;
}

interface ECATypeSummary {
  type: string;
  label: string;
  totalApplications: number;
  totalAmount: number;
  paidApplications: number;
  paidAmount: number;
}

const ECADashboard: React.FC = () => {
  const [statistics, setStatistics] = useState<ECAStatistics[]>([]);
  const [yearSummaries, setYearSummaries] = useState<ECAYearSummary[]>([]);
  const [typeSummaries, setTypeSummaries] = useState<ECATypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const ecaTypeLabels: Record<string, string> = {
    'octogenarian_80': '80 Years Old',
    'octogenarian_85': '85 Years Old',
    'nonagenarian_90': '90 Years Old',
    'nonagenarian_95': '95 Years Old',
    'centenarian_100': '100 Years Old'
  };

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      
      // Fetch ECA statistics
      const { data: statsData, error: statsError } = await supabase
        .from('eca_statistics')
        .select('*')
        .order('eca_year', { ascending: false })
        .limit(10000); // Explicitly set a high limit to show all records

      if (statsError) throw statsError;
      setStatistics(statsData || []);

      // Process year summaries
      const yearSummariesMap = new Map<number, ECAYearSummary>();
      
      statsData?.forEach(stat => {
        if (!yearSummariesMap.has(stat.eca_year)) {
          yearSummariesMap.set(stat.eca_year, {
            year: stat.eca_year,
            totalApplications: 0,
            totalAmount: 0,
            paidApplications: 0,
            paidAmount: 0,
            pendingApplications: 0,
            disqualifiedApplications: 0
          });
        }

        const summary = yearSummariesMap.get(stat.eca_year)!;
        summary.totalApplications += stat.application_count;
        summary.totalAmount += stat.total_amount;

        if (stat.eca_status === 'Paid') {
          summary.paidApplications += stat.application_count;
          summary.paidAmount += stat.total_amount;
        } else if (stat.eca_status === 'Disqualified') {
          summary.disqualifiedApplications += stat.application_count;
        } else {
          summary.pendingApplications += stat.application_count;
        }
      });

      setYearSummaries(Array.from(yearSummariesMap.values()));

      // Process type summaries for selected year
      const typeSummariesMap = new Map<string, ECATypeSummary>();
      
      statsData?.filter(stat => stat.eca_year === selectedYear).forEach(stat => {
        if (!typeSummariesMap.has(stat.eca_type)) {
          typeSummariesMap.set(stat.eca_type, {
            type: stat.eca_type,
            label: ecaTypeLabels[stat.eca_type] || stat.eca_type,
            totalApplications: 0,
            totalAmount: 0,
            paidApplications: 0,
            paidAmount: 0
          });
        }

        const summary = typeSummariesMap.get(stat.eca_type)!;
        summary.totalApplications += stat.application_count;
        summary.totalAmount += stat.total_amount;

        if (stat.eca_status === 'Paid') {
          summary.paidApplications += stat.application_count;
          summary.paidAmount += stat.total_amount;
        }
      });

      setTypeSummaries(Array.from(typeSummariesMap.values()));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Recalculate type summaries when selected year changes
    const typeSummariesMap = new Map<string, ECATypeSummary>();
    
    statistics.filter(stat => stat.eca_year === selectedYear).forEach(stat => {
      if (!typeSummariesMap.has(stat.eca_type)) {
        typeSummariesMap.set(stat.eca_type, {
          type: stat.eca_type,
          label: ecaTypeLabels[stat.eca_type] || stat.eca_type,
          totalApplications: 0,
          totalAmount: 0,
          paidApplications: 0,
          paidAmount: 0
        });
      }

      const summary = typeSummariesMap.get(stat.eca_type)!;
      summary.totalApplications += stat.application_count;
      summary.totalAmount += stat.total_amount;

      if (stat.eca_status === 'Paid') {
        summary.paidApplications += stat.application_count;
        summary.paidAmount += stat.total_amount;
      }
    });

    setTypeSummaries(Array.from(typeSummariesMap.values()));
  }, [selectedYear, statistics]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-PH').format(num);
  };

  const calculatePercentage = (part: number, total: number) => {
    return total > 0 ? ((part / total) * 100).toFixed(1) : '0.0';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          ECA Dashboard
        </h1>
        <p className="text-gray-600">
          Overview of Expanded Centenarian Cash Gift program statistics
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Year Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {yearSummaries.slice(0, 4).map((summary) => (
          <div key={summary.year} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{summary.year}</h3>
              <div className="text-sm text-gray-500">
                {calculatePercentage(summary.paidApplications, summary.totalApplications)}% Paid
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Applications:</span>
                <span className="text-sm font-medium">{formatNumber(summary.totalApplications)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Amount:</span>
                <span className="text-sm font-medium">{formatCurrency(summary.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-green-600">Paid:</span>
                <span className="text-sm font-medium text-green-600">{formatCurrency(summary.paidAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-yellow-600">Pending:</span>
                <span className="text-sm font-medium">{formatNumber(summary.pendingApplications)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Year Selection and Type Breakdown */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">ECA Type Breakdown</h2>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {yearSummaries.map(summary => (
              <option key={summary.year} value={summary.year}>{summary.year}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {typeSummaries.map((summary) => (
            <div key={summary.type} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">{summary.label}</h3>
                <div className="text-sm text-gray-500">
                  {calculatePercentage(summary.paidApplications, summary.totalApplications)}% Paid
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Applications:</span>
                  <span className="text-sm font-medium">{formatNumber(summary.totalApplications)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Amount:</span>
                  <span className="text-sm font-medium">{formatCurrency(summary.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-green-600">Paid:</span>
                  <span className="text-sm font-medium text-green-600">{formatNumber(summary.paidApplications)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-green-600">Paid Amount:</span>
                  <span className="text-sm font-medium text-green-600">{formatCurrency(summary.paidAmount)}</span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ 
                      width: `${calculatePercentage(summary.paidApplications, summary.totalApplications)}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {typeSummaries.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-500">No ECA data available for {selectedYear}</div>
            <div className="text-gray-400 text-sm mt-2">
              Generate applications for this year to see statistics
            </div>
          </div>
        )}
      </div>

      {/* Detailed Statistics Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Detailed Statistics</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Applications
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Average Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {statistics.map((stat, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {stat.eca_year}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {ecaTypeLabels[stat.eca_type] || stat.eca_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      stat.eca_status === 'Paid' ? 'bg-green-100 text-green-800' :
                      stat.eca_status === 'Validated' ? 'bg-yellow-100 text-yellow-800' :
                      stat.eca_status === 'Applied' ? 'bg-blue-100 text-blue-800' :
                      stat.eca_status === 'Disqualified' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {stat.eca_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(stat.application_count)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(stat.total_amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(stat.average_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {statistics.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">No statistics available</div>
            <div className="text-gray-400 text-sm mt-2">
              Generate ECA applications to see statistics
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ECADashboard;
