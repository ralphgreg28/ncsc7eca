import { useState, useCallback, useRef } from 'react';
import { Upload, Download, FileText, X, Check, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

interface CitizenImport {
  id?: number;
  last_name: string;
  first_name: string;
  middle_name?: string;
  extension_name?: string;
  birth_date: string;
  sex: 'Male' | 'Female';
  province_code: string;
  lgu_code: string;
  barangay_code: string;
  status?: string;
  payment_date?: string | null;
  osca_id?: string;
  rrn?: string;
  validator?: string;
  validation_date?: string | null;
  remarks?: string;
}

// Extended interface for database records that includes additional fields
interface CitizenRecord extends CitizenImport {
  id: number;
  created_at: string;
  encoded_by?: string;
  encoded_date: string;
  [key: string]: any; // Allow for any additional fields from the database
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  total: number;
  valid_count: number;
}

interface AddressDetails {
  provinces: Array<{ code: string; name: string; }>;
  lgus: Array<{ code: string; name: string; }>;
  barangays: Array<{ code: string; name: string; }>;
}

function DeleteConfirmationModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Delete All Records</h2>
        </div>
        
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete all records? This action cannot be undone.
        </p>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="btn-outline"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn-danger"
          >
            Delete All Records
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportExport() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'validating' | 'uploading' | 'success' | 'error'>('idle');
  const [validation, setValidation] = useState<ValidationResult>({
    valid: false,
    errors: [],
    total: 0,
    valid_count: 0
  });
  const [importData, setImportData] = useState<CitizenImport[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAddressDetails = async (): Promise<AddressDetails> => {
    try {
      // Fetch all address data with explicit size limits to ensure we get ALL records
      const [{ data: provinces, error: provinceError }, 
             { data: lgus, error: lguError }, 
             { data: barangays, error: barangayError }] = await Promise.all([
        supabase.from('provinces').select('code, name').order('name').limit(1000),
        supabase.from('lgus').select('code, name').order('name').limit(5000),
        supabase.from('barangays').select('code, name').order('name').limit(50000)
      ]);

      if (provinceError) console.error('Error fetching provinces:', provinceError);
      if (lguError) console.error('Error fetching LGUs:', lguError);
      if (barangayError) console.error('Error fetching barangays:', barangayError);

      // Log counts to help diagnose issues
      console.log(`Fetched ${provinces?.length || 0} provinces, ${lgus?.length || 0} LGUs, ${barangays?.length || 0} barangays`);

      return {
        provinces: provinces || [],
        lgus: lgus || [],
        barangays: barangays || []
      };
    } catch (error) {
      console.error('Error fetching address details:', error);
      return {
        provinces: [],
        lgus: [],
        barangays: []
      };
    }
  };

  const fetchAllRecordsInBatches = async (): Promise<CitizenRecord[]> => {
    const BATCH_SIZE = 1000;
    let allRecords: CitizenRecord[] = [];
    let hasMore = true;
    let start = 0;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('citizens')
        .select('*')
        .range(start, start + BATCH_SIZE - 1)
        .order('id');
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        allRecords = [...allRecords, ...data];
        start += BATCH_SIZE;
        
        toast.info(`Fetched ${allRecords.length} records...`, { 
          autoClose: 1000,
          toastId: 'export-progress'
        });
      }
      
      hasMore = data && data.length === BATCH_SIZE;
    }
    
    return allRecords;
  };
  
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
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }
    
    setFile(file);
    parseFile(file);
  };
  
  const parseFile = (file: File) => {
    setUploadStatus('validating');
    
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (fileExtension === '.csv') {
      parseCSV(file);
    } else {
      parseExcel(file);
    }
  };
  
  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: function(results) {
        processImportData(results.data as any[]);
      },
      error: function(error) {
        toast.error('Error parsing CSV file: ' + error.message);
        setUploadStatus('error');
      }
    });
  };
  
  const parseExcel = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        
        processImportData(json);
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        toast.error('Error parsing Excel file');
        setUploadStatus('error');
      }
    };
    
    reader.onerror = function() {
      toast.error('Error reading file');
      setUploadStatus('error');
    };
    
    reader.readAsBinaryString(file);
  };
  
  const processImportData = (data: any[]) => {
    const validationErrors: string[] = [];
    const processedData: CitizenImport[] = [];
    
    const headerMap: Record<string, string> = {
      'ID': 'id',
      'Last Name': 'last_name',
      'First Name': 'first_name',
      'Middle Name': 'middle_name',
      'Extension Name': 'extension_name',
      'Birth Date': 'birth_date',
      'Sex': 'sex',
      'Province': 'province_code',
      'City/Municipality': 'lgu_code',
      'Barangay': 'barangay_code',
      'Status': 'status',
      'Payment Date': 'payment_date',
      'OSCA ID': 'osca_id',
      'RRN': 'rrn',
      'Validator': 'validator',
      'Validation Date': 'validation_date',
      'Remarks': 'remarks',
      'Province Code': 'province_code',
      'LGU Code': 'lgu_code',
      'Barangay Code': 'barangay_code',
      // Support snake_case variants
      'id': 'id',
      'last_name': 'last_name',
      'first_name': 'first_name',
      'middle_name': 'middle_name',
      'extension_name': 'extension_name',
      'birth_date': 'birth_date',
      'sex': 'sex',
      'status': 'status',
      'payment_date': 'payment_date',
      'osca_id': 'osca_id',
      'rrn': 'rrn',
      'validator': 'validator',
      'validation_date': 'validation_date',
      'remarks': 'remarks',
      'province_code': 'province_code',
      'lgu_code': 'lgu_code',
      'barangay_code': 'barangay_code'
    };
    
    const requiredFields = ['last_name', 'first_name', 'birth_date', 'sex', 'province_code', 'lgu_code', 'barangay_code'];
    const firstRow = data[0] || {};
    const availableFields = Object.keys(firstRow);
    
    const standardizedFields: Record<string, string> = {};
    availableFields.forEach(field => {
      const standardField = headerMap[field];
      if (standardField) {
        standardizedFields[field] = standardField;
      }
    });
    
    const missingFields = requiredFields.filter(field => 
      !Object.values(standardizedFields).includes(field)
    );
    
    if (missingFields.length > 0) {
      validationErrors.push(`Missing required columns: ${missingFields.join(', ')}`);
      setValidation({
        valid: false,
        errors: validationErrors,
        total: data.length,
        valid_count: 0
      });
      setUploadStatus('error');
      return;
    }
    
    data.forEach((row, index) => {
      try {
        const rowNumber = index + 2;
        const processedRow: any = {};
        
        Object.entries(row).forEach(([key, value]) => {
          const standardKey = standardizedFields[key];
          if (standardKey) {
            if ((standardKey === 'payment_date' || standardKey === 'validation_date') && 
                (value === '' || value === undefined || value === null)) {
              processedRow[standardKey] = null;
            } else {
              processedRow[standardKey] = value;
            }
          }
        });
        
        for (const field of requiredFields) {
          if (!processedRow[field]) {
            validationErrors.push(`Row ${rowNumber}: Missing ${field}`);
            return;
          }
        }
        
        if (processedRow.sex !== 'Male' && processedRow.sex !== 'Female') {
          validationErrors.push(`Row ${rowNumber}: Sex must be 'Male' or 'Female'. Got '${processedRow.sex}'`);
          return;
        }
        
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!datePattern.test(processedRow.birth_date)) {
          try {
            const date = new Date(processedRow.birth_date);
            if (isNaN(date.getTime())) {
              validationErrors.push(`Row ${rowNumber}: Invalid birth date format. Use YYYY-MM-DD`);
              return;
            }
            processedRow.birth_date = format(date, 'yyyy-MM-dd');
          } catch (e) {
            validationErrors.push(`Row ${rowNumber}: Invalid birth date format. Use YYYY-MM-DD`);
            return;
          }
        }

        if (processedRow.payment_date && processedRow.payment_date !== null) {
          try {
            const date = new Date(processedRow.payment_date);
            if (!isNaN(date.getTime())) {
              processedRow.payment_date = format(date, 'yyyy-MM-dd');
            } else {
              processedRow.payment_date = null;
            }
          } catch (e) {
            processedRow.payment_date = null;
          }
        }

        if (processedRow.validation_date && processedRow.validation_date !== null) {
          try {
            const date = new Date(processedRow.validation_date);
            if (!isNaN(date.getTime())) {
              processedRow.validation_date = format(date, 'yyyy-MM-dd');
            } else {
              processedRow.validation_date = null;
            }
          } catch (e) {
            processedRow.validation_date = null;
          }
        }
        
        processedData.push(processedRow as CitizenImport);
      } catch (error) {
        validationErrors.push(`Row ${index + 2}: Processing error`);
      }
    });
    
    setImportData(processedData);
    setValidation({
      valid: processedData.length > 0,
      errors: validationErrors,
      total: data.length,
      valid_count: processedData.length
    });
    
    setUploadStatus(validationErrors.length === 0 ? 'idle' : 'error');
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
  
  const handleImport = async () => {
    if (importData.length === 0) {
      toast.error('No valid data to import');
      return;
    }
    
    try {
      setUploadStatus('uploading');
      toast.info(`Importing ${importData.length} records...`);
      
      const BATCH_SIZE = 100;
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < importData.length; i += BATCH_SIZE) {
        const batch = importData.slice(i, i + BATCH_SIZE);
        
        const { data, error } = await supabase
          .from('citizens')
          .upsert(batch, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })
          .select();
        
        if (error) {
          console.error('Error importing batch:', error);
          errorCount += batch.length;
        } else {
          successCount += data ? data.length : 0;
        }
        
        if (i + BATCH_SIZE < importData.length) {
          toast.info(`Imported ${i + BATCH_SIZE} of ${importData.length} records...`, { autoClose: 1000 });
        }
      }
      
      if (errorCount > 0) {
        toast.warning(`Import completed with issues: ${successCount} records imported, ${errorCount} failed`);
      } else {
        toast.success(`Successfully imported ${successCount} records`);
      }
      
      setUploadStatus('success');
      
      setTimeout(() => {
        setFile(null);
        setImportData([]);
        setValidation({
          valid: false,
          errors: [],
          total: 0,
          valid_count: 0
        });
        setUploadStatus('idle');
      }, 3000);
      
    } catch (error) {
      console.error('Error importing data:', error);
      toast.error('Failed to import data');
      setUploadStatus('error');
    }
  };
  
  const handleExport = async () => {
    try {
      setExportLoading(true);
      toast.info('Preparing export...');
      
      const citizens = await fetchAllRecordsInBatches();
      
      if (!citizens || citizens.length === 0) {
        toast.info('No data to export');
        setExportLoading(false);
        return;
      }

      // Fetch address details
      const addressDetails = await fetchAddressDetails();
      
      // Create normalized lookup maps with better error handling
      const provinceMap = new Map();
      const lguMap = new Map();
      const barangayMap = new Map();
      const normalizedBarangayMap = new Map(); // For case-insensitive lookups
      
      // Populate maps with normalized keys (trimmed and lowercase)
      addressDetails.provinces.forEach(p => {
        const normalizedCode = p.code.trim();
        provinceMap.set(normalizedCode, p.name);
      });
      
      addressDetails.lgus.forEach(l => {
        const normalizedCode = l.code.trim();
        lguMap.set(normalizedCode, l.name);
      });
      
      addressDetails.barangays.forEach(b => {
        const normalizedCode = b.code.trim();
        barangayMap.set(normalizedCode, b.name);
        // Also add to normalized map for case-insensitive lookup
        normalizedBarangayMap.set(normalizedCode.toLowerCase(), b.name);
      });
      
      // Log map sizes to help diagnose issues
      console.log(`Map sizes - Provinces: ${provinceMap.size}, LGUs: ${lguMap.size}, Barangays: ${barangayMap.size}`);
      
      const exportData = citizens.map(citizen => ({
        'ID': citizen.id,
        'Last Name': citizen.last_name,
        'First Name': citizen.first_name,
        'Middle Name': citizen.middle_name || '',
        'Extension Name': citizen.extension_name || '',
        'Birth Date': format(new Date(citizen.birth_date), 'MM/dd/yyyy'),
        'Sex': citizen.sex,
        'Province': provinceMap.get(citizen.province_code?.trim()) || citizen.province_code,
        'City/Municipality': lguMap.get(citizen.lgu_code?.trim()) || citizen.lgu_code,
        'Barangay': getBarangayName(citizen.barangay_code, barangayMap, normalizedBarangayMap),
        'Status': citizen.status,
        'Payment Date': citizen.payment_date ? format(new Date(citizen.payment_date), 'MM/dd/yyyy') : '',
        'OSCA ID': citizen.osca_id || 'N/A',
        'RRN': citizen.rrn || 'N/A',
        'Validator': citizen.validator || '',
        'Validation Date': citizen.validation_date ? format(new Date(citizen.validation_date), 'MM/dd/yyyy') : '',
        'Remarks': citizen.remarks || '',
        'Date Registered': format(new Date(citizen.created_at), 'MM/dd/yyyy HH:mm:ss'),
        'Province Code': citizen.province_code,
        'LGU Code': citizen.lgu_code,
        'Barangay Code': citizen.barangay_code,
        'Encoded By': citizen.encoded_by || '',
        'Encoded Date': format(new Date(citizen.encoded_date), 'MM/dd/yyyy HH:mm:ss'),
        'Calendar Year': citizen.calendar_year,
        'Specimen': citizen.specimen || '',
        'Disability': citizen.disability || '',
        'Indigenous Peoples': citizen.indigenous_peoples || '',
      }));
      
      // Function to get barangay name with fallback strategies
      function getBarangayName(code: string | null | undefined, map: Map<string, string>, normalizedMap: Map<string, string>): string {
        if (!code) return 'N/A';
        
        const trimmedCode = code.trim();
        
        // Try exact match first
        const exactMatch = map.get(trimmedCode);
        if (exactMatch) return exactMatch;
        
        // Try case-insensitive match
        const lowerCode = trimmedCode.toLowerCase();
        const caseInsensitiveMatch = normalizedMap.get(lowerCode);
        if (caseInsensitiveMatch) return caseInsensitiveMatch;
        
        // Log missing codes to help diagnose the issue
        console.log(`Barangay code not found: "${code}"`);
        
        // Return the original code as fallback
        return code;
      }
      
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      const fileName = `senior_citizens_${timestamp}`;
      
      const csv = Papa.unparse(exportData);
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${fileName}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${exportData.length} records successfully`);
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    try {
      setDeleteLoading(true);
      
      const { error } = await supabase
        .from('citizens')
        .delete()
        .neq('id', 0); // Delete all records
      
      if (error) throw error;
      
      toast.success('All records have been deleted successfully');
      setShowDeleteConfirmation(false);
    } catch (error) {
      console.error('Error deleting records:', error);
      toast.error('Failed to delete records');
    } finally {
      setDeleteLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import / Export</h1>
          <p className="mt-1 text-gray-600">Import or export senior citizen records</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={handleExport}
            disabled={exportLoading}
            className="btn-primary flex items-center"
          >
            <Download className="h-5 w-5 mr-2" />
            {exportLoading ? 'Exporting...' : 'Export All Records'}
          </button>
          
          <button
            onClick={() => setShowDeleteConfirmation(true)}
            className="btn-danger flex items-center"
            disabled={deleteLoading}
          >
            <Trash2 className="h-5 w-5 mr-2" />
            Delete All Records
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Import Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Upload className="mr-2 h-5 w-5 text-blue-600" />
            Import Records
          </h2>
          
          <div 
            className={`border-2 border-dashed rounded-lg p-6 text-center ${
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
              accept=".csv,.xlsx,.xls"
              onChange={handleFileInputChange}
            />
            
            {!file ? (
              <div className="space-y-4">
                <Upload className="mx-auto h-10 w-10 text-gray-400" />
                <div className="text-sm font-medium text-gray-900">
                  Drop your file here, or <button onClick={handleBrowseClick} className="text-blue-600 hover:text-blue-700">browse</button>
                </div>
                <p className="text-xs text-gray-500">
                  Accept CSV or Excel files with citizen data
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="mr-3">
                    <FileText className="h-8 w-8 text-gray-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setImportData([]);
                      setValidation({ valid: false, errors: [], total: 0, valid_count: 0 });
                      setUploadStatus('idle');
                    }}
                    className="ml-3 text-gray-500 hover:text-gray-700"
                  >
                    <X size={16} />
                  </button>
                </div>
                
                {uploadStatus === 'validating' ? (
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Validating file...</p>
                    <div className="mt-2 animate-pulse flex justify-center">
                      <div className="h-2 w-24 bg-blue-300 rounded"></div>
                    </div>
                  </div>
                ) : uploadStatus === 'uploading' ? (
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Uploading data...</p>
                    <div className="mt-2 animate-pulse flex justify-center">
                      <div className="h-2 w-24 bg-green-300 rounded"></div>
                    </div>
                  </div>
                ) : validation.valid ? (
                  <div className="bg-green-50 p-3 rounded-md">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <Check className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-green-800">File validated successfully</p>
                        <p className="text-xs text-green-700 mt-1">
                          {validation.valid_count} of {validation.total} records are valid
                        </p>
                      </div>
                    </div>
                  </div>
                ) : validation.errors.length > 0 ? (
                  <div className="bg-red-50 p-3 rounded-md">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-red-800">Validation failed</p>
                        <div className="mt-1 text-xs text-red-700">
                          <p>{validation.valid_count} of {validation.total} records are valid</p>
                          <ul className="list-disc pl-5 space-y-1 max-h-40 overflow-y-auto mt-1">
                            {validation.errors.slice(0, 5).map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                            {validation.errors.length > 5 && (
                              <li>...and {validation.errors.length - 5} more errors</li>
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
          
          <div className="mt-4">
            <button
              onClick={handleImport}
              disabled={!validation.valid || uploadStatus === 'uploading' || importData.length === 0}
              className={`btn-primary w-full ${(!validation.valid || uploadStatus === 'uploading' || importData.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Import {importData.length} Records
            </button>
          </div>
          
          <div className="mt-4 bg-gray-50 p-3 rounded-md">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Instructions</h3>
            <ul className="list-disc pl-5 space-y-1 text-xs text-gray-600">
              <li>File must contain: Last Name, First Name, Birth Date, Sex, Province Code, LGU Code, Barangay Code</li>
              <li>Sex must be "Male" or "Female"</li>
              <li>Birth Date must be in YYYY-MM-DD format</li>
              <li>The province, LGU, and barangay codes must exist in the system</li>
            </ul>
          </div>
        </div>
        
        {/* Export Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Download className="mr-2 h-5 w-5 text-green-600" />
            Export Records
          </h2>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <p className="text-sm text-gray-700 mb-6">
              Export all senior citizen records to a file for backup or reporting purposes.
            </p>
            
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">CSV Format</h3>
                  <p className="text-xs text-gray-500 mt-1">Standard format, compatible with most applications</p>
                </div>
                <button 
                  onClick={handleExport}
                  disabled={exportLoading}
                  className={`btn-primary text-sm py-1 ${exportLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Download size={14} className="mr-1 inline" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Export Includes:</h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-600">
              <li className="flex items-center">
                <Check size={12} className="mr-1 text-green-500" />
                Full Names
              </li>
              <li className="flex items-center">
                <Check size={12} className="mr-1 text-green-500" />
                Birth Date
              </li>
              <li className="flex items-center">
                <Check size={12} className="mr-1 text-green-500" />
                Gender Information
              </li>
              <li className="flex items-center">
                <Check size={12} className="mr-1 text-green-500" />
                Complete Address
              </li>
              <li className="flex items-center">
                <Check size={12} className="mr-1 text-green-500" />
                Registration Date
              </li>
              <li className="flex items-center">
                <Check size={12} className="mr-1 text-green-500" />
                Address Codes
              </li>
            </ul>
          </div>
          
          <div className="mt-6 bg-blue-50 p-4 rounded-md">
            <h3 className="text-xs font-medium text-blue-800 mb-2">Data Security Note:</h3>
            <p className="text-xs text-blue-700">
              Exported data may contain sensitive information. Ensure you maintain proper security 
              and confidentiality when handling senior citizen records.
            </p>
          </div>
        </div>
      </div>

      {showDeleteConfirmation && (
        <DeleteConfirmationModal
          onConfirm={handleDeleteAll}
          onCancel={() => setShowDeleteConfirmation(false)}
        />
      )}
    </div>
  );
}

export default ImportExport;
