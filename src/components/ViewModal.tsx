import { format } from 'date-fns';
import { X, User, Calendar, MapPin, CreditCard, FileText, Shield, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getLatestAuditLog, AuditLog } from '../lib/audit';

interface Citizen {
  id: number;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  extension_name: string | null;
  birth_date: string;
  sex: 'Male' | 'Female';
  status: string;
  payment_date: string | null;
  remarks: string | null;
  osca_id: string;
  rrn: string;
  validator?: string | null;
  validation_date?: string | null;
  specimen?: 'signature' | 'thumbmark' | null;
  disability?: 'yes' | 'no' | null;
  indigenous_people?: 'yes' | 'no' | null;
  encoded_by: string | null;
  encoded_date: string;
  cleanlist_code: string | null;
}

interface AddressDetails {
  province_name: string;
  lgu_name: string;
  barangay_name: string;
}

interface ViewModalProps {
  citizen: Citizen;
  addressDetails: AddressDetails;
  onClose: () => void;
}

const LabelValue = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
    <span className="text-base text-gray-800 font-medium">{value}</span>
  </div>
);

function ViewModal({ citizen, addressDetails, onClose }: ViewModalProps) {
  const [auditLog, setAuditLog] = useState<AuditLog | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(true);

  useEffect(() => {
    const fetchAuditLog = async () => {
      setLoadingAudit(true);
      const log = await getLatestAuditLog('citizens', citizen.id.toString());
      setAuditLog(log);
      setLoadingAudit(false);
    };

    fetchAuditLog();
  }, [citizen.id]);

  const formatDate = (date: string | null, withTime = false) => {
    if (!date) return 'Not set';
    return format(new Date(date), withTime ? 'MMMM d, yyyy HH:mm:ss' : 'MMMM d, yyyy');
  };

  const fullName = `${citizen.last_name}, ${citizen.first_name}${citizen.middle_name ? ` ${citizen.middle_name}` : ''}${citizen.extension_name ? ` (${citizen.extension_name})` : ''}`;
  const address = `${addressDetails.barangay_name}, ${addressDetails.lgu_name}, ${addressDetails.province_name}`;

  const getEditorName = () => {
    if (loadingAudit) return 'Loading...';
    if (!auditLog || !auditLog.staff) return 'Unknown';
    
    const { first_name, last_name, middle_name } = auditLog.staff;
    return `${first_name}${middle_name ? ` ${middle_name.charAt(0)}.` : ''} ${last_name}`;
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-gradient-to-br from-black/40 via-black/30 to-black/40 backdrop-blur-md z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl animate-fadeIn max-h-[96vh] overflow-hidden flex flex-col">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Senior Citizen Details</h2>
              <p className="text-blue-100 text-sm">Complete information record</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 transition-all rounded-lg p-2"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="overflow-y-auto px-6 py-6 space-y-6">
          {/* Identification */}
          <Section title="Identification" icon={<CreditCard className="h-5 w-5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <LabelValue label="OSCA ID" value={<span className="font-mono text-blue-600">{citizen.osca_id}</span>} />
              <LabelValue label="RRN" value={<span className="font-mono text-blue-600">{citizen.rrn}</span>} />
            </div>
          </Section>

          {/* Personal Information */}
          <Section title="Personal Information" icon={<User className="h-5 w-5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <LabelValue label="Full Name" value={<span className="font-semibold text-gray-900">{fullName}</span>} />
              <LabelValue 
                label="Birth Date" 
                value={
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>{formatDate(citizen.birth_date)}</span>
                  </div>
                } 
              />
              <LabelValue
                label="Sex"
                value={
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium shadow-sm ${
                    citizen.sex === 'Male' 
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                      : 'bg-gradient-to-r from-pink-500 to-pink-600'
                  }`}>
                    {citizen.sex}
                  </span>
                }
              />
              <LabelValue 
                label="Address" 
                value={
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{address}</span>
                  </div>
                } 
              />
              <LabelValue
                label="Specimen"
                value={
                  citizen.specimen ? (
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-white text-sm font-medium shadow-sm ${
                      citizen.specimen === 'signature' 
                        ? 'bg-gradient-to-r from-purple-500 to-purple-600' 
                        : 'bg-gradient-to-r from-orange-500 to-orange-600'
                    }`}>
                      {citizen.specimen === 'signature' ? 'Signature' : 'Thumbmark'}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">Not specified</span>
                  )
                }
              />
              <LabelValue
                label="Disability"
                value={
                  citizen.disability ? (
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-white text-sm font-medium shadow-sm ${
                      citizen.disability === 'yes' 
                        ? 'bg-gradient-to-r from-red-500 to-red-600' 
                        : 'bg-gradient-to-r from-green-500 to-green-600'
                    }`}>
                      {citizen.disability === 'yes' ? 'Yes' : 'No'}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">Not specified</span>
                  )
                }
              />
              <LabelValue
                label="Indigenous People"
                value={
                  citizen.indigenous_people ? (
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-white text-sm font-medium shadow-sm ${
                      citizen.indigenous_people === 'yes' 
                        ? 'bg-gradient-to-r from-amber-600 to-amber-700' 
                        : 'bg-gradient-to-r from-gray-500 to-gray-600'
                    }`}>
                      {citizen.indigenous_people === 'yes' ? 'Yes' : 'No'}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">Not specified</span>
                  )
                }
              />
            </div>
          </Section>

          {/* Status Information */}
          <Section title="Status Information" icon={<Shield className="h-5 w-5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <LabelValue
                label="Status"
                value={
                  <span className="inline-flex items-center px-4 py-2 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 text-sm font-semibold capitalize border border-green-200 shadow-sm">
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                    {citizen.status}
                  </span>
                }
              />
              <LabelValue 
                label="Payment Date" 
                value={
                  citizen.payment_date ? (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{formatDate(citizen.payment_date)}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">Not set</span>
                  )
                } 
              />
              <LabelValue 
                label="Validator" 
                value={
                  citizen.validator ? (
                    <span className="text-gray-800">{citizen.validator}</span>
                  ) : (
                    <span className="text-gray-400 italic">Not validated</span>
                  )
                } 
              />
              <LabelValue 
                label="Validation Date" 
                value={
                  citizen.validation_date ? (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{formatDate(citizen.validation_date)}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">Not validated</span>
                  )
                } 
              />
            </div>
          </Section>

          {/* Record Information */}
          <Section title="Record Information" icon={<Info className="h-5 w-5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <LabelValue 
                label="Encoded By" 
                value={
                  citizen.encoded_by ? (
                    <span className="text-gray-800">{citizen.encoded_by}</span>
                  ) : (
                    <span className="text-gray-400 italic">Unknown</span>
                  )
                } 
              />
              <LabelValue 
                label="Encoded Date" 
                value={
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{formatDate(citizen.encoded_date, true)}</span>
                  </div>
                } 
              />
              <LabelValue 
                label="Last Modified By" 
                value={
                  <span className="text-gray-800">{getEditorName()}</span>
                } 
              />
              <LabelValue 
                label="Last Modified Date" 
                value={
                  loadingAudit ? (
                    <span className="text-gray-400 italic">Loading...</span>
                  ) : auditLog ? (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{formatDate(auditLog.created_at, true)}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">No modifications recorded</span>
                  )
                } 
              />
            </div>
          </Section>

          {/* Modification Details */}
          {!loadingAudit && auditLog && auditLog.details && auditLog.details.old && auditLog.details.new && (
            <Section title="Last Modification Details" icon={<Info className="h-5 w-5" />}>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-blue-800">Action:</span>
                    <span className="text-sm text-gray-700 capitalize">{auditLog.action}</span>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-blue-800 block mb-2">Modified Fields:</span>
                    <div className="space-y-2">
                      {Object.keys(auditLog.details.new).map((field) => {
                        const oldValue = auditLog.details.old[field];
                        const newValue = auditLog.details.new[field];
                        
                        // Skip if values are the same
                        if (oldValue === newValue) return null;
                        
                        // Skip certain fields
                        if (['id', 'created_at', 'calendar_year'].includes(field)) return null;
                        
                        return (
                          <div key={field} className="bg-white rounded-md p-3 border border-blue-100">
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">
                                {field.replace(/_/g, ' ')}:
                              </span>
                              <div className="flex-1 space-y-1">
                                <div className="text-sm">
                                  <span className="text-red-600 font-medium">Old: </span>
                                  <span className="text-gray-700">
                                    {oldValue === null || oldValue === '' ? '(empty)' : String(oldValue)}
                                  </span>
                                </div>
                                <div className="text-sm">
                                  <span className="text-green-600 font-medium">New: </span>
                                  <span className="text-gray-700">
                                    {newValue === null || newValue === '' ? '(empty)' : String(newValue)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }).filter(Boolean)}
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Remarks */}
          {citizen.remarks && (
            <Section title="Remarks" icon={<FileText className="h-5 w-5" />}>
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{citizen.remarks}</p>
              </div>
            </Section>
          )}

          {/* Cleanlist Code */}
          {citizen.cleanlist_code && (
            <Section title="Cleanlist Code" icon={<FileText className="h-5 w-5" />}>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 font-mono whitespace-pre-wrap">{citizen.cleanlist_code}</p>
              </div>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm hover:shadow"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const Section = ({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
      {icon && <div className="text-blue-600">{icon}</div>}
      <h3 className="text-lg font-bold text-gray-800">{title}</h3>
    </div>
    {children}
  </div>
);

export default ViewModal;
