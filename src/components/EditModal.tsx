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
  province_code: string;
  lgu_code: string;
  barangay_code: string;
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
  encoded_date: string;
  encoded_by: string | null;
  created_at: string;
  calendar_year: string;
  cleanlist_code: string | null;
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
  'REYMARK M. SERDAN', 'JOVEN J. CALMA', 'IRENE A. MARTINEZ'
];

function EditModal({ citizen, addressDetails, onClose, onSave }: EditModalProps) {
  const [formData, setFormData] = useState(citizen);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate remarks when status is "Compliance" or "Disqualified"
    if ((formData.status === 'Compliance' || formData.status === 'Disqualified') && (!formData.remarks || formData.remarks.trim() === '')) {
      setValidationError(`Remarks are required when status is "${formData.status}"`);
      return;
    }
    
    setValidationError('');
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

  const inputClass = "mt-1 block w-full rounded-lg border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none";
  const labelClass = "block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5";
  const sectionClass = "bg-gray-50 p-4 sm:p-6 rounded-lg border border-gray-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 overflow-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl relative max-h-[98vh] sm:max-h-[95vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-blue-600 px-4 sm:px-6 md:px-8 py-3 sm:py-4 relative">
          <div className="pr-8 sm:pr-0">
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-white">
              Edit Senior Citizen Record
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm">Update citizen information and status details</p>
          </div>
          <button 
            onClick={onClose} 
            className="absolute top-3 sm:top-4 right-3 sm:right-4 text-white/90 hover:text-white p-1.5 sm:p-2"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 md:px-8 py-4 sm:py-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Identification */}
            <section className={sectionClass}>
              <div className="flex items-center gap-2 sm:gap-3 mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm sm:text-base">ID</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-gray-800">Identification</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {['osca_id', 'rrn'].map((field) => (
                  <div key={field} className="group">
                    <label className={labelClass}>{field.replace('_', ' ')}</label>
                    <input
                      type="text"
                      name={field}
                      value={(formData as any)[field] || ''}
                      onChange={handleChange}
                      placeholder={`Enter ${field.toUpperCase()}`}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Personal Info */}
            <section className={sectionClass}>
              <div className="flex items-center gap-2 sm:gap-3 mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-green-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm sm:text-base">👤</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-gray-800">Personal Information</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {[
                  { label: 'Last Name', name: 'last_name' },
                  { label: 'First Name', name: 'first_name' },
                  { label: 'Middle Name', name: 'middle_name' },
                  { label: 'Extension Name', name: 'extension_name' },
                  { label: 'Birth Date', name: 'birth_date', type: 'date' }
                ].map(({ label, name, type = 'text' }) => (
                  <div key={name} className="group">
                    <label className={labelClass}>{label}</label>
                    <input
                      type={type}
                      name={name}
                      value={(formData as any)[name] || ''}
                      onChange={handleChange}
                      className={`${inputClass} ${formData.status !== 'Encoded' ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      required={name === 'last_name' || name === 'first_name' || name === 'birth_date'}
                      disabled={formData.status !== 'Encoded'}
                    />
                  </div>
                ))}
                <div className="group">
                  <label className={labelClass}>Sex</label>
                  <select
                    name="sex"
                    value={formData.sex}
                    onChange={handleChange}
                    className={`${inputClass} ${formData.status !== 'Encoded' ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    required
                    disabled={formData.status !== 'Encoded'}
                  >
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
                <div className="group">
                  <label className={labelClass}>Specimen</label>
                  <select
                    name="specimen"
                    value={formData.specimen || ''}
                    onChange={handleChange}
                    className={`${inputClass} ${formData.status !== 'Encoded' ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    disabled={formData.status !== 'Encoded'}
                  >
                    <option value="">Select...</option>
                    <option value="signature">Signature</option>
                    <option value="thumbmark">Thumbmark</option>
                  </select>
                </div>
                <div className="group">
                  <label className={labelClass}>Disability</label>
                  <select
                    name="disability"
                    value={formData.disability || ''}
                    onChange={handleChange}
                    className={`${inputClass} ${formData.status !== 'Encoded' ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    disabled={formData.status !== 'Encoded'}
                  >
                    <option value="">Select...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div className="group">
                  <label className={labelClass}>Indigenous People</label>
                  <select
                    name="indigenous_people"
                    value={formData.indigenous_people || ''}
                    onChange={handleChange}
                    className={`${inputClass} ${formData.status !== 'Encoded' ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    disabled={formData.status !== 'Encoded'}
                  >
                    <option value="">Select...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Status Info */}
            <section className={sectionClass}>
              <div className="flex items-center gap-2 sm:gap-3 mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-orange-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm sm:text-base">📋</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-gray-800">Status Information</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <div className="group">
                  <label className={labelClass}>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className={inputClass}
                    required
                  >
                    {['Encoded', 'Validated', 'Cleanlisted','Waitlisted', 'Paid', 'Unpaid', 'Compliance', 'Disqualified'].map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div className="group">
                  <label className={labelClass}>Payment Date</label>
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
                      className="px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-medium text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-lg flex-shrink-0"
                      title="Clear payment date"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="group">
                  <label className={labelClass}>Validator</label>
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
                <div className="group">
                  <label className={labelClass}>Validation Date</label>
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
            <section className={sectionClass}>
              <div className="flex items-center gap-2 sm:gap-3 mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-pink-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm sm:text-base">📝</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-gray-800">Additional Information</h3>
              </div>
              <div className="group">
                <label className={labelClass}>
                  Remarks
                  {(formData.status === 'Compliance' || formData.status === 'Disqualified') && (
                    <span className="text-red-600 ml-1">*</span>
                  )}
                </label>
                <textarea
                  name="remarks"
                  value={formData.remarks || ''}
                  onChange={handleChange}
                  className={`${inputClass} resize-none ${validationError ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                  rows={3}
                  maxLength={500}
                  placeholder={(formData.status === 'Compliance' || formData.status === 'Disqualified') ? `Remarks are required for ${formData.status} status...` : 'Enter any additional notes or remarks...'}
                />
                {validationError && (
                  <p className="mt-2 text-sm text-red-600 font-medium">{validationError}</p>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2">
                  <p className="text-xs text-gray-500">Maximum 500 characters</p>
                  <div className="flex items-center gap-2">
                    <div className="w-full sm:w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${((formData.remarks?.length || 0) / 500 * 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium text-gray-600">{formData.remarks?.length || 0}/500</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Address */}
            <section className="bg-blue-50 p-4 sm:p-6 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm sm:text-base">📍</span>
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wide mb-1 sm:mb-2">Current Address</h3>
                  <p className="text-sm sm:text-base text-gray-800 font-medium leading-relaxed">
                    {addressDetails.barangay_name}, {addressDetails.lgu_name}, {addressDetails.province_name}
                  </p>
                </div>
              </div>
            </section>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-4 sm:px-6 md:px-8 py-3 sm:py-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            onClick={handleSubmit}
            className="w-full sm:w-auto px-6 sm:px-8 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditModal;
