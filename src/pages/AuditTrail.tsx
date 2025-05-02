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

// The database is configured to only store the 50 most recent audit logs
// This is enforced by a trigger in the database
const MAX_LOGS = 50;

function AuditTrail() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [staffMembers, setStaffMembers] = useState<{ id: string; name: string }[]>([]);
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
    fetchLogs();
  }, [filters]);

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
      let query = supabase
        .from('audit_logs')
        .select('*')
        // Filter for citizens table only
        .eq('table_name', 'citizens');

      // Apply filters
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        // Add time to include the entire end date
        const endDateWithTime = `${filters.endDate}T23:59:59`;
        query = query.lte('created_at', endDateWithTime);
      }
      if (filters.action) {
        query = query.eq('action', filters.action);
      }
      if (filters.staff) {
        query = query.eq('staff_id', filters.staff);
      }
      if (filters.search) {
        // Search in details as JSON
        query = query.or(`details.ilike.%${filters.search}%`);
      }

      // Order by most recent first
      query = query.order('created_at', { ascending: false });

      const { data: logs, error } = await query;

      if (error) throw error;

      // Get staff names for the logs
      const staffIds = [...new Set(logs?.map(log => log.staff_id).filter(Boolean))];
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, first_name, last_name')
        .in('id', staffIds);

      const staffMap = Object.fromEntries(
        (staffData || []).map(staff => [
          staff.id,
          `${staff.last_name}, ${staff.first_name}`
        ])
      );

      const logsWithStaffNames = logs?.map(log => ({
        ...log,
        staff_name: log.staff_id ? staffMap[log.staff_id] : 'System'
      })) || [];

      setLogs(logsWithStaffNames);
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

  // Format the change details in a more readable way
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

      if (action === 'create') {
        return (
          <div className="space-y-2">
            <div className="font-medium text-green-600">New Citizen Record Created</div>
            {details.new && Object.entries(details.new).map(([key, value]) => (
              <div key={key} className="grid grid-cols-2 gap-2 text-sm">
                <span className="font-medium text-gray-600">{formatFieldName(key)}:</span>
                <span>{formatValue(value)}</span>
              </div>
            ))}
          </div>
        );
      }
      
      if (action === 'update') {
        return (
          <div className="space-y-2">
            <div className="font-medium text-blue-600">Citizen Record Updated</div>
            {details.old && details.new && (
              <div className="space-y-2">
                {Object.keys({...details.old, ...details.new}).map(key => {
                  const oldValue = details.old[key];
                  const newValue = details.new[key];
                  
                  // Special handling for specific fields
                  if (key === 'sex' || key === 'status') {
                    // For sex and status fields, we need special handling
                    // Sometimes these fields might appear the same in JSON but are actually different
                    // or they might be stored in different formats
                    
                    // Convert both to strings for comparison
                    const oldStr = String(oldValue).toLowerCase();
                    const newStr = String(newValue).toLowerCase();
                    
                    // Log for debugging
                    console.log(`Comparing ${key}: "${oldStr}" vs "${newStr}"`);
                    
                    // Only skip if they're exactly the same after normalization
                    if (oldStr === newStr) {
                      return null;
                    }
                    
                    // Highlight these important fields with a yellow background
                    return (
                      <div key={key} className="grid grid-cols-3 gap-2 text-sm bg-yellow-50 p-2 rounded border border-yellow-200">
                        <span className="font-medium text-gray-600">{formatFieldName(key)}:</span>
                        <span className="text-red-500 line-through">{formatValue(oldValue)}</span>
                        <span className="text-green-500">{formatValue(newValue)}</span>
                      </div>
                    );
                  }
                  
                  // For other fields, use the standard comparison
                  if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
                    return null;
                  }
                  
                  return (
                    <div key={key} className="grid grid-cols-3 gap-2 text-sm">
                      <span className="font-medium text-gray-600">{formatFieldName(key)}:</span>
                      <span className="text-red-500 line-through">{formatValue(oldValue)}</span>
                      <span className="text-green-500">{formatValue(newValue)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }
      
      if (action === 'delete') {
        return (
          <div className="space-y-2">
            <div className="font-medium text-red-600">Citizen Record Deleted</div>
            {details.old && Object.entries(details.old).map(([key, value]) => (
              <div key={key} className="grid grid-cols-2 gap-2 text-sm">
                <span className="font-medium text-gray-600">{formatFieldName(key)}:</span>
                <span>{formatValue(value)}</span>
              </div>
            ))}
          </div>
        );
      }
      
      // Fallback for other actions or if the format is unexpected
      return (
        <pre className="whitespace-pre-wrap font-mono text-xs overflow-auto max-h-40">
          {JSON.stringify(details, null, 2)}
        </pre>
      );
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
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between mb-4">
                  <div className="flex items-center space-x-2 mb-2 sm:mb-0">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionBadgeClass(log.action)}`}>
                      {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                    </span>
                    <span className="text-sm text-gray-500">Record ID: {log.record_id}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>{log.staff_name || 'System'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-md">
                  {formatChangeDetails(log.details, log.action)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AuditTrail;
