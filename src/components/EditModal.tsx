import { useState } from 'react';
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
  osca_id?: string | null;
  rrn?: string | null;
  validator?: string | null;
  validation_date?: string | null;
}

interface AddressDetails {
  province_name: string;
  lgu_name: string;
  barangay_name: string;
}

interface EditModalProps {
  citizen: Citizen;
  addressDetails: AddressDetails;
  onClose: () => void;
  onSave: (updatedCitizen: Citizen) => Promise<void>;
}

const VALIDATORS = [
  'JOCELYN O. TABOTABO', 'AGNES MODESTA V. SABALDAN', 'RALPH JIENE D. GREGORIO',
  'ALYSSA MARIE P. MARAÑA', 'MARIA RAISA D. GILLAMAC', 'HAIDEE O.TALILI',
  'MARY ANN G. POL', 'CANDELAR JANE V. MOJADO', 'JUVELYN C. GUMISAD',
  'REMARK M. SERDAN', 'JOVEN J. CALMA'
];

function EditModal({ citizen, addressDetails, onClose, onSave }: EditModalProps) {
  const [formData, setFormData] = useState(citizen);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearPaymentDate = () => {
    setFormData(prev => ({ ...prev, payment_date: null }));
  };

  const inputClass = "mt-1 block w-full rounded-md border border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 shadow-sm text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-3xl p-6 relative animate-fadeIn">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="h-6 w-6" />
        </button>

        <h2 className="text-2xl font-semibold text-gray-800 mb-6">Edit Senior Citizen Record</h2>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Identification */}
          <section>
            <h3 className="text-lg font-medium text-gray-700 mb-4">Identification</h3>
            <div className="grid grid-cols-2 gap-4">
              {['osca_id', 'rrn'].map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-600 capitalize">{field.replace('_', ' ')}</label>
                  <input
                    type="text"
                    name={field}
                    value={(formData as any)[field] || ''}
                    onChange={handleChange}
                    placeholder={`Enter ${field.toUpperCase()} (optional)`}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Personal Info */}
          <section>
            <h3 className="text-lg font-medium text-gray-700 mb-4">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Last Name', name: 'last_name' },
                { label: 'First Name', name: 'first_name' },
                { label: 'Middle Name', name: 'middle_name' },
                { label: 'Extension Name', name: 'extension_name' },
                { label: 'Birth Date', name: 'birth_date', type: 'date' }
              ].map(({ label, name, type = 'text' }) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-gray-600">{label}</label>
                  <input
                    type={type}
                    name={name}
                    value={(formData as any)[name] || ''}
                    onChange={handleChange}
                    className={inputClass}
                    required={name === 'last_name' || name === 'first_name' || name === 'birth_date'}
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-600">Sex</label>
                <select
                  name="sex"
                  value={formData.sex}
                  onChange={handleChange}
                  className={inputClass}
                  required
                >
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
            </div>
          </section>

          {/* Status Info */}
          <section>
            <h3 className="text-lg font-medium text-gray-700 mb-4">Status Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className={inputClass}
                  required
                >
                  {['Encoded', 'Validated', 'Cleanlisted', 'Paid', 'Unpaid', 'Liquidated', 'Disqualified'].map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Payment Date</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    name="payment_date"
                    value={formData.payment_date || ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={clearPaymentDate}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-red-600 border border-gray-300 rounded-md hover:border-red-300 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Validator</label>
                <select
                  name="validator"
                  value={formData.validator || ''}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Select Validator...</option>
                  {VALIDATORS.map(validator => (
                    <option key={validator} value={validator}>{validator}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Validation Date</label>
                <input
                  type="date"
                  name="validation_date"
                  value={formData.validation_date || ''}
                  onChange={handleChange}
                  className={inputClass}
                  max={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
            </div>
          </section>

          {/* Remarks */}
          <section>
            <h3 className="text-lg font-medium text-gray-700 mb-4">Additional Information</h3>
            <div>
              <label className="block text-sm font-medium text-gray-600">Remarks</label>
              <textarea
                name="remarks"
                value={formData.remarks || ''}
                onChange={handleChange}
                className={`${inputClass} resize-none`}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-400 mt-1">{((formData.remarks?.length || 0) / 500 * 100).toFixed(0)}% of 500 characters used</p>
            </div>
          </section>

          {/* Address */}
          <section className="bg-gray-100 p-4 rounded-md">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Current Address</h3>
            <p className="text-sm text-gray-700">{addressDetails.barangay_name}, {addressDetails.lgu_name}, {addressDetails.province_name}</p>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default EditModal;