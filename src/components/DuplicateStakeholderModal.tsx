import { X } from 'lucide-react';

interface StakeholderData {
  name: string;
  position_id: number;
  province_code: string;
  lgu_code?: string | null;
  barangay_code?: string | null;
  contacts: {
    type: 'phone' | 'email';
    value: string;
  }[];
}

interface DuplicateStakeholderModalProps {
  newData: StakeholderData;
  existingData: StakeholderData;
  positionName: string;
  provinceName: string;
  lguName?: string;
  barangayName?: string;
  onClose: () => void;
  onUpdate: () => void;
  onCreateNew: () => void;
}

function DuplicateStakeholderModal({
  newData,
  existingData,
  positionName,
  provinceName,
  lguName,
  barangayName,
  onClose,
  onUpdate,
  onCreateNew
}: DuplicateStakeholderModalProps) {
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-red-600">Potential Duplicate Found</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="bg-yellow-50 p-4 rounded-md mb-6">
          <p className="text-yellow-800">
            A stakeholder with similar details already exists. Please review the information and choose how to proceed.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium mb-4">New Entry</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{newData.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Position</dt>
                <dd className="mt-1 text-sm text-gray-900">{positionName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Location</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {provinceName}
                  {lguName && <>, {lguName}</>}
                  {barangayName && <>, {barangayName}</>}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Contact Information</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {newData.contacts.map((contact, index) => (
                    <div key={index}>
                      {contact.type === 'phone' ? '📞 ' : '✉️ '}
                      {contact.value}
                    </div>
                  ))}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4">Existing Record</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{existingData.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Position</dt>
                <dd className="mt-1 text-sm text-gray-900">{positionName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Location</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {provinceName}
                  {lguName && <>, {lguName}</>}
                  {barangayName && <>, {barangayName}</>}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Contact Information</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {existingData.contacts.map((contact, index) => (
                    <div key={index}>
                      {contact.type === 'phone' ? '📞 ' : '✉️ '}
                      {contact.value}
                    </div>
                  ))}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="btn-outline">
            Cancel
          </button>
          <button onClick={onUpdate} className="btn-warning">
            Update Existing Record
          </button>
         
        </div>
      </div>
    </div>
  );
}

export default DuplicateStakeholderModal;