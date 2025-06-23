import { useState, useCallback, useRef } from 'react';
import { Upload, X, Check, AlertTriangle, FileText, Info, Database, RefreshCw, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'react-toastify';
import { supabase } from '../lib/supabase';

// Types
interface AddressRow {
  regionCode: string;
  regionName: string;
  provinceCode: string;
  provinceName: string;
  lguCode: string;
  lguName: string;
  barangayCode: string;
  barangayName: string;
}

interface ValidationStats {
  regions: number;
  provinces: number;
  lgus: number;
  barangays: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  stats: ValidationStats;
}

interface ParseResult {
  rows: AddressRow[];
  errors: Papa.ParseError[];
}

type UploadStatus = 'idle' | 'validating' | 'confirming' | 'uploading' | 'success' | 'error';

interface UploadProgress {
  stage: 'regions' | 'provinces' | 'lgus' | 'barangays' | 'complete';
  current: number;
  total: number;
  percentage: number;
}

interface ChangeStats {
  regions: number;
  provinces: number;
  lgus: number;
  barangays: number;
  total: number;
}

interface NewAddressStats {
  regions: number;
  provinces: number;
  lgus: number;
  barangays: number;
  total: number;
}

// File icon component
function FileIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h2" />
      <path d="M8 17h2" />
      <path d="M14 13h2" />
      <path d="M14 17h2" />
    </svg>
  );
}

