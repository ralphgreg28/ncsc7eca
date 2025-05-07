import { format } from 'date-fns';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Citizen {
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  extension_name?: string | null;
  birth_date: string;
  sex: 'Male' | 'Female';
  
  province_code: string;
  lgu_code: string;
  barangay_code: string;

  osca_id?: string;
  rrn?: string;
  validator?: string | null;
  validation_date?: string | null;
  status?: string | null;
}

interface DuplicateModalProps {
  newRecord: Citizen;
  existingRecord: Citizen;
 
  addressDetails: {
    province_name: string;
    lgu_name: string;
    barangay_name: string;
  };
  
  newAddressDetails?: {
    province_name: string;
    lgu_name: string;
    barangay_name: string;
  };
  
  onClose: () => void;
  onProceed: () => void;
  onUpdate: () => void;
  matchedFields: string[];
}

function DuplicateModal({
  newRecord,
  existingRecord,
  addressDetails,
  newAddressDetails,
  onClose,
  onProceed,
  onUpdate,
  matchedFields
}: DuplicateModalProps) {
  const [newAddressNames, setNewAddressNames] = useState<{
    province_name: string;
    lgu_name: string;
    barangay_name: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Set default status for new entry to "Encoded"
  if (!newRecord.status) {
    newRecord.status = "Encoded";
  }

  useEffect(() => {
    // If newAddressDetails is already provided, use that
    if (newAddressDetails) {
      setNewAddressNames(newAddressDetails);
      return;
    }

    // Otherwise, fetch the address details from the database
    const fetchAddressDetails = async () => {
      setIsLoading(true);
      try {
        // Fetch province, lgu, and barangay details
        const [
          { data: provinceData },
          { data: lguData },
          { data: barangayData }
        ] = await Promise.all([
          supabase.from('provinces').select('code, name').eq('code', newRecord.province_code).single(),
          supabase.from('lgus').select('code, name').eq('code', newRecord.lgu_code).single(),
          supabase.from('barangays').select('code, name').eq('code', newRecord.barangay_code).single()
        ]);

        setNewAddressNames({
          province_name: provinceData?.name || newRecord.province_code,
          lgu_name: lguData?.name || newRecord.lgu_code,
          barangay_name: barangayData?.name || newRecord.barangay_code
        });
      } catch (error) {
        console.error('Error fetching address details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAddressDetails();
  }, [newRecord, newAddressDetails]);

  const formatDate = (date: string) => format(new Date(date), 'MMMM d, yyyy');

  const getFieldStyle = (field: string) => {
    return matchedFields.includes(field) ? 'bg-yellow-100' : '';
  };

  // CSS styles for status badges
  const getStatusStyle = (status: string | null | undefined) => {
    if (!status) return {};
    
    const statusLower = status.toLowerCase();
    if (statusLower === 'encoded') return { backgroundColor: '#87CEEB', color: 'white' };
    if (statusLower === 'validated') return { backgroundColor: '#28A745', color: 'white' };
    if (statusLower === 'cleanlisted') return { backgroundColor: '#008080', color: 'white' };
    if (statusLower === 'paid') return { backgroundColor: '#006400', color: 'white' };
    if (statusLower === 'unpaid') return { backgroundColor: '#FFA500', color: 'white' };
    if (statusLower === 'liquidated') return { backgroundColor: '#DC3545', color: 'white' };
    if (statusLower === 'disqualified') return { backgroundColor: '#808080', color: 'white' };
    
    return {};
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="relative bg-white rounded-lg max-w-6xl w-full mx-auto shadow-xl">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-red-600">Potential Duplicate Found</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="mb-3 p-3 bg-yellow-50 rounded-md">
              <p className="text-yellow-800">
                A potential duplicate record has been found. Please review the information below and choose how to proceed.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-lg text-gray-900">New Entry</h4>
                <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-2">
                  <div className={`p-2 rounded ${getFieldStyle('last_name')}`}>
                    <span className="text-sm text-gray-500">Last Name</span>
                    <p className="font-medium">{newRecord.last_name}</p>
                  </div>
                  <div className={`p-2 rounded ${getFieldStyle('first_name')}`}>
                    <span className="text-sm text-gray-500">First Name</span>
                    <p className="font-medium">{newRecord.first_name}</p>
                  </div>
                  <div className={`p-2 rounded ${getFieldStyle('middle_name')}`}>
                    <span className="text-sm text-gray-500">Middle Name</span>
                    <p className="font-medium">{newRecord.middle_name || '-'}</p>
                  </div>
                  <div className="p-2 rounded">
                    <span className="text-sm text-gray-500">Extension Name</span>
                    <p className="font-medium">{newRecord.extension_name || '-'}</p>
                  </div>
                  <div className={`p-2 rounded ${getFieldStyle('birth_date')}`}>
                    <span className="text-sm text-gray-500">Birth Date</span>
                    <p className="font-medium">{formatDate(newRecord.birth_date)}</p>
                  </div>
                  <div className="p-2 rounded">
                    <span className="text-sm text-gray-500">Sex</span>
                    <p className="font-medium">{newRecord.sex}</p>
                  </div>
                  <div className="p-2 rounded">
                    <span className="text-sm text-gray-500">Address</span>
                    <p className="font-medium">
                      {isLoading ? (
                        "Loading address details..."
                      ) : newAddressNames ? (
                        `${newAddressNames.barangay_name}, ${newAddressNames.lgu_name}, ${newAddressNames.province_name}`
                      ) : (
                        `${newRecord.barangay_code}, ${newRecord.lgu_code}, ${newRecord.province_code}`
                      )}
                    </p>
                  </div>
                  <div className="p-2 rounded">
                    <span className="text-sm text-gray-500">OSCA ID</span>
                    <p className="font-medium">{newRecord.osca_id || 'N/A'}</p>
                  </div>
                  <div className="p-2 rounded">
                    <span className="text-sm text-gray-500">RRN</span>
                    <p className="font-medium">{newRecord.rrn || 'N/A'}</p>
                  </div>
                  <div className="p-2 rounded">
                    <span className="text-sm text-gray-500">Status</span>
                    <p 
                      className="font-medium px-2 py-1 rounded-full text-center text-sm"
                      style={getStatusStyle(newRecord.status)}
                    >
                      {newRecord.status || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-lg text-gray-900">Existing Record</h4>
                <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-2">
                  <div className={`p-2 rounded ${getFieldStyle('last_name')}`}>
                    <span className="text-sm text-gray-500">Last Name</span>
                    <p className="font-medium">{existingRecord.last_name}</p>
                  </div>
                  <div className={`p-2 rounded ${getFieldStyle('first_name')}`}>
                    <span className="text-sm text-gray-500">First Name</span>
                    <p className="font-medium">{existingRecord.first_name}</p>
                  </div>
                  <div className={`p-2 rounded ${getFieldStyle('middle_name')}`}>
                    <span className="text-sm text-gray-500">Middle Name</span>
                    <p className="font-medium">{existingRecord.middle_name || '-'}</p>
                  </div>
                  <div className="p-2 rounded">
                    <span className="text-sm text-gray-500">Extension Name</span>
                    <p className="font-medium">{existingRecord.extension_name || '-'}</p>
                  </div>
                  <div className={`p-2 rounded ${getFieldStyle('birth_date')}`}>
                    <span className="text-sm text-gray-500">Birth Date</span>
                    <p className="font-medium">{formatDate(existingRecord.birth_date)}</p>
                  </div>
                  <div className="p-2 rounded">
                    <span className="text-sm text-gray-500">Sex</span>
                    <p className="font-medium">{existingRecord.sex}</p>
                  </div>
                  <div className="p-2 rounded">
                    <span className="text-sm text-gray-500">Address</span>
                    <p className="font-medium">
                      {addressDetails.barangay_name}, {addressDetails.lgu_name}, {addressDetails.province_name}
                    </p>
                  </div>
                  <div className="p-2 rounded">
                    <span className="text-sm text-gray-500">OSCA ID</span>
                    <p className="font-medium">{existingRecord.osca_id || 'N/A'}</p>
                  </div>
                  <div className="p-2 rounded">
                    <span className="text-sm text-gray-500">RRN</span>
                    <p className="font-medium">{existingRecord.rrn || 'N/A'}</p>
                  </div>
                  <div className="p-2 rounded">
                    <span className="text-sm text-gray-500">Status</span>
                    <p 
                      className="font-medium px-2 py-1 rounded-full text-center text-sm"
                      style={getStatusStyle(existingRecord.status)}
                    >
                      {existingRecord.status || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 bg-gray-50 rounded-b-lg flex justify-end space-x-3">
            <button onClick={onClose} className="btn-outline">
              Cancel & Edit
            </button>
            <button onClick={onUpdate} className="btn-warning">
              Update Existing Record
            </button>
            <button onClick={onProceed} className="btn-primary">
              Save as New Record
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DuplicateModal;
