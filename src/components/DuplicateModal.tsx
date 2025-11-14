import { format } from 'date-fns';
import { X, AlertTriangle, User, Calendar, MapPin, Hash, CheckCircle2, FileText, Save, Edit3, MessageSquare } from 'lucide-react';
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
  encoded_by?: string | null;
  created_at?: string | null;
  status?: string | null;
  remarks?: string | null;
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
    return matchedFields.includes(field) 
      ? 'bg-amber-50 border-l-4 border-amber-400 shadow-sm' 
      : 'bg-gray-50 hover:bg-gray-100 transition-colors';
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
    if (statusLower === 'compliance') return { backgroundColor: '#DC3545', color: 'white' };
    if (statusLower === 'disqualified') return { backgroundColor: '#808080', color: 'white' };
    if (statusLower === 'waitlisted') return { backgroundColor: '#28A745', color: 'white' };
    
    return {};
  };

  const FieldRow = ({ 
    label, 
    value, 
    field, 
    icon: Icon 
  }: { 
    label: string; 
    value: string | null | undefined; 
    field?: string;
    icon?: React.ElementType;
  }) => (
    <div className={`p-1.5 rounded ${field ? getFieldStyle(field) : 'bg-gray-50'}`}>
      <div className="flex items-center gap-1 mb-0">
        {Icon && <Icon size={11} className="text-gray-500" />}
        <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-semibold text-gray-900 text-xs ml-3">{value || '-'}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="flex items-center justify-center h-screen px-4 py-4">
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity backdrop-blur-sm" 
          onClick={onClose}
        ></div>

        <div className="relative bg-white rounded-xl w-[92vw] xl:w-[88vw] 2xl:w-[85vw] max-w-[2200px] max-h-[94vh] shadow-2xl transform transition-all flex flex-col">
          {/* Header */}
          <div className="px-6 py-2.5 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50 flex-shrink-0 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-red-100 rounded-lg">
                  <AlertTriangle className="text-red-600" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-700">Potential Duplicate Detected</h3>
                  <p className="text-xs text-red-600">Review and resolve duplicate record</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Alert Banner */}
          <div className="px-6 py-2 flex-shrink-0 border-b border-gray-100">
            <div className="flex items-start gap-2 p-2.5 bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-400 rounded-lg shadow-sm">
              <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
              <div className="flex-1">
                <p className="text-xs font-medium text-amber-900">
                  A record with similar information already exists in the database. Please carefully review both records below and choose the appropriate action.
                  {matchedFields.length > 0 && (
                    <span className="font-semibold"> Highlighted fields indicate matching data.</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Comparison Grid */}
          <div className="px-6 py-3 overflow-y-auto custom-scrollbar flex-1">
            <div className="grid grid-cols-2 gap-5">
              {/* New Entry */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 pb-1.5 border-b-2 border-blue-200 mb-2 flex-shrink-0">
                  <div className="p-1 bg-blue-100 rounded">
                    <Edit3 size={14} className="text-blue-600" />
                  </div>
                  <h4 className="text-base font-bold text-blue-700">New Entry</h4>
                  <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    Pending
                  </span>
                </div>
                <div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <FieldRow 
                      label="Last Name" 
                      value={newRecord.last_name} 
                      field="last_name"
                      icon={User}
                    />
                    <FieldRow 
                      label="First Name" 
                      value={newRecord.first_name} 
                      field="first_name"
                      icon={User}
                    />
                    <FieldRow 
                      label="Middle Name" 
                      value={newRecord.middle_name} 
                      field="middle_name"
                      icon={User}
                    />
                    <FieldRow 
                      label="Extension" 
                      value={newRecord.extension_name}
                      icon={User}
                    />
                    <FieldRow 
                      label="Birth Date" 
                      value={formatDate(newRecord.birth_date)} 
                      field="birth_date"
                      icon={Calendar}
                    />
                    <FieldRow 
                      label="Sex" 
                      value={newRecord.sex}
                      icon={User}
                    />
                    <div className="col-span-2 p-2 rounded-md bg-gray-50">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <MapPin size={12} className="text-gray-500" />
                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Address</span>
                      </div>
                      <p className="font-semibold text-gray-900 text-sm ml-4">
                        {isLoading ? (
                          <span className="text-gray-400">Loading...</span>
                        ) : newAddressNames ? (
                          `${newAddressNames.barangay_name}, ${newAddressNames.lgu_name}, ${newAddressNames.province_name}`
                        ) : (
                          `${newRecord.barangay_code}, ${newRecord.lgu_code}, ${newRecord.province_code}`
                        )}
                      </p>
                    </div>
                    <FieldRow 
                      label="OSCA ID" 
                      value={newRecord.osca_id || 'N/A'}
                      icon={Hash}
                    />
                    <FieldRow 
                      label="RRN" 
                      value={newRecord.rrn || 'N/A'}
                      icon={FileText}
                    />
                    <div className="col-span-2 p-2 rounded-md bg-gray-50">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <CheckCircle2 size={12} className="text-gray-500" />
                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Status</span>
                      </div>
                      <div className="ml-4">
                        <span 
                          className="inline-block font-semibold px-2.5 py-1 rounded-full text-xs shadow-sm"
                          style={getStatusStyle(newRecord.status)}
                        >
                          {newRecord.status || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <FieldRow 
                      label="Validator" 
                      value={newRecord.validator || 'N/A'}
                      icon={User}
                    />
                    <FieldRow 
                      label="Date Validated" 
                      value={newRecord.validation_date ? formatDate(newRecord.validation_date) : 'N/A'}
                      icon={Calendar}
                    />
                    <FieldRow 
                      label="Encoded By" 
                      value={newRecord.encoded_by || 'N/A'}
                      icon={User}
                    />
                    <FieldRow 
                      label="Date Encoded" 
                      value={newRecord.created_at ? formatDate(newRecord.created_at) : 'N/A'}
                      icon={Calendar}
                    />
                    <div className="col-span-2 p-2 rounded-md bg-gray-50">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <MessageSquare size={12} className="text-gray-500" />
                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Remarks</span>
                      </div>
                      <p className="font-semibold text-gray-900 text-sm ml-4 whitespace-pre-wrap break-words">
                        {newRecord.remarks || 'No remarks'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="absolute left-1/2 top-28 bottom-20 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent"></div>

              {/* Existing Record */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 pb-1.5 border-b-2 border-green-200 mb-2 flex-shrink-0">
                  <div className="p-1 bg-green-100 rounded">
                    <FileText size={14} className="text-green-600" />
                  </div>
                  <h4 className="text-base font-bold text-green-700">Existing Record</h4>
                  <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    In Database
                  </span>
                </div>
                <div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <FieldRow 
                      label="Last Name" 
                      value={existingRecord.last_name} 
                      field="last_name"
                      icon={User}
                    />
                    <FieldRow 
                      label="First Name" 
                      value={existingRecord.first_name} 
                      field="first_name"
                      icon={User}
                    />
                    <FieldRow 
                      label="Middle Name" 
                      value={existingRecord.middle_name} 
                      field="middle_name"
                      icon={User}
                    />
                    <FieldRow 
                      label="Extension" 
                      value={existingRecord.extension_name}
                      icon={User}
                    />
                    <FieldRow 
                      label="Birth Date" 
                      value={formatDate(existingRecord.birth_date)} 
                      field="birth_date"
                      icon={Calendar}
                    />
                    <FieldRow 
                      label="Sex" 
                      value={existingRecord.sex}
                      icon={User}
                    />
                    <div className="col-span-2 p-2 rounded-md bg-gray-50">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <MapPin size={12} className="text-gray-500" />
                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Address</span>
                      </div>
                      <p className="font-semibold text-gray-900 text-sm ml-4">
                        {addressDetails.barangay_name}, {addressDetails.lgu_name}, {addressDetails.province_name}
                      </p>
                    </div>
                    <FieldRow 
                      label="OSCA ID" 
                      value={existingRecord.osca_id || 'N/A'}
                      icon={Hash}
                    />
                    <FieldRow 
                      label="RRN" 
                      value={existingRecord.rrn || 'N/A'}
                      icon={FileText}
                    />
                    <div className="col-span-2 p-2 rounded-md bg-gray-50">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <CheckCircle2 size={12} className="text-gray-500" />
                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Status</span>
                      </div>
                      <div className="ml-4">
                        <span 
                          className="inline-block font-semibold px-2.5 py-1 rounded-full text-xs shadow-sm"
                          style={getStatusStyle(existingRecord.status)}
                        >
                          {existingRecord.status || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <FieldRow 
                      label="Validator" 
                      value={existingRecord.validator || 'N/A'}
                      icon={User}
                    />
                    <FieldRow 
                      label="Date Validated" 
                      value={existingRecord.validation_date ? formatDate(existingRecord.validation_date) : 'N/A'}
                      icon={Calendar}
                    />
                    <FieldRow 
                      label="Encoded By" 
                      value={existingRecord.encoded_by || 'N/A'}
                      icon={User}
                    />
                    <FieldRow 
                      label="Date Encoded" 
                      value={existingRecord.created_at ? formatDate(existingRecord.created_at) : 'N/A'}
                      icon={Calendar}
                    />
                    <div className="col-span-2 p-2 rounded-md bg-gray-50">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <MessageSquare size={12} className="text-gray-500" />
                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Remarks</span>
                      </div>
                      <p className="font-semibold text-gray-900 text-sm ml-4 whitespace-pre-wrap break-words">
                        {existingRecord.remarks || 'No remarks'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-2.5 bg-gray-50 rounded-b-xl border-t border-gray-200 flex-shrink-0">
            <div className="flex flex-row gap-2 justify-end">
              <button 
                onClick={onClose} 
                className="btn-outline flex items-center justify-center gap-2 group px-4 py-2"
              >
                <X size={16} className="group-hover:rotate-90 transition-transform" />
                <span className="text-sm">Cancel & Edit</span>
              </button>
              {existingRecord.status?.toLowerCase() !== 'paid' && (
                <button 
                  onClick={onUpdate} 
                  className="btn-warning flex items-center justify-center gap-2 group px-4 py-2"
                >
                  <Edit3 size={16} className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm">Update Existing Record</span>
                </button>
              )}
              <button 
                onClick={onProceed} 
                className="btn-primary flex items-center justify-center gap-2 group px-4 py-2"
              >
                <Save size={16} className="group-hover:scale-110 transition-transform" />
                <span className="text-sm">Save as New Record</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}

export default DuplicateModal;
