import { format } from 'date-fns';
import { X } from 'lucide-react';

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
    <span className="text-sm font-medium text-gray-500">{label}</span>
    <span className="text-base text-gray-900">{value}</span>
  </div>
);

function ViewModal({ citizen, addressDetails, onClose }: ViewModalProps) {
  const formatDate = (date: string | null, withTime = false) => {
    if (!date) return 'Not set';
    return format(new Date(date), withTime ? 'MMMM d, yyyy HH:mm:ss' : 'MMMM d, yyyy');
  };

  const fullName = `${citizen.last_name}, ${citizen.first_name}${citizen.middle_name ? ` ${citizen.middle_name}` : ''}${citizen.extension_name ? ` (${citizen.extension_name})` : ''}`;
  const address = `${addressDetails.barangay_name}, ${addressDetails.lgu_name}, ${addressDetails.province_name}`;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-8 animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Senior Citizen Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-7 w-7" />
          </button>
        </div>

        <div className="space-y-8">
          {/* Identification */}
          <Section title="Identification">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <LabelValue label="OSCA ID" value={citizen.osca_id} />
              <LabelValue label="RRN" value={citizen.rrn} />
            </div>
          </Section>

          {/* Personal Information */}
          <Section title="Personal Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <LabelValue label="Full Name" value={fullName} />
              <LabelValue label="Birth Date" value={formatDate(citizen.birth_date)} />
              <LabelValue
                label="Sex"
                value={
                  <span className={`inline-block px-3 py-1 rounded-full text-white text-sm ${citizen.sex === 'Male' ? 'bg-blue-500' : 'bg-pink-500'}`}>
                    {citizen.sex}
                  </span>
                }
              />
              <LabelValue label="Address" value={address} />
              <LabelValue
                label="Specimen"
                value={
                  citizen.specimen ? (
                    <span className={`inline-block px-3 py-1 rounded-full text-white text-sm ${citizen.specimen === 'signature' ? 'bg-purple-500' : 'bg-orange-500'}`}>
                      {citizen.specimen === 'signature' ? 'Signature' : 'Thumbmark'}
                    </span>
                  ) : (
                    'Not specified'
                  )
                }
              />
              <LabelValue
                label="Disability"
                value={
                  citizen.disability ? (
                    <span className={`inline-block px-3 py-1 rounded-full text-white text-sm ${citizen.disability === 'yes' ? 'bg-red-500' : 'bg-green-500'}`}>
                      {citizen.disability === 'yes' ? 'Yes' : 'No'}
                    </span>
                  ) : (
                    'Not specified'
                  )
                }
              />
              <LabelValue
                label="Indigenous People"
                value={
                  citizen.indigenous_people ? (
                    <span className={`inline-block px-3 py-1 rounded-full text-white text-sm ${citizen.indigenous_people === 'yes' ? 'bg-amber-600' : 'bg-gray-500'}`}>
                      {citizen.indigenous_people === 'yes' ? 'Yes' : 'No'}
                    </span>
                  ) : (
                    'Not specified'
                  )
                }
              />
            </div>
          </Section>

          {/* Status Information */}
          <Section title="Status Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <LabelValue
                label="Status"
                value={
                  <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm capitalize">
                    {citizen.status}
                  </span>
                }
              />
              <LabelValue label="Payment Date" value={citizen.payment_date ? formatDate(citizen.payment_date) : 'Not set'} />
              <LabelValue label="Validator" value={citizen.validator || 'Not validated'} />
              <LabelValue label="Validation Date" value={citizen.validation_date ? formatDate(citizen.validation_date) : 'Not validated'} />
            </div>
          </Section>

          {/* Record Information */}
          <Section title="Record Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <LabelValue label="Encoded By" value={citizen.encoded_by || 'Unknown'} />
              <LabelValue label="Encoded Date" value={formatDate(citizen.encoded_date, true)} />
            </div>
          </Section>

          {/* Remarks */}
          {citizen.remarks && (
            <Section title="Remarks">
              <p className="text-base text-gray-800 whitespace-pre-wrap">{citizen.remarks}</p>
            </Section>
          )}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-lg font-semibold text-gray-700 mb-4">{title}</h3>
    {children}
  </div>
);

export default ViewModal;
