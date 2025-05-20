import { useState, useEffect } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, Clock, User, Info, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { toast } from 'react-toastify';

interface AuditLog {
  id: string;
  created_at: string;
  staff_id: string | null;
  action: string;
  details: any;
  table_name: string;
  record_id: string;
  ip_address: string | null;
  staff_name?: string;
}

interface Filters {
  startDate: string;
  endDate: string;
  action: string;
  staff: string;
  search: string;
}

interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalCount: number;
}

// The database is configured to only store the 50 most recent audit logs
// This is enforced by a trigger in the database
const MAX_LOGS = 500;

function AuditTrail() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [staffMembers, setStaffMembers] = useState<{ id: string; name: string }[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 10,
    totalCount: 0
  });
  const [filters, setFilters] = useState<Filters>({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    action: '',
    staff: '',
    search: ''
  });

  useEffect(() => {
    fetchStaffMembers();
    fetchLogs();
  }, []);

  useEffect(() => {
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    fetchLogs();
  }, [filters]);

  useEffect(() => {
    fetchLogs();
  }, [pagination.currentPage, pagination.pageSize]);

  const fetchStaffMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('id, first_name, last_name')
        .order('last_name');

      if (error) throw error;

      setStaffMembers(data.map(staff => ({
        id: staff.id,
        name: `${staff.last_name}, ${staff.first_name}`
      })));
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Failed to load staff members');
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      // First, get the total count for pagination
      let countQuery = supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('table_name', 'citizens');
      
      // Apply the same filters to the count query
      if (filters.startDate) {
        countQuery = countQuery.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        const endDateWithTime = `${filters.endDate}T23:59:59`;
        countQuery = countQuery.lte('created_at', endDateWithTime);
      }
      if (filters.action) {
        countQuery = countQuery.eq('action', filters.action);
      }
      if (filters.staff) {
        countQuery = countQuery.eq('staff_id', filters.staff);
      }
     if (filters.search) {
        countQuery = countQuery.or(`details->>new.ilike.*${filters.search}*,details->>old.ilike.*${filters.search}*`);
      }

      

      
      const { count, error: countError } = await countQuery;
      
      if (countError) throw countError;
      
      // Update total count in pagination state
      setPagination(prev => ({ ...prev, totalCount: count || 0 }));
      
      // Now fetch the actual data with pagination
      let dataQuery = supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', 'citizens');

      // Apply filters
      if (filters.startDate) {
        dataQuery = dataQuery.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        // Add time to include the entire end date
        const endDateWithTime = `${filters.endDate}T23:59:59`;
        dataQuery = dataQuery.lte('created_at', endDateWithTime);
      }
      if (filters.action) {
        dataQuery = dataQuery.eq('action', filters.action);
      }
      if (filters.staff) {
        dataQuery = dataQuery.eq('staff_id', filters.staff);
      }
      
      if (filters.search) {
        dataQuery = dataQuery.or(`details->>new.ilike.*${filters.search}*,details->>old.ilike.*${filters.search}*`);
      }

      // Order by most recent first
      dataQuery = dataQuery.order('created_at', { ascending: false });
      
      // Apply pagination
      const from = (pagination.currentPage - 1) * pagination.pageSize;
      const to = from + pagination.pageSize - 1;
      dataQuery = dataQuery.range(from, to);

      const { data: logs, error } = await dataQuery;

      if (error) throw error;

      // Get staff names for the logs
      const staffIds = [...new Set(logs?.map(log => log.staff_id).filter(Boolean))];
      
      // Create a map to store staff names
      let staffMap: Record<string, string> = {};
      
      if (staffIds.length > 0) {
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, first_name, last_name')
          .in('id', staffIds);

        staffMap = Object.fromEntries(
          (staffData || []).map(staff => [
            staff.id,
            `${staff.last_name}, ${staff.first_name}`
          ])
        );
      }

      // Add staff names to logs
      const logsWithStaffNames = logs?.map(log => ({
        ...log,
        staff_name: log.staff_id ? staffMap[log.staff_id] : 'System'
      })) || [];
      
      // Collect all address codes from the logs
      const provinceCodes = new Set<string>();
      const lguCodes = new Set<string>();
      const barangayCodes = new Set<string>();
      
      logsWithStaffNames.forEach(log => {
        const details = log.details;
        if (!details) return;
        
        // For create and update actions, use the new data
        // For delete actions, use the old data
        const data = log.action === 'delete' ? details.old : (details.new || details.old);
        
        if (data) {
          if (data.province_code) provinceCodes.add(data.province_code);
          if (data.lgu_code) lguCodes.add(data.lgu_code);
          if (data.barangay_code) barangayCodes.add(data.barangay_code);
        }
      });
      
      // Fetch address details
      const [provinces, lgus, barangays] = await Promise.all([
        supabase.from('provinces').select('code, name').in('code', Array.from(provinceCodes)),
        supabase.from('lgus').select('code, name').in('code', Array.from(lguCodes)),
        supabase.from('barangays').select('code, name').in('code', Array.from(barangayCodes))
      ]);
      
      // Create maps for address lookups
      const provinceMap = Object.fromEntries((provinces.data || []).map(p => [p.code, p.name]));
      const lguMap = Object.fromEntries((lgus.data || []).map(l => [l.code, l.name]));
      const barangayMap = Object.fromEntries((barangays.data || []).map(b => [b.code, b.name]));
      
      // Add address details to logs
      const logsWithAddressDetails = logsWithStaffNames.map(log => {
        const details = log.details;
        let citizenName = '';
        let citizenAddress = '';
        
        if (details) {
          // For create and update actions, use the new data
          // For delete actions, use the old data
          const data = log.action === 'delete' ? details.old : (details.new || details.old);
          
          if (data) {
            // Extract name
            const lastName = data.last_name || '';
            const firstName = data.first_name || '';
            const middleName = data.middle_name || '';
            const extensionName = data.extension_name ? ` ${data.extension_name}` : '';
            
            citizenName = `${lastName}, ${firstName}${middleName ? ` ${middleName}` : ''}${extensionName}`;
            
            // Extract address names
            const provinceName = data.province_code ? provinceMap[data.province_code] || data.province_code : '';
            const lguName = data.lgu_code ? lguMap[data.lgu_code] || data.lgu_code : '';
            const barangayName = data.barangay_code ? barangayMap[data.barangay_code] || data.barangay_code : '';
            
            if (provinceName && lguName && barangayName) {
              citizenAddress = `${barangayName}, ${lguName}, ${provinceName}`;
            }
          }
        }
        
        return {
          ...log,
          citizenName,
          citizenAddress
        };
      });
      
      setLogs(logsWithAddressDetails);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      action: '',
      staff: '',
      search: ''
    });
  };

  // Format the change details in a simple, readable way
  const formatChangeDetails = (details: any, action: string) => {
    if (!details) return 'No details available';
    
    try {
      if (typeof details === 'string') {
        try {
          details = JSON.parse(details);
        } catch {
          return details;
        }
      }

      // Log the action and details for debugging
      console.log(`Formatting action: ${action}`, details);

      if (action === 'create') {
        return (
          <div>
            <p className="font-medium text-green-600">New citizen record created</p>
          </div>
        );
      }
      
      if (action === 'update') {
        // Make sure we have both old and new values
        if (!details.old || !details.new) {
          return <p className="text-gray-500">Update details not available</p>;
        }
        
        // Filter out fields that haven't changed
        const changedFields = Object.keys({...details.old, ...details.new}).filter(key => {
          if (key === 'id' || key === 'created_at' || key === 'updated_at') return false;
          
          const oldValue = details.old[key];
          const newValue = details.new[key];
          
          // Skip if both values are undefined/null
          if ((oldValue === undefined || oldValue === null) && 
              (newValue === undefined || newValue === null)) {
            return false;
          }
          
          // Special handling for specific fields
          if (key === 'sex' || key === 'status') {
            // Handle null/undefined values
            const oldVal = oldValue === null || oldValue === undefined ? '' : oldValue;
            const newVal = newValue === null || newValue === undefined ? '' : newValue;
            
            // Convert both to strings for comparison
            const oldStr = String(oldVal).toLowerCase().trim();
            const newStr = String(newVal).toLowerCase().trim();
            
            return oldStr !== newStr;
          }
          
          // For other fields, use standard comparison
          return JSON.stringify(oldValue) !== JSON.stringify(newValue);
        });
        
        if (changedFields.length === 0) {
          return <p className="text-gray-500">No changes detected</p>;
        }
        
        return (
          <div className="space-y-2">
            {changedFields.map(key => {
              const oldValue = details.old[key];
              const newValue = details.new[key];
              
              return (
                <div key={key} className="text-sm">
                  <span className="font-medium">{formatFieldName(key)}:</span>{' '}
                  <span className="text-red-600">{formatValue(oldValue)}</span>{' '}
                  <span className="text-gray-500">→</span>{' '}
                  <span className="text-green-600">{formatValue(newValue)}</span>
                </div>
              );
            })}
          </div>
        );
      }
      
      if (action === 'delete') {
        // For delete actions, show what was deleted
        if (!details.old) {
          return <p className="text-red-600">Citizen record deleted (details not available)</p>;
        }
        
        return (
          <div>
            <p className="font-medium text-red-600 mb-1">Citizen record deleted</p>
            <div className="space-y-1">
              {Object.entries(details.old)
                .filter(([key]) => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
                .slice(0, 3) // Show only first few fields to keep it simple
                .map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="font-medium">{formatFieldName(key)}:</span>{' '}
                    <span>{formatValue(value)}</span>
                  </div>
                ))}
              {Object.keys(details.old).length > 4 && (
                <div className="text-xs text-gray-500">
                  ...and {Object.keys(details.old).length - 4} more fields
                </div>
              )}
            </div>
          </div>
        );
      }
      
      // Fallback for other actions
      return <p className="text-gray-500">Action: {action}</p>;
    } catch (error) {
      console.error('Error formatting details:', error);
      return 'Error formatting details';
    }
  };

  // Helper function to format field names to be more readable
  const formatFieldName = (key: string) => {
    // Convert snake_case to Title Case
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper function to format values
  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Get action badge color
  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-green-100 text-green-800';
      case 'update':
        return 'bg-blue-100 text-blue-800';
      case 'delete':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Citizen Audit Trail</h1>
          <p className="mt-1 text-gray-600">
            Showing {logs.length} of the most recent {MAX_LOGS} audit logs
          </p>
          <p className="text-xs text-gray-500">
            The system only stores the {MAX_LOGS} most recent changes to save space
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => fetchLogs()}
            className="btn-outline flex items-center space-x-2 py-2"
          >
            <RefreshCw className="h-5 w-5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-outline flex items-center space-x-2 py-2"
          >
            <Filter className="h-5 w-5" />
            <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
            {showFilters ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Filters</h2>
            <button
              onClick={resetFilters}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Date Range</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
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
              <label className="block text-sm font-medium text-gray-700">Staff Member</label>
              <select
                value={filters.staff}
                onChange={(e) => setFilters(prev => ({ ...prev, staff: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">All Staff</option>
                {staffMembers.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Action</label>
              <select
                value={filters.action}
                onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Search</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="Search in details..."
                  className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3">Loading audit logs...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <Info className="h-12 w-12 mx-auto text-gray-400" />
          <h3 className="mt-2 text-lg font-medium">No audit logs found</h3>
          <p className="mt-1">Try adjusting your filters or search criteria.</p>
        </div>
      ) : (
        <>
          <table className="min-w-full divide-y divide-gray-200 bg-white shadow rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Citizen</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Changes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log: any) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {log.staff_name || 'System'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionBadgeClass(log.action)}`}>
                      {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {log.citizenName || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {log.citizenAddress || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatChangeDetails(log.details, log.action)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {pagination.totalCount > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center mb-4 sm:mb-0">
                <span className="text-sm text-gray-700">
                  Showing <span className="font-medium">{((pagination.currentPage - 1) * pagination.pageSize) + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)}
                  </span> of{' '}
                  <span className="font-medium">{pagination.totalCount}</span> results
                </span>
                
                <div className="ml-4">
                  <label htmlFor="pageSize" className="sr-only">Items per page</label>
                  <select
                    id="pageSize"
                    value={pagination.pageSize}
                    onChange={(e) => setPagination(prev => ({ ...prev, pageSize: Number(e.target.value), currentPage: 1 }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value={5}>5 per page</option>
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                  disabled={pagination.currentPage === 1}
                  className={`p-2 rounded-md ${
                    pagination.currentPage === 1
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                <span className="px-4 py-2 text-sm font-medium text-gray-700">
                  Page {pagination.currentPage} of {Math.ceil(pagination.totalCount / pagination.pageSize)}
                </span>
                
                <button
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                  disabled={pagination.currentPage >= Math.ceil(pagination.totalCount / pagination.pageSize)}
                  className={`p-2 rounded-md ${
                    pagination.currentPage >= Math.ceil(pagination.totalCount / pagination.pageSize)
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AuditTrail;
