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
  cleanlist_code: string;
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
  'REMARK M. SERDAN', 'JOVEN J. CALMA', 'IRENE A. MARTINEZ'
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

  const inputClass = "mt-1 block w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none hover:border-gray-300";
  const labelClass = "block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5";
  const sectionClass = "bg-gradient-to-br from-gray-50 to-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-black/40 to-black/60 backdrop-blur-sm p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl relative animate-fadeIn max-h-[95vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
              <span className="w-1.5 h-8 bg-white/80 rounded-full"></span>
              Edit Senior Citizen Record
            </h2>
            <p className="text-blue-100 text-sm">Update citizen information and status details</p>
          </div>
          <button 
            onClick={onClose} 
            className="absolute top-6 right-6 text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-2 transition-all duration-200 z-20"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-8 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identification */}
            <section className={sectionClass}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">ID</span>
                </div>
                <h3 className="text-lg font-bold text-gray-800">Identification</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
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
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">👤</span>
                </div>
                <h3 className="text-lg font-bold text-gray-800">Personal Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
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
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">📋</span>
                </div>
                <h3 className="text-lg font-bold text-gray-800">Status Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
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
                      className="px-4 py-2.5 text-sm font-medium text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border-2 border-red-200 hover:border-red-600 rounded-lg transition-all duration-200 flex-shrink-0"
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
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">📝</span>
                </div>
                <h3 className="text-lg font-bold text-gray-800">Additional Information</h3>
              </div>
              <div className="group">
                <label className={labelClass}>Remarks</label>
                <textarea
                  name="remarks"
                  value={formData.remarks || ''}
                  onChange={handleChange}
                  className={`${inputClass} resize-none`}
                  rows={4}
                  maxLength={500}
                  placeholder="Enter any additional notes or remarks..."
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500">Maximum 500 characters</p>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 rounded-full"
                        style={{ width: `${((formData.remarks?.length || 0) / 500 * 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium text-gray-600">{formData.remarks?.length || 0}/500</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Address */}
            <section className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">📍</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">Current Address</h3>
                  <p className="text-base text-gray-800 font-medium leading-relaxed">
                    {addressDetails.barangay_name}, {addressDetails.lgu_name}, {addressDetails.province_name}
                  </p>
                </div>
              </div>
            </section>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-8 py-5 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold rounded-lg border-2 border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            onClick={handleSubmit}
            className="px-8 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditModal;
