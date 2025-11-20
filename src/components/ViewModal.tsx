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
  <div className="flex flex-col gap-1">
    <span className="text-[10px] md:text-xs font-medium text-gray-500 uppercase">{label}</span>
    <span className="text-sm md:text-base text-gray-900">{value}</span>
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
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 md:h-6 md:w-6 text-white" />
            <h2 className="text-lg md:text-xl font-bold text-white">Senior Citizen Details</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/90 hover:text-white p-2"
          >
            <X className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </div>

        {/* Content area */}
        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {/* Identification */}
          <Section title="Identification" icon={<CreditCard className="h-4 w-4 md:h-5 md:w-5" />}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <LabelValue label="OSCA ID" value={<span className="font-mono text-blue-600 text-sm md:text-base">{citizen.osca_id}</span>} />
              <LabelValue label="RRN" value={<span className="font-mono text-blue-600 text-sm md:text-base">{citizen.rrn}</span>} />
            </div>
          </Section>

          {/* Personal Information */}
          <Section title="Personal Information" icon={<User className="h-4 w-4 md:h-5 md:w-5" />}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="col-span-2">
                <LabelValue label="Full Name" value={<span className="font-semibold text-gray-900 text-sm md:text-base">{fullName}</span>} />
              </div>
              <LabelValue 
                label="Birth Date" 
                value={<span className="text-sm md:text-base">{formatDate(citizen.birth_date)}</span>} 
              />
              <LabelValue
                label="Sex"
                value={
                  <span className={`inline-block px-3 py-1 rounded text-white text-sm md:text-base font-medium ${
                    citizen.sex === 'Male' ? 'bg-blue-600' : 'bg-pink-600'
                  }`}>
                    {citizen.sex}
                  </span>
                }
              />
              <div className="col-span-2">
                <LabelValue 
                  label="Address" 
                  value={<span className="text-sm md:text-base">{address}</span>} 
                />
              </div>
              <LabelValue
                label="Specimen"
                value={
                  citizen.specimen ? (
                    <span className={`inline-block px-3 py-1 rounded text-white text-sm md:text-base ${
                      citizen.specimen === 'signature' ? 'bg-purple-600' : 'bg-orange-600'
                    }`}>
                      {citizen.specimen === 'signature' ? 'Signature' : 'Thumbmark'}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm md:text-base">N/A</span>
                  )
                }
              />
              <LabelValue
                label="Disability"
                value={
                  citizen.disability ? (
                    <span className={`inline-block px-3 py-1 rounded text-white text-sm md:text-base ${
                      citizen.disability === 'yes' ? 'bg-red-600' : 'bg-green-600'
                    }`}>
                      {citizen.disability === 'yes' ? 'Yes' : 'No'}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm md:text-base">N/A</span>
                  )
                }
              />
              <LabelValue
                label="Indigenous People"
                value={
                  citizen.indigenous_people ? (
                    <span className={`inline-block px-3 py-1 rounded text-white text-sm md:text-base ${
                      citizen.indigenous_people === 'yes' ? 'bg-amber-600' : 'bg-gray-600'
                    }`}>
                      {citizen.indigenous_people === 'yes' ? 'Yes' : 'No'}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm md:text-base">N/A</span>
                  )
                }
              />
            </div>
          </Section>

          {/* Status Information */}
          <Section title="Status Information" icon={<Shield className="h-4 w-4 md:h-5 md:w-5" />}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <LabelValue
                label="Status"
                value={
                  <span className="inline-block px-3 py-1 rounded bg-green-100 text-green-700 text-sm md:text-base font-medium capitalize border border-green-200">
                    {citizen.status}
                  </span>
                }
              />
              <LabelValue 
                label="Payment Date" 
                value={
                  citizen.payment_date ? (
                    <span className="text-sm md:text-base">{formatDate(citizen.payment_date)}</span>
                  ) : (
                    <span className="text-gray-400 text-sm md:text-base">Not set</span>
                  )
                } 
              />
              <LabelValue 
                label="Validator" 
                value={
                  citizen.validator ? (
                    <span className="text-sm md:text-base">{citizen.validator}</span>
                  ) : (
                    <span className="text-gray-400 text-sm md:text-base">N/A</span>
                  )
                } 
              />
              <LabelValue 
                label="Validation Date" 
                value={
                  citizen.validation_date ? (
                    <span className="text-sm md:text-base">{formatDate(citizen.validation_date)}</span>
                  ) : (
                    <span className="text-gray-400 text-sm md:text-base">N/A</span>
                  )
                } 
              />
            </div>
          </Section>

          {/* Record Information */}
          <Section title="Record Information" icon={<Info className="h-4 w-4 md:h-5 md:w-5" />}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <LabelValue 
                label="Encoded By" 
                value={<span className="text-sm md:text-base">{citizen.encoded_by || 'Unknown'}</span>} 
              />
              <LabelValue 
                label="Encoded Date" 
                value={<span className="text-sm md:text-base">{formatDate(citizen.encoded_date, true)}</span>} 
              />
              <LabelValue 
                label="Last Modified By" 
                value={<span className="text-sm md:text-base">{getEditorName()}</span>} 
              />
              <LabelValue 
                label="Last Modified Date" 
                value={
                  loadingAudit ? (
                    <span className="text-gray-400 text-sm md:text-base">Loading...</span>
                  ) : auditLog ? (
                    <span className="text-sm md:text-base">{formatDate(auditLog.created_at, true)}</span>
                  ) : (
                    <span className="text-gray-400 text-sm md:text-base">N/A</span>
                  )
                } 
              />
            </div>
          </Section>

          {/* Modification Details */}
          {!loadingAudit && auditLog && auditLog.details && auditLog.details.old && auditLog.details.new && (
            <Section title="Last Modification Details" icon={<Info className="h-4 w-4 md:h-5 md:w-5" />}>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs md:text-sm font-semibold text-blue-800">Action:</span>
                    <span className="text-xs md:text-sm text-gray-700 capitalize">{auditLog.action}</span>
                  </div>
                  <div>
                    <span className="text-xs md:text-sm font-semibold text-blue-800 block mb-2">Modified Fields:</span>
                    <div className="space-y-2">
                      {Object.keys(auditLog.details.new).map((field) => {
                        const oldValue = auditLog.details.old[field];
                        const newValue = auditLog.details.new[field];
                        
                        // Skip if values are the same
                        if (oldValue === newValue) return null;
                        
                        // Skip certain fields
                        if (['id', 'created_at', 'calendar_year'].includes(field)) return null;
                        
                        return (
                          <div key={field} className="bg-white rounded-lg p-3 border border-blue-100">
                            <div className="text-xs md:text-sm">
                              <span className="font-semibold text-gray-600 uppercase">{field.replace(/_/g, ' ')}:</span>
                              <div className="mt-1">
                                <span className="text-red-600">Old: {oldValue === null || oldValue === '' ? '(empty)' : String(oldValue)}</span>
                              </div>
                              <div className="mt-1">
                                <span className="text-green-600">New: {newValue === null || newValue === '' ? '(empty)' : String(newValue)}</span>
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
            <Section title="Remarks" icon={<FileText className="h-4 w-4 md:h-5 md:w-5" />}>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm md:text-base text-gray-700 whitespace-pre-wrap leading-relaxed">{citizen.remarks}</p>
              </div>
            </Section>
          )}

          {/* Cleanlist Code */}
          {citizen.cleanlist_code && (
            <Section title="Cleanlist Code" icon={<FileText className="h-4 w-4 md:h-5 md:w-5" />}>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm md:text-base text-gray-700 font-mono whitespace-pre-wrap leading-relaxed">{citizen.cleanlist_code}</p>
              </div>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm md:text-base font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const Section = ({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-4">
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
      {icon && <div className="text-blue-600">{icon}</div>}
      <h3 className="text-sm md:text-base font-bold text-gray-800">{title}</h3>
    </div>
    {children}
  </div>
);

export default ViewModal;
