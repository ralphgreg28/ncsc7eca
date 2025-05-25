import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type ECARecord = Database['public']['Tables']['expanded_centenarian_cash_gifts']['Row'];
type ECAWithAddress = ECARecord & {
  first_name: string;
  last_name: string;
  middle_name: string | null;
  extension_name: string | null;
  sex: string;
  osca_id: string;
  rrn: string;
  region_name: string;
  province_name: string;
  lgu_name: string;
  barangay_name: string;
  province_code: string;
  lgu_code: string;
  barangay_code: string;
};

interface ConfirmationModal {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  type: 'single' | 'bulk';
}

const ECAManagement: React.FC = () => {
  const [ecaRecords, setEcaRecords] = useState<ECAWithAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [generatingApplications, setGeneratingApplications] = useState(false);
  
  // Address filtering states
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [selectedLgu, setSelectedLgu] = useState<string>('all');
  const [selectedBarangay, setSelectedBarangay] = useState<string>('all');
  
  // Multiple selection states
  const [selectedRecords, setSelectedRecords] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModal>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
    type: 'single'
  });
  
  // Bulk action states
  const [bulkAction, setBulkAction] = useState<string>('');
  const [processingBulkAction, setProcessingBulkAction] = useState(false);

  const ecaTypes = [
    { value: 'octogenarian_80', label: '80 Years Old (₱10,000)' },
    { value: 'octogenarian_85', label: '85 Years Old (₱10,000)' },
    { value: 'nonagenarian_90', label: '90 Years Old (₱10,000)' },
    { value: 'nonagenarian_95', label: '95 Years Old (₱10,000)' },
    { value: 'centenarian_100', label: '100 Years Old (₱100,000)' }
  ];

  const statusOptions = [
    { value: 'Applied', label: 'Applied', color: 'bg-blue-100 text-blue-800' },
    { value: 'Validated', label: 'Validated', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'Paid', label: 'Paid', color: 'bg-green-100 text-green-800' },
    { value: 'Unpaid', label: 'Unpaid', color: 'bg-red-100 text-red-800' },
    { value: 'Disqualified', label: 'Disqualified', color: 'bg-gray-100 text-gray-800' }
  ];

  useEffect(() => {
    fetchECARecords();
  }, [selectedYear, selectedType, selectedStatus, selectedRegion, selectedProvince, selectedLgu, selectedBarangay]);

  useEffect(() => {
    // Reset dependent filters when parent filter changes
    if (selectedRegion === 'all') {
      setSelectedProvince('all');
      setSelectedLgu('all');
      setSelectedBarangay('all');
    } else if (selectedProvince === 'all') {
      setSelectedLgu('all');
      setSelectedBarangay('all');
    } else if (selectedLgu === 'all') {
      setSelectedBarangay('all');
    }
  }, [selectedRegion, selectedProvince, selectedLgu]);

  const fetchECARecords = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('eca_with_addresses')
        .select('*')
        .eq('eca_year', selectedYear)
        .order('created_at', { ascending: false })
        .limit(10000); // Explicitly set a high limit to show all records

      if (selectedType !== 'all') {
        query = query.eq('eca_type', selectedType);
      }

      if (selectedStatus !== 'all') {
        query = query.eq('eca_status', selectedStatus);
      }

      if (selectedRegion !== 'all') {
        query = query.eq('region_name', selectedRegion);
      }

      if (selectedProvince !== 'all') {
        query = query.eq('province_name', selectedProvince);
      }

      if (selectedLgu !== 'all') {
        query = query.eq('lgu_name', selectedLgu);
      }

      if (selectedBarangay !== 'all') {
        query = query.eq('barangay_name', selectedBarangay);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEcaRecords(data || []);
      
      // Reset selections when data changes
      setSelectedRecords(new Set());
      setSelectAll(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const generateECAApplications = async () => {
    try {
      setGeneratingApplications(true);
      const { data, error } = await supabase.rpc('generate_eca_applications', {
        target_year: selectedYear,
        created_by_user: 'system' // You might want to get this from auth context
      });

      if (error) throw error;

      alert(`Successfully generated ${data} ECA applications for ${selectedYear}`);
      fetchECARecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate applications');
    } finally {
      setGeneratingApplications(false);
    }
  };

  const updateECAStatus = async (ecaId: number, newStatus: string) => {
    try {
      const updateData: any = {
        eca_status: newStatus,
        updated_by: 'current_user', // You might want to get this from auth context
      };

      if (newStatus === 'Paid') {
        updateData.payment_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('expanded_centenarian_cash_gifts')
        .update(updateData)
        .eq('eca_id', ecaId);

      if (error) throw error;

      fetchECARecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleStatusChange = (ecaId: number, newStatus: string, currentStatus: string) => {
    const record = ecaRecords.find(r => r.eca_id === ecaId);
    if (!record) return;

    const fullName = `${record.first_name} ${record.middle_name || ''} ${record.last_name}`.trim();
    
    setConfirmationModal({
      isOpen: true,
      title: 'Confirm Status Change',
      message: `Are you sure you want to change the status of ${fullName} from "${currentStatus}" to "${newStatus}"?`,
      onConfirm: () => {
        updateECAStatus(ecaId, newStatus);
        setConfirmationModal(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => setConfirmationModal(prev => ({ ...prev, isOpen: false })),
      type: 'single'
    });
  };

  const handleBulkAction = () => {
    if (!bulkAction || selectedRecords.size === 0) return;

    const selectedCount = selectedRecords.size;
    const actionLabel = statusOptions.find(s => s.value === bulkAction)?.label || bulkAction;

    setConfirmationModal({
      isOpen: true,
      title: 'Confirm Bulk Action',
      message: `Are you sure you want to change the status of ${selectedCount} selected record(s) to "${actionLabel}"?`,
      onConfirm: async () => {
        setProcessingBulkAction(true);
        try {
          const updateData: any = {
            eca_status: bulkAction,
            updated_by: 'current_user',
          };

          if (bulkAction === 'Paid') {
            updateData.payment_date = new Date().toISOString().split('T')[0];
          }

          const { error } = await supabase
            .from('expanded_centenarian_cash_gifts')
            .update(updateData)
            .in('eca_id', Array.from(selectedRecords));

          if (error) throw error;

          fetchECARecords();
          setBulkAction('');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to perform bulk action');
        } finally {
          setProcessingBulkAction(false);
        }
        setConfirmationModal(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => setConfirmationModal(prev => ({ ...prev, isOpen: false })),
      type: 'bulk'
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(filteredRecords.map(record => record.eca_id)));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectRecord = (ecaId: number) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(ecaId)) {
      newSelected.delete(ecaId);
    } else {
      newSelected.add(ecaId);
    }
    setSelectedRecords(newSelected);
    setSelectAll(newSelected.size === filteredRecords.length);
  };

  const filteredRecords = ecaRecords.filter(record => {
    if (!searchTerm) return true;
    const fullName = `${record.first_name} ${record.middle_name || ''} ${record.last_name}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) ||
           record.osca_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
           record.rrn.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Get unique values for address filters
  const getUniqueRegions = () => {
    const regions = [...new Set(ecaRecords.map(record => record.region_name))];
    return regions.sort();
  };

  const getUniqueProvinces = () => {
    let provinces = ecaRecords;
    if (selectedRegion !== 'all') {
      provinces = provinces.filter(record => record.region_name === selectedRegion);
    }
    const uniqueProvinces = [...new Set(provinces.map(record => record.province_name))];
    return uniqueProvinces.sort();
  };

  const getUniqueLgus = () => {
    let lgus = ecaRecords;
    if (selectedRegion !== 'all') {
      lgus = lgus.filter(record => record.region_name === selectedRegion);
    }
    if (selectedProvince !== 'all') {
      lgus = lgus.filter(record => record.province_name === selectedProvince);
    }
    const uniqueLgus = [...new Set(lgus.map(record => record.lgu_name))];
    return uniqueLgus.sort();
  };

  const getUniqueBarangays = () => {
    let barangays = ecaRecords;
    if (selectedRegion !== 'all') {
      barangays = barangays.filter(record => record.region_name === selectedRegion);
    }
    if (selectedProvince !== 'all') {
      barangays = barangays.filter(record => record.province_name === selectedProvince);
    }
    if (selectedLgu !== 'all') {
      barangays = barangays.filter(record => record.lgu_name === selectedLgu);
    }
    const uniqueBarangays = [...new Set(barangays.map(record => record.barangay_name))];
    return uniqueBarangays.sort();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = statusOptions.find(s => s.value === status);
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig?.color || 'bg-gray-100 text-gray-800'}`}>
        {statusConfig?.label || status}
      </span>
    );
  };

  const getECATypeLabel = (type: string) => {
    const typeConfig = ecaTypes.find(t => t.value === type);
    return typeConfig?.label || type;
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
          Expanded Centenarian Cash Gift Management
        </h1>
        <p className="text-gray-600">
          Manage ECA applications and payments for senior citizens
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 relative">
          <button
            onClick={() => setError(null)}
            className="absolute top-2 right-2 text-red-700 hover:text-red-900 text-xl font-bold"
          >
            ×
          </button>
          {error}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {confirmationModal.title}
            </h3>
            <p className="text-gray-600 mb-6">
              {confirmationModal.message}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={confirmationModal.onCancel}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmationModal.onConfirm}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        {/* Main Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ECA Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 10 }, (_, i) => 2024 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ECA Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              {ecaTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              {statusOptions.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              placeholder="Name, OSCA ID, or RRN"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Address Filters */}
        <div className="border-t pt-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Address Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Region
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Regions</option>
                {getUniqueRegions().map(region => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Province
              </label>
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={selectedRegion === 'all'}
              >
                <option value="all">All Provinces</option>
                {getUniqueProvinces().map(province => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City/Municipality
              </label>
              <select
                value={selectedLgu}
                onChange={(e) => setSelectedLgu(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={selectedProvince === 'all'}
              >
                <option value="all">All Cities/Municipalities</option>
                {getUniqueLgus().map(lgu => (
                  <option key={lgu} value={lgu}>
                    {lgu}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Barangay
              </label>
              <select
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={selectedLgu === 'all'}
              >
                <option value="all">All Barangays</option>
                {getUniqueBarangays().map(barangay => (
                  <option key={barangay} value={barangay}>
                    {barangay}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedRecords.size > 0 && (
          <div className="border-t pt-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">
                  {selectedRecords.size} record(s) selected
                </span>
                <div className="flex items-center space-x-2">
                  <select
                    value={bulkAction}
                    onChange={(e) => setBulkAction(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Action</option>
                    {statusOptions.map(status => (
                      <option key={status.value} value={status.value}>
                        Change to {status.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkAction}
                    disabled={!bulkAction || processingBulkAction}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingBulkAction ? 'Processing...' : 'Apply'}
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedRecords(new Set());
                  setSelectAll(false);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Showing {filteredRecords.length} of {ecaRecords.length} records
          </div>
          <button
            onClick={generateECAApplications}
            disabled={generatingApplications}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50 transition-colors"
          >
            {generatingApplications ? 'Generating...' : `Generate ${selectedYear} Applications`}
          </button>
        </div>
      </div>

      {/* ECA Records Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Citizen
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ECA Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRecords.map((record) => (
                <tr key={record.eca_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedRecords.has(record.eca_id)}
                      onChange={() => handleSelectRecord(record.eca_id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {`${record.first_name} ${record.middle_name || ''} ${record.last_name} ${record.extension_name || ''}`.trim()}
                      </div>
                      <div className="text-sm text-gray-500">
                        OSCA: {record.osca_id} | RRN: {record.rrn}
                      </div>
                      <div className="text-sm text-gray-500">
                        Born: {new Date(record.birth_date).toLocaleDateString('en-US')}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getECATypeLabel(record.eca_type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(record.cash_amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(record.eca_status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      {record.barangay_name}, {record.lgu_name}
                    </div>
                    <div>
                      {record.province_name}, {record.region_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.payment_date ? new Date(record.payment_date).toLocaleDateString('en-US') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <select
                      value={record.eca_status}
                      onChange={(e) => handleStatusChange(record.eca_id, e.target.value, record.eca_status)}
                      className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {statusOptions.map(status => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRecords.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">No ECA records found</div>
            <div className="text-gray-400 text-sm mt-2">
              Try adjusting your filters or generate applications for {selectedYear}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ECAManagement;
