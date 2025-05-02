import { X, Phone, Mail } from 'lucide-react';
import { format } from 'date-fns';

interface StakeholderViewModalProps {
  stakeholder: {
    name: string;
    position_name: string;
    province_name: string;
    lgu_name?: string;
    barangay_name?: string;
    contacts: {
      type: 'phone' | 'email';
      value: string;
    }[];
    updated_at: string;
    updated_by: string | null;
  };
  onClose: () => void;
}

function StakeholderViewModal({ stakeholder, onClose }: StakeholderViewModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{stakeholder.name}</h2>
            <p className="text-lg text-blue-600 font-medium mt-1">{stakeholder.position_name}</p>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Location</h3>
              <div className="text-gray-900">
                <p>{stakeholder.province_name}</p>
                {stakeholder.lgu_name && <p>{stakeholder.lgu_name}</p>}
                {stakeholder.barangay_name && <p>{stakeholder.barangay_name}</p>}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Contact Information</h3>
              <div className="space-y-2">
                {stakeholder.contacts.map((contact, index) => (
                  <div key={index} className="flex items-center text-gray-900">
                    {contact.type === 'phone' ? (
                      <Phone className="h-4 w-4 text-gray-400 mr-2" />
                    ) : (
                      <Mail className="h-4 w-4 text-gray-400 mr-2" />
                    )}
                    {contact.value}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Last Updated</h3>
              <div className="text-gray-900">
                <p>{format(new Date(stakeholder.updated_at), 'MMMM d, yyyy HH:mm:ss')}</p>
                {stakeholder.updated_by && (
                  <p className="text-sm text-gray-500 mt-1">by {stakeholder.updated_by}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StakeholderViewModal;