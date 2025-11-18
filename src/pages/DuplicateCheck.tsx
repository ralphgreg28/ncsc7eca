import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

interface Citizen {
  id: number;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  extension_name: string | null;
  birth_date: string;
  province_code: string;
  lgu_code: string;
  barangay_code: string;
  province_name: string;
  lgu_name: string;
  barangay_name: string;
  status: string;
}

interface DuplicateMatch {
  citizen1: Citizen;
  citizen2: Citizen;
  confidenceScore: number;
  matchDetails: {
    // Name field scores (0-100%)
    lastNameScore: number;
    firstNameScore: number;
    middleNameScore: number;
    extensionScore: number;
    nameScore: number;  // Combined name score
    
    // Birthdate component matches
    birthMonthMatch: boolean;
    birthDayMatch: boolean;
    birthYearMatch: boolean;
    birthDateScore: number;  // Combined birthdate score
  };
}

const DuplicateCheck = () => {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [minConfidence, setMinConfidence] = useState(70);
  const [selectedMatch, setSelectedMatch] = useState<DuplicateMatch | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    findDuplicates();
  }, [minConfidence]);

  // Normalize text by removing extra spaces, punctuation, and converting to lowercase
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  };

  // Create full name from citizen data
  const createFullName = (citizen: Citizen): string => {
    const parts = [
      citizen.last_name,
      citizen.first_name,
      citizen.middle_name || ''
    ].filter(part => part.trim() !== '');
    
    return normalizeText(parts.join(' '));
  };

  // Calculate Levenshtein distance for string similarity
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  // Calculate similarity percentage between two strings
  const calculateSimilarity = (str1: string, str2: string): number => {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 100;
    
    const distance = levenshteinDistance(str1, str2);
    return ((maxLength - distance) / maxLength) * 100;
  };

  // Calculate confidence score based on individual field matching
  // Equal weighting: Each of the 7 fields contributes 14.3% (1/7) to the total score
  const calculateConfidenceScore = (citizen1: Citizen, citizen2: Citizen) => {
    const FIELD_WEIGHT = 100 / 7; // 14.285714% per field
    
    // === NAME FIELD SCORING (14.3% each) ===
    
    // Last Name (14.3% of total)
    const lastName1 = normalizeText(citizen1.last_name);
    const lastName2 = normalizeText(citizen2.last_name);
    const lastNameScore = calculateSimilarity(lastName1, lastName2);
    
    // First Name (14.3% of total)
    const firstName1 = normalizeText(citizen1.first_name);
    const firstName2 = normalizeText(citizen2.first_name);
    const firstNameScore = calculateSimilarity(firstName1, firstName2);
    
    // Middle Name (14.3% of total) - handle nulls
    const middleName1 = normalizeText(citizen1.middle_name || '');
    const middleName2 = normalizeText(citizen2.middle_name || '');
    const middleNameScore = calculateSimilarity(middleName1, middleName2);
    
    // Extension Name (14.3% of total) - handle nulls
    const extensionName1 = normalizeText(citizen1.extension_name || '');
    const extensionName2 = normalizeText(citizen2.extension_name || '');
    const extensionScore = calculateSimilarity(extensionName1, extensionName2);
    
    // === BIRTHDATE COMPONENT SCORING (14.3% each) ===
    
    const date1 = new Date(citizen1.birth_date);
    const date2 = new Date(citizen2.birth_date);
    
    // Birth Month (14.3% of total)
    const birthMonthMatch = date1.getMonth() === date2.getMonth();
    const birthMonthScore = birthMonthMatch ? 100 : 0;
    
    // Birth Day (14.3% of total)
    const birthDayMatch = date1.getDate() === date2.getDate();
    const birthDayScore = birthDayMatch ? 100 : 0;
    
    // Birth Year (14.3% of total)
    const birthYearMatch = date1.getFullYear() === date2.getFullYear();
    const birthYearScore = birthYearMatch ? 100 : 0;
    
    // === FINAL CONFIDENCE SCORE ===
    // Sum all 7 fields, each weighted at 14.3%
    const confidenceScore = (
      (lastNameScore * FIELD_WEIGHT / 100) +
      (firstNameScore * FIELD_WEIGHT / 100) +
      (middleNameScore * FIELD_WEIGHT / 100) +
      (extensionScore * FIELD_WEIGHT / 100) +
      (birthMonthScore * FIELD_WEIGHT / 100) +
      (birthDayScore * FIELD_WEIGHT / 100) +
      (birthYearScore * FIELD_WEIGHT / 100)
    );
    
    // Calculate combined scores for display purposes
    const nameScore = (lastNameScore + firstNameScore + middleNameScore + extensionScore) / 4;
    const birthDateScore = (birthMonthScore + birthDayScore + birthYearScore) / 3;
    
    return {
      confidenceScore: Math.round(confidenceScore),
      matchDetails: {
        lastNameScore: Math.round(lastNameScore),
        firstNameScore: Math.round(firstNameScore),
        middleNameScore: Math.round(middleNameScore),
        extensionScore: Math.round(extensionScore),
        nameScore: Math.round(nameScore),
        birthMonthMatch,
        birthDayMatch,
        birthYearMatch,
        birthDateScore: Math.round(birthDateScore)
      }
    };
  };

  const findDuplicates = async () => {
    setLoading(true);
    try {
      // Fetch "Encoded" status citizens (new entries to check)
      const { data: encodedCitizens, error: encodedError } = await supabase
        .from('citizens')
        .select('id, last_name, first_name, middle_name, extension_name, birth_date, province_code, lgu_code, barangay_code, status')
        .eq('status', 'Encoded')
        .order('last_name, first_name');

      if (encodedError) {
        throw new Error(encodedError.message || 'Failed to fetch encoded citizens');
      }

      // Fetch all non-"Encoded" status citizens (existing verified records)
      const { data: nonEncodedCitizens, error: nonEncodedError } = await supabase
        .from('citizens')
        .select('id, last_name, first_name, middle_name, extension_name, birth_date, province_code, lgu_code, barangay_code, status')
        .neq('status', 'Encoded')
        .order('last_name, first_name');

      if (nonEncodedError) {
        throw new Error(nonEncodedError.message || 'Failed to fetch non-encoded citizens');
      }

      // Fetch all provinces, lgus, and barangays for mapping (handle large datasets)
      const [provincesRes, lgusRes] = await Promise.all([
        supabase.from('provinces').select('code, name'),
        supabase.from('lgus').select('code, name')
      ]);

      // Fetch ALL barangays (there might be more than 1000)
      let allBarangays: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('barangays')
          .select('code, name')
          .range(from, from + batchSize - 1);
        
        if (error) {
          console.error('Error fetching barangays:', error);
          break;
        }
        
        if (data) {
          allBarangays = [...allBarangays, ...data];
          hasMore = data.length === batchSize;
          from += batchSize;
        } else {
          hasMore = false;
        }
      }

      // Create lookup maps for faster access
      const provincesMap = new Map(provincesRes.data?.map(p => [p.code, p.name]) || []);
      const lgusMap = new Map(lgusRes.data?.map(l => [l.code, l.name]) || []);
      const barangaysMap = new Map(allBarangays.map(b => [b.code, b.name]));

      // Map the data to include the address names
      const mapCitizen = (citizen: any): Citizen => ({
        ...citizen,
        province_name: provincesMap.get(citizen.province_code) || '',
        lgu_name: lgusMap.get(citizen.lgu_code) || '',
        barangay_name: barangaysMap.get(citizen.barangay_code) || ''
      });

      const mappedEncodedCitizens = encodedCitizens?.map(mapCitizen) || [];
      const mappedNonEncodedCitizens = nonEncodedCitizens?.map(mapCitizen) || [];

      const encodedCount = encodedCitizens?.length || 0;
      const nonEncodedCount = nonEncodedCitizens?.length || 0;
      setTotalRecords(encodedCount + nonEncodedCount);

      const duplicateMatches: DuplicateMatch[] = [];
      
      // Only compare "Encoded" citizens against non-"Encoded" citizens
      // This prevents heavy O(n²) comparisons and focuses on new vs existing records
      if (mappedEncodedCitizens.length > 0 && mappedNonEncodedCitizens.length > 0) {
        for (let i = 0; i < mappedEncodedCitizens.length; i++) {
          const encodedCitizen = mappedEncodedCitizens[i];
          
          for (let j = 0; j < mappedNonEncodedCitizens.length; j++) {
            const nonEncodedCitizen = mappedNonEncodedCitizens[j];
            
            const { confidenceScore, matchDetails } = calculateConfidenceScore(encodedCitizen, nonEncodedCitizen);
            
            // Only include matches above minimum confidence threshold
            if (confidenceScore >= minConfidence) {
              duplicateMatches.push({
                citizen1: encodedCitizen,
                citizen2: nonEncodedCitizen,
                confidenceScore,
                matchDetails
              });
            }
          }
        }
      }

      // Sort by confidence score (highest first)
      duplicateMatches.sort((a, b) => b.confidenceScore - a.confidenceScore);
      
      setMatches(duplicateMatches);
    } catch (error) {
      console.error('Error finding duplicates:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFullName = (citizen: Citizen): string => {
    const parts = [
      citizen.last_name,
      citizen.first_name,
      citizen.middle_name || ''
    ].filter(part => part.trim() !== '');
    
    return parts.join(' ') + (citizen.extension_name ? ` (${citizen.extension_name})` : '');
  };

  const getConfidenceColor = (score: number): string => {
    if (score >= 90) return 'text-red-700';
    if (score >= 80) return 'text-orange-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getConfidenceBadgeColor = (score: number): string => {
    if (score >= 90) return 'bg-red-100 text-red-800 border-red-200';
    if (score >= 80) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getConfidenceLabel = (score: number): string => {
    if (score >= 90) return 'Very High';
    if (score >= 80) return 'High';
    if (score >= 70) return 'Medium';
    return 'Low';
  };

  const openModal = (match: DuplicateMatch) => {
    setSelectedMatch(match);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedMatch(null);
  };

  // Pagination
  const totalPages = Math.ceil(matches.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMatches = matches.slice(startIndex, endIndex);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Duplicate Record Detection</h1>
              <p className="mt-2 text-gray-600">
                Advanced fullname matching with confidence scoring
              </p>
            </div>
            <button
              onClick={findDuplicates}
              disabled={loading}
              className={`mt-4 sm:mt-0 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  Analyzing...
                </>
              ) : (
                'Scan for Duplicates'
              )}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <label htmlFor="confidence-slider" className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Confidence Threshold: {minConfidence}%
              </label>
              <input
                id="confidence-slider"
                type="range"
                min="50"
                max="95"
                step="5"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>50% (Low)</span>
                <span>70% (Medium)</span>
                <span>90% (High)</span>
                <span>95% (Very High)</span>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <div>Total Records: <span className="font-semibold">{totalRecords.toLocaleString()}</span></div>
              <div>Potential Duplicates: <span className="font-semibold text-red-600">{matches.length}</span></div>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-gray-600">Analyzing records for potential duplicates...</p>
            </div>
          </div>
        ) : matches.length > 0 ? (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Record 1
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Record 2
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Confidence Score
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Match Type
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentMatches.map((match, index) => (
                      <tr
                        key={`${match.citizen1.id}-${match.citizen2.id}`}
                        onClick={() => openModal(match)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatFullName(match.citizen1)}
                          </div>
                          <div className="text-sm text-gray-500">
                            Born: {format(new Date(match.citizen1.birth_date), 'MMM dd, yyyy')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatFullName(match.citizen2)}
                          </div>
                          <div className="text-sm text-gray-500">
                            Born: {format(new Date(match.citizen2.birth_date), 'MMM dd, yyyy')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getConfidenceBadgeColor(match.confidenceScore)}`}>
                              {match.confidenceScore}%
                            </span>
                            <span className={`ml-2 text-xs font-medium ${getConfidenceColor(match.confidenceScore)}`}>
                              {getConfidenceLabel(match.confidenceScore)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex flex-col gap-1">
                            <div className="text-xs">
                              <span className="font-medium">Names:</span> {match.matchDetails.nameScore}%
                            </div>
                            <div className="text-xs">
                              <span className="font-medium">Birth:</span> {match.matchDetails.birthDateScore}%
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                        <span className="font-medium">{Math.min(endIndex, matches.length)}</span> of{' '}
                        <span className="font-medium">{matches.length}</span> potential duplicates
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No duplicates found</h3>
              <p className="mt-1 text-sm text-gray-500">
                No potential duplicate records found with the current confidence threshold of {minConfidence}%.
              </p>
            </div>
          </div>
        )}

        {/* Detail Modal - Ultra Compact Version */}
        {showModal && selectedMatch && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-6xl shadow-lg rounded-md bg-white max-h-[95vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between z-10">
                <h3 className="text-lg font-bold text-gray-900">Duplicate Analysis - {selectedMatch.confidenceScore}% Match</h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4">
                {/* Records & Analysis Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {/* Record 1 - Compact */}
                  <div className="bg-blue-50 rounded p-3 border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-blue-900">New Entry</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">{selectedMatch.citizen1.status}</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold text-blue-900">{formatFullName(selectedMatch.citizen1)}</p>
                      <p className="text-blue-700">Born: {format(new Date(selectedMatch.citizen1.birth_date), 'MMM dd, yyyy')}</p>
                      <p className="text-blue-600">
                        {selectedMatch.citizen1.barangay_name || selectedMatch.citizen1.barangay_code}, {selectedMatch.citizen1.lgu_name || selectedMatch.citizen1.lgu_code}
                      </p>
                      <p className="text-blue-500 text-[10px]">ID: #{selectedMatch.citizen1.id}</p>
                    </div>
                  </div>

                  {/* Record 2 - Compact */}
                  <div className="bg-green-50 rounded p-3 border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-green-900">Existing Record</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">{selectedMatch.citizen2.status}</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold text-green-900">{formatFullName(selectedMatch.citizen2)}</p>
                      <p className="text-green-700">Born: {format(new Date(selectedMatch.citizen2.birth_date), 'MMM dd, yyyy')}</p>
                      <p className="text-green-600">
                        {selectedMatch.citizen2.barangay_name || selectedMatch.citizen2.barangay_code}, {selectedMatch.citizen2.lgu_name || selectedMatch.citizen2.lgu_code}
                      </p>
                      <p className="text-green-500 text-[10px]">ID: #{selectedMatch.citizen2.id}</p>
                    </div>
                  </div>

                  {/* Overall Score - Compact */}
                  <div className="bg-gray-50 rounded p-3 border border-gray-200">
                    <h4 className="text-sm font-bold text-gray-900 mb-2">Confidence</h4>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-3xl font-bold ${getConfidenceColor(selectedMatch.confidenceScore)}`}>
                        {selectedMatch.confidenceScore}%
                      </span>
                      <span className={`text-xs font-semibold ${getConfidenceColor(selectedMatch.confidenceScore)}`}>
                        {getConfidenceLabel(selectedMatch.confidenceScore)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          selectedMatch.confidenceScore >= 90 ? 'bg-red-500' :
                          selectedMatch.confidenceScore >= 80 ? 'bg-orange-500' :
                          selectedMatch.confidenceScore >= 70 ? 'bg-yellow-500' : 'bg-gray-500'
                        }`}
                        style={{ width: `${selectedMatch.confidenceScore}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Field Analysis - Horizontal Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                  {/* Name Fields */}
                  <div className="bg-indigo-50 rounded p-3 border border-indigo-200">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-sm font-bold text-indigo-900">Name Fields (14.3% each)</h5>
                      <span className="text-sm font-bold text-indigo-600">{selectedMatch.matchDetails.nameScore}%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-gray-600">Last</span>
                          <span className="font-semibold">{selectedMatch.matchDetails.lastNameScore}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${selectedMatch.matchDetails.lastNameScore}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-gray-600">First</span>
                          <span className="font-semibold">{selectedMatch.matchDetails.firstNameScore}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${selectedMatch.matchDetails.firstNameScore}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-gray-600">Middle</span>
                          <span className="font-semibold">{selectedMatch.matchDetails.middleNameScore}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${selectedMatch.matchDetails.middleNameScore}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-gray-600">Ext.</span>
                          <span className="font-semibold">{selectedMatch.matchDetails.extensionScore}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${selectedMatch.matchDetails.extensionScore}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Birthdate Fields */}
                  <div className="bg-purple-50 rounded p-3 border border-purple-200">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-sm font-bold text-purple-900">Birthdate Fields (14.3% each)</h5>
                      <span className="text-sm font-bold text-purple-600">{selectedMatch.matchDetails.birthDateScore}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className={`p-2 rounded text-center ${selectedMatch.matchDetails.birthMonthMatch ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                        <div className="text-[10px] font-medium text-gray-700">Month</div>
                        <div className={`text-base font-bold ${selectedMatch.matchDetails.birthMonthMatch ? 'text-green-700' : 'text-red-700'}`}>
                          {selectedMatch.matchDetails.birthMonthMatch ? '✓' : '✗'}
                        </div>
                      </div>
                      <div className={`p-2 rounded text-center ${selectedMatch.matchDetails.birthDayMatch ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                        <div className="text-[10px] font-medium text-gray-700">Day</div>
                        <div className={`text-base font-bold ${selectedMatch.matchDetails.birthDayMatch ? 'text-green-700' : 'text-red-700'}`}>
                          {selectedMatch.matchDetails.birthDayMatch ? '✓' : '✗'}
                        </div>
                      </div>
                      <div className={`p-2 rounded text-center ${selectedMatch.matchDetails.birthYearMatch ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                        <div className="text-[10px] font-medium text-gray-700">Year</div>
                        <div className={`text-base font-bold ${selectedMatch.matchDetails.birthYearMatch ? 'text-green-700' : 'text-red-700'}`}>
                          {selectedMatch.matchDetails.birthYearMatch ? '✓' : '✗'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DuplicateCheck;