// Component for the file upload area
const FileUploadArea = ({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  file,
  setFile,
  fileInputRef,
  handleBrowseClick,
  handleFileInputChange,
  uploadStatus,
  validation,
  parseResults,
  setParseResults,
  setValidation,
  setUploadStatus
}: {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  file: File | null;
  setFile: React.Dispatch<React.SetStateAction<File | null>>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleBrowseClick: () => void;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadStatus: UploadStatus;
  validation: ValidationResult;
  parseResults: ParseResult;
  setParseResults: React.Dispatch<React.SetStateAction<ParseResult>>;
  setValidation: React.Dispatch<React.SetStateAction<ValidationResult>>;
  setUploadStatus: React.Dispatch<React.SetStateAction<UploadStatus>>;
}) => {
  return (
    <div 
      className={`border-2 border-dashed rounded-lg p-8 text-center ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      } ${file ? 'bg-gray-50' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".csv"
        onChange={handleFileInputChange}
        aria-label="Upload CSV file"
      />
      
      {!file ? (
        <div className="space-y-4">
          <Upload className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true" />
          <div className="text-lg font-medium text-gray-900">
            Drop your CSV file here, or <button 
              onClick={handleBrowseClick} 
              className="text-blue-600 hover:text-blue-700 focus:outline-none focus:underline"
              aria-label="Browse for CSV file"
            >
              browse
            </button>
          </div>
          <p className="text-sm text-gray-500">
            CSV should include: regionCode, regionName, provinceCode, provinceName, lguCode, lguName, barangayCode, barangayName
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="mr-4">
              <FileIcon className="h-12 w-12 text-gray-500" aria-hidden="true" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setParseResults({ rows: [], errors: [] });
                setValidation({ valid: false, errors: [], stats: { regions: 0, provinces: 0, lgus: 0, barangays: 0 } });
                setUploadStatus('idle');
              }}
              className="ml-4 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full p-1"
              aria-label="Remove file"
            >
              <X size={20} />
            </button>
          </div>
          
          {uploadStatus === 'validating' ? (
            <div className="text-center">
              <p className="text-sm text-gray-600">Validating file...</p>
              <div className="mt-2 animate-pulse flex justify-center">
                <div className="h-2 w-24 bg-blue-300 rounded"></div>
              </div>
            </div>
          ) : validation.valid ? (
            <div className="bg-green-50 p-3 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Check className="h-5 w-5 text-green-500" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">File is valid</p>
                  <div className="mt-2 text-sm text-green-700">
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Regions: {validation.stats.regions}</li>
                      <li>Provinces: {validation.stats.provinces}</li>
                      <li>LGUs: {validation.stats.lgus}</li>
                      <li>Barangays: {validation.stats.barangays}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : parseResults.rows.length > 0 ? (
            <div className="bg-red-50 p-3 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">Validation failed</p>
                  <div className="mt-2 text-sm text-red-700">
                    <ul className="list-disc pl-5 space-y-1 max-h-40 overflow-y-auto">
                      {validation.errors.slice(0, 10).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {validation.errors.length > 10 && (
                        <li>...and {validation.errors.length - 10} more errors</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

// Component for the instructions panel
const InstructionsPanel = () => {
  return (
    <div className="bg-gray-50 p-4 rounded-md">
      <div className="flex items-center mb-3">
        <Info size={16} className="text-gray-500 mr-2" aria-hidden="true" />
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Instructions</h3>
      </div>
      <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
        <li>Prepare a CSV file with the required columns</li>
        <li>The system will update address names based on their codes</li>
        <li>Administrator confirmation is required before proceeding</li>
        <li>Ensure data integrity by checking for duplicates and proper relationships</li>
        <li>Region codes must be unique across regions</li>
        <li>Province codes must be unique across provinces</li>
        <li>LGU codes must be unique across LGUs</li>
        <li>Barangay codes must be unique across barangays</li>
      </ul>
    </div>
  );
};

// Confirmation modal component
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  stats: ChangeStats;
}

const ConfirmationModal = ({ isOpen, onClose, onConfirm, stats }: ConfirmationModalProps) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center mb-4">
          <AlertCircle className="h-6 w-6 text-amber-500 mr-3" aria-hidden="true" />
          <h3 className="text-lg font-medium text-gray-900">Confirm Address Update</h3>
        </div>
        
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-4">
            You are about to update the names of addresses based on their codes. This will affect:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
            <li>{stats.regions} regions</li>
            <li>{stats.provinces} provinces</li>
            <li>{stats.lgus} LGUs</li>
            <li>{stats.barangays} barangays</li>
          </ul>
          <p className="text-sm text-gray-600 mt-4">
            Are you sure you want to proceed with this update?
          </p>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Confirm Update
          </button>
        </div>
      </div>
    </div>
  );
};

// New address confirmation modal component
interface NewAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  stats: NewAddressStats;
}

const NewAddressModal = ({ isOpen, onClose, onConfirm, stats }: NewAddressModalProps) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center mb-4">
          <AlertCircle className="h-6 w-6 text-green-500 mr-3" aria-hidden="true" />
          <h3 className="text-lg font-medium text-gray-900">Confirm New Address Upload</h3>
        </div>
        
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-4">
            You are about to add new addresses to the database. This will create:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
            <li>{stats.regions} new regions</li>
            <li>{stats.provinces} new provinces</li>
            <li>{stats.lgus} new LGUs</li>
            <li>{stats.barangays} new barangays</li>
          </ul>
          <p className="text-sm text-gray-600 mt-4">
            Are you sure you want to proceed with adding these new addresses?
          </p>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Confirm Upload
          </button>
        </div>
      </div>
    </div>
  );
};

// Component for the upload progress
const UploadProgressIndicator = ({ progress }: { progress: UploadProgress | null }) => {
  if (!progress) return null;
  
  return (
    <div className="mt-4 bg-blue-50 p-4 rounded-md">
      <div className="flex items-center mb-2">
        <Database size={16} className="text-blue-500 mr-2" aria-hidden="true" />
        <h3 className="text-sm font-medium text-blue-700">
          Uploading {progress.stage} ({progress.current} of {progress.total})
        </h3>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className="bg-blue-600 h-2.5 rounded-full" 
          style={{ width: `${progress.percentage}%` }}
          role="progressbar"
          aria-valuenow={progress.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        ></div>
      </div>
    </div>
  );
};

function AddressManagement() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parseResults, setParseResults] = useState<ParseResult>({
    rows: [],
    errors: []
  });
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [validation, setValidation] = useState<ValidationResult>({
    valid: false,
    errors: [],
    stats: {
      regions: 0,
      provinces: 0,
      lgus: 0,
      barangays: 0
    }
  });
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [changeStats, setChangeStats] = useState<ChangeStats>({
    regions: 0,
    provinces: 0,
    lgus: 0,
    barangays: 0,
    total: 0
  });
  
  const [isNewAddressModalOpen, setIsNewAddressModalOpen] = useState(false);
  const [newAddressStats, setNewAddressStats] = useState<NewAddressStats>({
    regions: 0,
    provinces: 0,
    lgus: 0,
    barangays: 0,
    total: 0
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length) {
      handleFile(files[0]);
    }
  }, []);
  
  const handleFile = (file: File) => {
    // Check file type
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }
    
    setFile(file);
    parseCSV(file);
  };
  
  /**
   * Parses and validates a CSV file
   */
  const parseCSV = (file: File) => {
    setUploadStatus('validating');
    setUploadProgress(null);
    
    Papa.parse<AddressRow>(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: function(results) {
        const { data, errors, meta } = results;
        
        // Validate the required columns
        const requiredColumns = [
          'regionCode', 'regionName', 'provinceCode', 'provinceName', 
          'lguCode', 'lguName', 'barangayCode', 'barangayName'
        ];
        
        const parsedColumns = meta.fields || [];
        const missingColumns = requiredColumns.filter(col => !parsedColumns.includes(col));
        
        if (missingColumns.length > 0) {
          setUploadStatus('error');
          setValidation({
            valid: false,
            errors: [`Missing required columns: ${missingColumns.join(', ')}`],
            stats: { regions: 0, provinces: 0, lgus: 0, barangays: 0 }
          });
          return;
        }
        
        // Validate data integrity
        const validationErrors: string[] = [];
        
        // Check for empty required fields
        data.forEach((row, index) => {
          const rowNumber = index + 2; // +2 because of 0-indexing and header row
          
          requiredColumns.forEach(col => {
            if (!row[col as keyof AddressRow]) {
              validationErrors.push(`Row ${rowNumber}: Missing value for ${col}`);
            }
          });
        });
        
        // Check for code consistency
        const regionMap = new Map<string, string>();
        const provinceMap = new Map<string, { name: string, regionCode: string }>();
        const lguMap = new Map<string, { name: string, provinceCode: string }>();
        
        data.forEach((row, index) => {
          const rowNumber = index + 2;
          
          // Check region consistency
          if (regionMap.has(row.regionCode)) {
            const existingName = regionMap.get(row.regionCode);
            if (existingName !== row.regionName) {
              validationErrors.push(
                `Row ${rowNumber}: Region code ${row.regionCode} has inconsistent name (${row.regionName} vs ${existingName})`
              );
            }
          } else {
            regionMap.set(row.regionCode, row.regionName);
          }
          
          // Check province consistency
          if (provinceMap.has(row.provinceCode)) {
            const existing = provinceMap.get(row.provinceCode)!;
            if (existing.name !== row.provinceName) {
              validationErrors.push(
                `Row ${rowNumber}: Province code ${row.provinceCode} has inconsistent name (${row.provinceName} vs ${existing.name})`
              );
            }
            if (existing.regionCode !== row.regionCode) {
              validationErrors.push(
                `Row ${rowNumber}: Province code ${row.provinceCode} has inconsistent region code (${row.regionCode} vs ${existing.regionCode})`
              );
            }
          } else {
            provinceMap.set(row.provinceCode, { name: row.provinceName, regionCode: row.regionCode });
          }
          
          // Check LGU consistency
          if (lguMap.has(row.lguCode)) {
            const existing = lguMap.get(row.lguCode)!;
            if (existing.name !== row.lguName) {
              validationErrors.push(
                `Row ${rowNumber}: LGU code ${row.lguCode} has inconsistent name (${row.lguName} vs ${existing.name})`
              );
            }
            if (existing.provinceCode !== row.provinceCode) {
              validationErrors.push(
                `Row ${rowNumber}: LGU code ${row.lguCode} has inconsistent province code (${row.provinceCode} vs ${existing.provinceCode})`
              );
            }
          } else {
            lguMap.set(row.lguCode, { name: row.lguName, provinceCode: row.provinceCode });
          }
        });
        
        // Count unique entities for stats
        const uniqueRegions = new Set(data.map(row => row.regionCode));
        const uniqueProvinces = new Set(data.map(row => row.provinceCode));
        const uniqueLgus = new Set(data.map(row => row.lguCode));
        const uniqueBarangays = new Set(data.map(row => row.barangayCode));
        
        const stats = {
          regions: uniqueRegions.size,
          provinces: uniqueProvinces.size,
          lgus: uniqueLgus.size,
          barangays: uniqueBarangays.size
        };
        
        setParseResults({ rows: data, errors: errors });
        setValidation({
          valid: validationErrors.length === 0,
          errors: validationErrors,
          stats
        });
        
        setUploadStatus(validationErrors.length === 0 ? 'idle' : 'error');
        
        // Show toast with validation result
        if (validationErrors.length === 0) {
          toast.success(`CSV file validated successfully. Found ${stats.regions} regions, ${stats.provinces} provinces, ${stats.lgus} LGUs, and ${stats.barangays} barangays.`);
        } else {
          toast.error(`CSV validation failed with ${validationErrors.length} errors.`);
        }
      },
      error: function(error) {
        toast.error('Error parsing CSV file: ' + error.message);
        setUploadStatus('error');
      }
    });
  };
  
  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };
  
  /**
   * Shows confirmation modal before proceeding with update
   */
  const showConfirmation = async () => {
    if (!validation.valid || parseResults.rows.length === 0) {
      toast.error('Please upload a valid CSV file first');
      return;
    }
    
    setUploadStatus('confirming');
    toast.info('Analyzing changes, please wait...');
    
    try {
      // Extract unique regions, provinces, LGUs, and barangays with their codes and names
      const regionMap = new Map(parseResults.rows.map(row => [row.regionCode, row.regionName]));
      const provinceMap = new Map(parseResults.rows.map(row => [row.provinceCode, row.provinceName]));
      const lguMap = new Map(parseResults.rows.map(row => [row.lguCode, row.lguName]));
      const barangayMap = new Map(parseResults.rows.map(row => [row.barangayCode, row.barangayName]));
      
      // Fetch existing data from database
      const { data: existingRegions } = await supabase.from('regions').select('code, name');
      const { data: existingProvinces } = await supabase.from('provinces').select('code, name');
      const { data: existingLgus } = await supabase.from('lgus').select('code, name');
      const { data: existingBarangays } = await supabase.from('barangays').select('code, name');
      
      // Find entries that need to be updated (name has changed)
      const regionsToUpdate = existingRegions?.filter(region => 
        regionMap.has(region.code) && regionMap.get(region.code) !== region.name
      ) || [];
      
      const provincesToUpdate = existingProvinces?.filter(province => 
        provinceMap.has(province.code) && provinceMap.get(province.code) !== province.name
      ) || [];
      
      const lgusToUpdate = existingLgus?.filter(lgu => 
        lguMap.has(lgu.code) && lguMap.get(lgu.code) !== lgu.name
      ) || [];
      
      const barangaysToUpdate = existingBarangays?.filter(barangay => 
        barangayMap.has(barangay.code) && barangayMap.get(barangay.code) !== barangay.name
      ) || [];
      
      const stats = {
        regions: regionsToUpdate.length,
        provinces: provincesToUpdate.length,
        lgus: lgusToUpdate.length,
        barangays: barangaysToUpdate.length,
        total: regionsToUpdate.length + provincesToUpdate.length + lgusToUpdate.length + barangaysToUpdate.length
      };
      
      setChangeStats(stats);
      
      if (stats.total === 0) {
        toast.info('No changes detected. All address names are already up to date.');
        setUploadStatus('idle');
        return;
      }
      
      setIsConfirmationModalOpen(true);
    } catch (error) {
      console.error('Error analyzing changes:', error);
      toast.error('Failed to analyze changes. Please try again.');
      setUploadStatus('idle');
    }
  };
  
  /**
   * Closes the confirmation modal
   */
  const closeConfirmationModal = () => {
    setIsConfirmationModalOpen(false);
    setUploadStatus('idle');
  };
  
  /**
   * Closes the new address modal
   */
  const closeNewAddressModal = () => {
    setIsNewAddressModalOpen(false);
    setUploadStatus('idle');
  };
  
  /**
   * Shows confirmation modal before proceeding with new address upload
   */
  const showNewAddressConfirmation = async () => {
    if (!validation.valid || parseResults.rows.length === 0) {
      toast.error('Please upload a valid CSV file first');
      return;
    }
    
    setUploadStatus('confirming');
    toast.info('Analyzing new addresses, please wait...');
    
    try {
      // Extract unique regions, provinces, LGUs, and barangays with their codes and names
      const regionMap = new Map(parseResults.rows.map(row => [row.regionCode, row.regionName]));
      const provinceMap = new Map(parseResults.rows.map(row => [row.provinceCode, row.provinceName]));
      const lguMap = new Map(parseResults.rows.map(row => [row.lguCode, row.lguName]));
      const barangayMap = new Map(parseResults.rows.map(row => [row.barangayCode, row.barangayName]));
      
      // Fetch existing data from database
      const { data: existingRegions } = await supabase.from('regions').select('code');
      const { data: existingProvinces } = await supabase.from('provinces').select('code');
      const { data: existingLgus } = await supabase.from('lgus').select('code');
      const { data: existingBarangays } = await supabase.from('barangays').select('code');
      
      // Convert existing data to sets for faster lookup
      const existingRegionCodes = new Set(existingRegions?.map(r => r.code) || []);
      const existingProvinceCodes = new Set(existingProvinces?.map(p => p.code) || []);
      const existingLguCodes = new Set(existingLgus?.map(l => l.code) || []);
      const existingBarangayCodes = new Set(existingBarangays?.map(b => b.code) || []);
      
      // Find new entries (codes that don't exist in the database)
      const newRegionCodes = [...regionMap.keys()].filter(code => !existingRegionCodes.has(code));
      const newProvinceCodes = [...provinceMap.keys()].filter(code => !existingProvinceCodes.has(code));
      const newLguCodes = [...lguMap.keys()].filter(code => !existingLguCodes.has(code));
      const newBarangayCodes = [...barangayMap.keys()].filter(code => !existingBarangayCodes.has(code));
      
      const stats = {
        regions: newRegionCodes.length,
        provinces: newProvinceCodes.length,
        lgus: newLguCodes.length,
        barangays: newBarangayCodes.length,
        total: newRegionCodes.length + newProvinceCodes.length + newLguCodes.length + newBarangayCodes.length
      };
      
      setNewAddressStats(stats);
      
      if (stats.total === 0) {
        toast.info('No new addresses detected. All addresses already exist in the database.');
        setUploadStatus('idle');
        return;
      }
      
      setIsNewAddressModalOpen(true);
    } catch (error) {
      console.error('Error analyzing new addresses:', error);
      toast.error('Failed to analyze new addresses. Please try again.');
      setUploadStatus('idle');
    }
  };
  
  /**
   * Uploads new addresses to the database
   */
  const uploadNewAddresses = async () => {
    try {
      setIsNewAddressModalOpen(false);
      setUploadStatus('uploading');
      toast.info('Processing data, please wait...');
      
      // Extract unique regions, provinces, LGUs, and barangays with their codes and names
      const regionMap = new Map(parseResults.rows.map(row => [row.regionCode, row.regionName]));
      const provinceMap = new Map(parseResults.rows.map(row => [row.provinceCode, row.provinceName]));
      const lguMap = new Map(parseResults.rows.map(row => [row.lguCode, row.lguName]));
      const barangayMap = new Map(parseResults.rows.map(row => [row.barangayCode, row.barangayName]));
      
      // Create maps to track parent-child relationships
      const provinceToRegion = new Map(parseResults.rows.map(row => [row.provinceCode, row.regionCode]));
      const lguToProvince = new Map(parseResults.rows.map(row => [row.lguCode, row.provinceCode]));
      const barangayToLgu = new Map(parseResults.rows.map(row => [row.barangayCode, row.lguCode]));
      
      // Fetch existing data from database
      const { data: existingRegions } = await supabase.from('regions').select('code');
      const { data: existingProvinces } = await supabase.from('provinces').select('code');
      const { data: existingLgus } = await supabase.from('lgus').select('code');
      const { data: existingBarangays } = await supabase.from('barangays').select('code');
      
      // Convert existing data to sets for faster lookup
      const existingRegionCodes = new Set(existingRegions?.map(r => r.code) || []);
      const existingProvinceCodes = new Set(existingProvinces?.map(p => p.code) || []);
      const existingLguCodes = new Set(existingLgus?.map(l => l.code) || []);
      const existingBarangayCodes = new Set(existingBarangays?.map(b => b.code) || []);
      
      // Find new entries (codes that don't exist in the database)
      const newRegionCodes = [...regionMap.keys()].filter(code => !existingRegionCodes.has(code));
      const newProvinceCodes = [...provinceMap.keys()].filter(code => !existingProvinceCodes.has(code));
      const newLguCodes = [...lguMap.keys()].filter(code => !existingLguCodes.has(code));
      const newBarangayCodes = [...barangayMap.keys()].filter(code => !existingBarangayCodes.has(code));
      
      setUploadProgress({
        stage: 'regions',
        current: 0,
        total: 4, // 4 steps: insert regions, provinces, lgus, barangays
        percentage: 0
      });
      
      try {
        // Insert new regions
        if (newRegionCodes.length > 0) {
          setUploadProgress({
            stage: 'regions',
            current: 1,
            total: 4,
            percentage: 25
          });
          
          const regionsToInsert = newRegionCodes.map(code => ({
            code,
            name: regionMap.get(code) || ''
          }));
          
          const { error } = await supabase.from('regions').insert(regionsToInsert);
          
          if (error) {
            console.error('Error inserting regions:', error);
            throw new Error(`Failed to insert regions: ${error.message}`);
          }
        }
        
        // Insert new provinces
        if (newProvinceCodes.length > 0) {
          setUploadProgress({
            stage: 'provinces',
            current: 2,
            total: 4,
            percentage: 50
          });
          
          const provincesToInsert = newProvinceCodes.map(code => ({
            code,
            name: provinceMap.get(code) || '',
            region_code: provinceToRegion.get(code) || ''
          }));
          
          const { error } = await supabase.from('provinces').insert(provincesToInsert);
          
          if (error) {
            console.error('Error inserting provinces:', error);
            throw new Error(`Failed to insert provinces: ${error.message}`);
          }
        }
        
        // Insert new LGUs
        if (newLguCodes.length > 0) {
          setUploadProgress({
            stage: 'lgus',
            current: 3,
            total: 4,
            percentage: 75
          });
          
          const lgusToInsert = newLguCodes.map(code => ({
            code,
            name: lguMap.get(code) || '',
            province_code: lguToProvince.get(code) || ''
          }));
          
          const { error } = await supabase.from('lgus').insert(lgusToInsert);
          
          if (error) {
            console.error('Error inserting LGUs:', error);
            throw new Error(`Failed to insert LGUs: ${error.message}`);
          }
        }
        
        // Insert new barangays
        if (newBarangayCodes.length > 0) {
          setUploadProgress({
            stage: 'barangays',
            current: 0,
            total: newBarangayCodes.length,
            percentage: 0
          });
          
          // Insert barangays in batches to avoid timeouts
          const batchSize = 100;
          for (let i = 0; i < newBarangayCodes.length; i += batchSize) {
            const batch = newBarangayCodes.slice(i, i + batchSize);
            
            const barangaysToInsert = batch.map(code => ({
              code,
              name: barangayMap.get(code) || '',
              lgu_code: barangayToLgu.get(code) || ''
            }));
            
            const { error } = await supabase.from('barangays').insert(barangaysToInsert);
            
            if (error) {
              console.error('Error inserting barangays:', error);
              throw new Error(`Failed to insert barangays: ${error.message}`);
            }
            
            setUploadProgress({
              stage: 'barangays',
              current: i + batch.length,
              total: newBarangayCodes.length,
              percentage: Math.min(((i + batch.length) / newBarangayCodes.length) * 100, 100)
            });
          }
        }
        
        setUploadProgress({
          stage: 'complete',
          current: 4,
          total: 4,
          percentage: 100
        });
        
        setUploadStatus('success');
        toast.success('New addresses uploaded successfully!');
      } catch (error) {
        console.error('Error uploading new addresses:', error);
        setUploadStatus('error');
        toast.error(error instanceof Error ? error.message : 'Failed to upload new addresses');
      }
    } catch (error) {
      console.error('Error preparing data for upload:', error);
      setUploadStatus('error');
      toast.error(error instanceof Error ? error.message : 'Failed to prepare data for upload');
    }
  };
  
  /**
   * Updates address names in the database based on their codes
   */
  const updateAddressNames = async () => {
    try {
      setIsConfirmationModalOpen(false);
      setUploadStatus('uploading');
      toast.info('Processing data, please wait...');
      
      // Extract unique regions, provinces, LGUs, and barangays with their codes and names
      const regionMap = new Map(parseResults.rows.map(row => [row.regionCode, row.regionName]));
      const provinceMap = new Map(parseResults.rows.map(row => [row.provinceCode, row.provinceName]));
      const lguMap = new Map(parseResults.rows.map(row => [row.lguCode, row.lguName]));
      const barangayMap = new Map(parseResults.rows.map(row => [row.barangayCode, row.barangayName]));
      
      // Fetch existing data from database to find entries that need updating
      const { data: existingRegions } = await supabase.from('regions').select('code, name');
      const { data: existingProvinces } = await supabase.from('provinces').select('code, name');
      const { data: existingLgus } = await supabase.from('lgus').select('code, name');
      const { data: existingBarangays } = await supabase.from('barangays').select('code, name');
      
      // Find entries that need to be updated (name has changed)
      const regionsToUpdate = existingRegions?.filter(region => 
        regionMap.has(region.code) && regionMap.get(region.code) !== region.name
      ) || [];
      
      const provincesToUpdate = existingProvinces?.filter(province => 
        provinceMap.has(province.code) && provinceMap.get(province.code) !== province.name
      ) || [];
      
      const lgusToUpdate = existingLgus?.filter(lgu => 
        lguMap.has(lgu.code) && lguMap.get(lgu.code) !== lgu.name
      ) || [];
      
      const barangaysToUpdate = existingBarangays?.filter(barangay => 
        barangayMap.has(barangay.code) && barangayMap.get(barangay.code) !== barangay.name
      ) || [];
      
      setUploadProgress({
        stage: 'regions',
        current: 0,
        total: 4, // 4 steps: update regions, provinces, lgus, barangays
        percentage: 0
      });
      
      try {
        // Update regions with changed names
        if (regionsToUpdate.length > 0) {
          setUploadProgress({
            stage: 'regions',
            current: 1,
            total: 4,
            percentage: 25
          });
          
          for (const region of regionsToUpdate) {
            const newName = regionMap.get(region.code);
            if (newName) {
              const { error } = await supabase
                .from('regions')
                .update({ name: newName })
                .eq('code', region.code);
              
              if (error) {
                console.warn(`Warning updating region ${region.code}: ${error.message}`);
              }
            }
          }
        }
        
        // Update provinces with changed names
        if (provincesToUpdate.length > 0) {
          setUploadProgress({
            stage: 'provinces',
            current: 2,
            total: 4,
            percentage: 50
          });
          
          for (const province of provincesToUpdate) {
            const newName = provinceMap.get(province.code);
            if (newName) {
              const { error } = await supabase
                .from('provinces')
                .update({ name: newName })
                .eq('code', province.code);
              
              if (error) {
                console.warn(`Warning updating province ${province.code}: ${error.message}`);
              }
            }
          }
        }
        
        // Update LGUs with changed names
        if (lgusToUpdate.length > 0) {
          setUploadProgress({
            stage: 'lgus',
            current: 3,
            total: 4,
            percentage: 75
          });
          
          for (const lgu of lgusToUpdate) {
            const newName = lguMap.get(lgu.code);
            if (newName) {
              const { error } = await supabase
                .from('lgus')
                .update({ name: newName })
                .eq('code', lgu.code);
              
              if (error) {
                console.warn(`Warning updating LGU ${lgu.code}: ${error.message}`);
              }
            }
          }
        }
        
        // Update barangays with changed names
        if (barangaysToUpdate.length > 0) {
          setUploadProgress({
            stage: 'barangays',
            current: 0,
            total: barangaysToUpdate.length,
            percentage: 0
          });
          
          let count = 0;
          for (const barangay of barangaysToUpdate) {
            const newName = barangayMap.get(barangay.code);
            if (newName) {
              const { error } = await supabase
                .from('barangays')
                .update({ name: newName })
                .eq('code', barangay.code);
              
              if (error) {
                console.warn(`Warning updating barangay ${barangay.code}: ${error.message}`);
              }
            }
            
            count++;
            setUploadProgress({
              stage: 'barangays',
              current: count,
              total: barangaysToUpdate.length,
              percentage: Math.min((count / barangaysToUpdate.length) * 100, 100)
            });
          }
        }
        
        setUploadProgress({
          stage: 'complete',
          current: 4,
          total: 4,
          percentage: 100
        });
        
        setUploadStatus('success');
        toast.success('Address data updated successfully!');
      } catch (error) {
        console.error('Error uploading address data:', error);
        setUploadStatus('error');
        toast.error(error instanceof Error ? error.message : 'Failed to update address data');
      }
    } catch (error) {
      console.error('Error preparing data for upload:', error);
      setUploadStatus('error');
      toast.error(error instanceof Error ? error.message : 'Failed to prepare data for upload');
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Address Management</h1>
        <p className="mt-1 text-gray-600">Upload CSV file with address hierarchies</p>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">CSV Import</h2>
        
        <FileUploadArea
          isDragging={isDragging}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          file={file}
          setFile={setFile}
          fileInputRef={fileInputRef}
          handleBrowseClick={handleBrowseClick}
          handleFileInputChange={handleFileInputChange}
          uploadStatus={uploadStatus}
          validation={validation}
          parseResults={parseResults}
          setParseResults={setParseResults}
          setValidation={setValidation}
          setUploadStatus={setUploadStatus}
        />
        
        {uploadProgress && <UploadProgressIndicator progress={uploadProgress} />}
        
        <div className="mt-6">
          <InstructionsPanel />
        </div>
        
        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={showNewAddressConfirmation}
            disabled={!validation.valid || uploadStatus !== 'idle'}
            className={`px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
              (!validation.valid || uploadStatus !== 'idle') ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-label="Upload new addresses"
          >
            {uploadStatus === 'uploading' ? (
              <span className="flex items-center">
                <RefreshCw size={16} className="mr-2 animate-spin" />
                Uploading...
              </span>
            ) : (
              <span className="flex items-center">
                <Upload size={16} className="mr-2" />
                Upload New Addresses
              </span>
            )}
          </button>
          
          <button
            onClick={showConfirmation}
            disabled={!validation.valid || uploadStatus !== 'idle'}
            className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              (!validation.valid || uploadStatus !== 'idle') ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-label="Update address names"
          >
            {uploadStatus === 'uploading' ? (
              <span className="flex items-center">
                <RefreshCw size={16} className="mr-2 animate-spin" />
                Updating...
              </span>
            ) : (
              <span className="flex items-center">
                <Database size={16} className="mr-2" />
                Update Address Names
              </span>
            )}
          </button>
        </div>
        
        <ConfirmationModal
          isOpen={isConfirmationModalOpen}
          onClose={closeConfirmationModal}
          onConfirm={updateAddressNames}
          stats={changeStats}
        />
        
        <NewAddressModal
          isOpen={isNewAddressModalOpen}
          onClose={closeNewAddressModal}
          onConfirm={uploadNewAddresses}
          stats={newAddressStats}
        />
        
        {uploadStatus === 'success' && (
          <div className="mt-4 bg-green-50 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <Check className="h-5 w-5 text-green-500" aria-hidden="true" />
              </div>
              <div className="ml-3">
                {isNewAddressModalOpen ? (
                  <>
                    <p className="text-sm font-medium text-green-800">
                      New addresses uploaded successfully!
                    </p>
                    <p className="mt-2 text-sm text-green-700">
                      Added {newAddressStats.regions} new regions, {' '}
                      {newAddressStats.provinces} new provinces, {newAddressStats.lgus} new LGUs, 
                      and {newAddressStats.barangays} new barangays.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-green-800">
                      Address data updated successfully!
                    </p>
                    <p className="mt-2 text-sm text-green-700">
                      Names have been updated for {changeStats.regions} regions, {' '}
                      {changeStats.provinces} provinces, {changeStats.lgus} LGUs, 
                      and {changeStats.barangays} barangays.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        
        {uploadStatus === 'error' && (
          <div className="mt-4 bg-red-50 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">
                  Error updating address data
                </p>
                <p className="mt-2 text-sm text-red-700">
                  Please try again or contact support if the problem persists.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AddressManagement;
