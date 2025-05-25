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
}

interface DuplicateMatch {
  citizen1: Citizen;
  citizen2: Citizen;
  confidenceScore: number;
  matchDetails: {
    fullNameSimilarity: number;
    birthDateMatch: boolean;
    exactNameMatch: boolean;
    partialNameMatch: boolean;
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

  // Calculate confidence score based on multiple factors
  const calculateConfidenceScore = (citizen1: Citizen, citizen2: Citizen) => {
    const fullName1 = createFullName(citizen1);
    const fullName2 = createFullName(citizen2);
    
    // Full name similarity (weighted heavily)
    const fullNameSimilarity = calculateSimilarity(fullName1, fullName2);
    
    // Check for exact name match (after normalization)
    const exactNameMatch = fullName1 === fullName2;
    
    // Check for partial name matches (individual components)
    const lastName1 = normalizeText(citizen1.last_name);
    const lastName2 = normalizeText(citizen2.last_name);
    const firstName1 = normalizeText(citizen1.first_name);
    const firstName2 = normalizeText(citizen2.first_name);
    
    const lastNameMatch = lastName1 === lastName2;
    const firstNameMatch = firstName1 === firstName2;
    const partialNameMatch = lastNameMatch || firstNameMatch;
    
    // Birth date comparison
    const birthDateMatch = citizen1.birth_date === citizen2.birth_date;
    
    // Calculate weighted confidence score
    let confidenceScore = 0;
    
    // Full name similarity (60% weight)
    confidenceScore += fullNameSimilarity * 0.6;
    
    // Exact name match bonus (25% weight)
    if (exactNameMatch) {
      confidenceScore += 25;
    }
    
    // Birth date match bonus (15% weight)
    if (birthDateMatch) {
      confidenceScore += 15;
    }
    
    // Partial name match bonus (10% weight)
    if (partialNameMatch && !exactNameMatch) {
      confidenceScore += 10;
    }
    
    // Cap at 100%
    confidenceScore = Math.min(confidenceScore, 100);
    
    return {
      confidenceScore: Math.round(confidenceScore),
      matchDetails: {
        fullNameSimilarity: Math.round(fullNameSimilarity),
        birthDateMatch,
        exactNameMatch,
        partialNameMatch
      }
    };
  };

  const findDuplicates = async () => {
    setLoading(true);
    try {
      const { data: citizens, error } = await supabase
        .from('citizens')
        .select('id, last_name, first_name, middle_name, extension_name, birth_date')
        .order('last_name, first_name');

      if (error || !citizens) {
        throw new Error(error?.message || 'Failed to fetch citizens data');
      }

      setTotalRecords(citizens.length);

      const duplicateMatches: DuplicateMatch[] = [];
      
      // Compare each citizen with every other citizen
      for (let i = 0; i < citizens.length; i++) {
        for (let j = i + 1; j < citizens.length; j++) {
          const citizen1 = citizens[i];
          const citizen2 = citizens[j];
          
          const { confidenceScore, matchDetails } = calculateConfidenceScore(citizen1, citizen2);
          
          // Only include matches above minimum confidence threshold
          if (confidenceScore >= minConfidence) {
            duplicateMatches.push({
              citizen1,
              citizen2,
              confidenceScore,
              matchDetails
            });
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
                          <div className="space-y-1">
                            {match.matchDetails.exactNameMatch && (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                                Exact Name
                              </span>
                            )}
                            {match.matchDetails.birthDateMatch && (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                Same Birth Date
                              </span>
                            )}
                            {match.matchDetails.partialNameMatch && !match.matchDetails.exactNameMatch && (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                Partial Name
                              </span>
                            )}
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

        {/* Detail Modal */}
        {showModal && selectedMatch && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Duplicate Match Analysis</h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-150"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Record 1 */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="text-lg font-semibold text-blue-900 mb-3">Record 1</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-blue-700">Full Name:</span>
                      <p className="text-blue-900">{formatFullName(selectedMatch.citizen1)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-blue-700">Normalized:</span>
                      <p className="text-blue-900 font-mono text-sm">{createFullName(selectedMatch.citizen1)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-blue-700">Birth Date:</span>
                      <p className="text-blue-900">{format(new Date(selectedMatch.citizen1.birth_date), 'MMMM dd, yyyy')}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-blue-700">ID:</span>
                      <p className="text-blue-900">#{selectedMatch.citizen1.id}</p>
                    </div>
                  </div>
                </div>

                {/* Record 2 */}
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h4 className="text-lg font-semibold text-green-900 mb-3">Record 2</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-green-700">Full Name:</span>
                      <p className="text-green-900">{formatFullName(selectedMatch.citizen2)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-green-700">Normalized:</span>
                      <p className="text-green-900 font-mono text-sm">{createFullName(selectedMatch.citizen2)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-green-700">Birth Date:</span>
                      <p className="text-green-900">{format(new Date(selectedMatch.citizen2.birth_date), 'MMMM dd, yyyy')}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-green-700">ID:</span>
                      <p className="text-green-900">#{selectedMatch.citizen2.id}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Match Analysis */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Match Analysis</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Overall Confidence</span>
                      <span className={`text-2xl font-bold ${getConfidenceColor(selectedMatch.confidenceScore)}`}>
                        {selectedMatch.confidenceScore}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          selectedMatch.confidenceScore >= 90 ? 'bg-red-500' :
                          selectedMatch.confidenceScore >= 80 ? 'bg-orange-500' :
                          selectedMatch.confidenceScore >= 70 ? 'bg-yellow-500' : 'bg-gray-500'
                        }`}
                        style={{ width: `${selectedMatch.confidenceScore}%` }}
                      ></div>
                    </div>
                    <p className={`text-sm mt-1 ${getConfidenceColor(selectedMatch.confidenceScore)}`}>
                      {getConfidenceLabel(selectedMatch.confidenceScore)} Risk
                    </p>
                  </div>

                  <div>
                    <span className="text-sm font-medium text-gray-700">Name Similarity</span>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-gray-900">
                        {selectedMatch.matchDetails.fullNameSimilarity}%
                      </span>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${selectedMatch.matchDetails.fullNameSimilarity}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className={`p-3 rounded-lg border ${
                    selectedMatch.matchDetails.exactNameMatch 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${
                        selectedMatch.matchDetails.exactNameMatch ? 'bg-red-500' : 'bg-gray-300'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-700">Exact Name Match</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border ${
                    selectedMatch.matchDetails.birthDateMatch 
                      ? 'bg-orange-50 border-orange-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${
                        selectedMatch.matchDetails.birthDateMatch ? 'bg-orange-500' : 'bg-gray-300'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-700">Birth Date Match</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border ${
                    selectedMatch.matchDetails.partialNameMatch 
                      ? 'bg-yellow-50 border-yellow-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${
                        selectedMatch.matchDetails.partialNameMatch ? 'bg-yellow-500' : 'bg-gray-300'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-700">Partial Name Match</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DuplicateCheck;
