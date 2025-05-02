import { useState, useCallback, useRef } from 'react';
import { Upload, X, Check, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'react-toastify';
import { supabase } from '../lib/supabase';

type AddressRow = {
  regionCode: string;
  regionName: string;
  provinceCode: string;
  provinceName: string;
  lguCode: string;
  lguName: string;
  barangayCode: string;
  barangayName: string;
};

function AddressManagement() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parseResults, setParseResults] = useState<{rows: AddressRow[], errors: Papa.ParseError[]}>({
    rows: [],
    errors: []
  });
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'validating' | 'uploading' | 'success' | 'error'>('idle');
  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: string[];
    stats: {
      regions: number;
      provinces: number;
      lgus: number;
      barangays: number;
    };
  }>({
    valid: false,
    errors: [],
    stats: {
      regions: 0,
      provinces: 0,
      lgus: 0,
      barangays: 0
    }
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
  
  const parseCSV = (file: File) => {
    setUploadStatus('validating');
    
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
        data.forEach((row, index) => {
          const rowNumber = index + 2; // +2 because of 0-indexing and header row
          
          // Check for empty required fields
          requiredColumns.forEach(col => {
            if (!row[col as keyof AddressRow]) {
              validationErrors.push(`Row ${rowNumber}: Missing value for ${col}`);
            }
          });
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
  
  const uploadData = async () => {
    try {
      if (!validation.valid || parseResults.rows.length === 0) {
        toast.error('Please upload a valid CSV file first');
        return;
      }
      
      setUploadStatus('uploading');
      toast.info('Processing data, please wait...');
      
      // Extract unique regions, provinces, LGUs, and barangays
      const regions = Array.from(
        new Map(parseResults.rows.map(row => [row.regionCode, { code: row.regionCode, name: row.regionName }]))
      ).map(([_, value]) => value);
      
      const provinces = Array.from(
        new Map(parseResults.rows.map(row => [
          row.provinceCode, 
          { 
            code: row.provinceCode, 
            name: row.provinceName,
            region_code: row.regionCode 
          }
        ]))
      ).map(([_, value]) => value);
      
      const lgus = Array.from(
        new Map(parseResults.rows.map(row => [
          row.lguCode, 
          { 
            code: row.lguCode, 
            name: row.lguName,
            province_code: row.provinceCode 
          }
        ]))
      ).map(([_, value]) => value);
      
      const barangays = parseResults.rows.map(row => ({
        code: row.barangayCode,
        name: row.barangayName,
        province_code: row.provinceCode,
        lgu_code: row.lguCode
      }));
      
      // Begin transaction by clearing previous data
      // Use Promise.all to perform operations concurrently
      
      // Step 1: Clear existing data in reverse order of dependencies
      await supabase.from('barangays').delete().neq('id', 0); // Delete all
      await supabase.from('lgus').delete().neq('id', 0); // Delete all
      await supabase.from('provinces').delete().neq('id', 0); // Delete all
      await supabase.from('regions').delete().neq('id', 0); // Delete all
      
      // Step 2: Insert new data in order of dependencies
      if (regions.length > 0) {
        const { error: regionsError } = await supabase.from('regions').insert(regions);
        if (regionsError) throw new Error(`Error inserting regions: ${regionsError.message}`);
      }
      
      if (provinces.length > 0) {
        const { error: provincesError } = await supabase.from('provinces').insert(provinces);
        if (provincesError) throw new Error(`Error inserting provinces: ${provincesError.message}`);
      }
      
      if (lgus.length > 0) {
        const { error: lgusError } = await supabase.from('lgus').insert(lgus);
        if (lgusError) throw new Error(`Error inserting LGUs: ${lgusError.message}`);
      }
      
      // For barangays, we might need to insert in batches if there are many
      if (barangays.length > 0) {
        const BATCH_SIZE = 1000;
        for (let i = 0; i < barangays.length; i += BATCH_SIZE) {
          const batch = barangays.slice(i, i + BATCH_SIZE);
          const { error: barangaysError } = await supabase.from('barangays').insert(batch);
          if (barangaysError) throw new Error(`Error inserting barangays batch ${i/BATCH_SIZE + 1}: ${barangaysError.message}`);
        }
      }
      
      setUploadStatus('success');
      toast.success('Address data updated successfully!');
    } catch (error) {
      console.error('Error uploading address data:', error);
      setUploadStatus('error');
      toast.error(error instanceof Error ? error.message : 'Failed to update address data');
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
          />
          
          {!file ? (
            <div className="space-y-4">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="text-lg font-medium text-gray-900">
                Drop your CSV file here, or <button onClick={handleBrowseClick} className="text-blue-600 hover:text-blue-700">browse</button>
              </div>
              <p className="text-sm text-gray-500">
                CSV should include: regionCode, regionName, provinceCode, provinceName, lguCode, lguName, barangayCode, barangayName
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="mr-4">
                  <FileIcon className="h-12 w-12 text-gray-500" />
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
                  className="ml-4 text-gray-500 hover:text-gray-700"
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
                      <Check className="h-5 w-5 text-green-500" />
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
                      <AlertTriangle className="h-5 w-5 text-red-500" />
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
        
        <div className="mt-6">
          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Instructions</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
              <li>Prepare a CSV file with the required columns</li>
              <li>The system will replace all existing address data with the new data</li>
              <li>Ensure data integrity by checking for duplicates and proper relationships</li>
              <li>Region codes must be unique across regions</li>
              <li>Province codes must be unique across provinces</li>
              <li>LGU codes must be unique across LGUs</li>
              <li>Barangay codes must be unique across barangays</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={uploadData}
            disabled={!validation.valid || uploadStatus === 'uploading'}
            className={`btn-primary ${(!validation.valid || uploadStatus === 'uploading') ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload to Database'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FileIcon(props) {
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

export default AddressManagement;