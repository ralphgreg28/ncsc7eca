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

interface Match {
  citizen1: Citizen;
  citizen2: Citizen;
  matchedFields: string[];
  confidenceScore: number;
}

const DuplicateCheck = () => {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [minConfidence, setMinConfidence] = useState(50);
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({
    last_name: true,
    first_name: true,
    middle_name: true,
    extension_name: true,
    birth_date: true,
    birth_month: true,
    birth_day: true,
    birth_year: true,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    findDuplicates();
  }, [minConfidence, selectedFields]);

  const findDuplicates = async () => {
    setLoading(true);
    try {
      const { data: citizens, error } = await supabase
        .from('citizens')
        .select('id, last_name, first_name, middle_name, extension_name, birth_date')
        .order('last_name');

      if (error || !citizens) throw new Error(error?.message || 'No citizens data');

      const potentialMatches = findPotentialMatches(citizens);
      const filteredMatches = potentialMatches
        .filter((match) => match.confidenceScore >= minConfidence)
        .sort((a, b) => b.confidenceScore - a.confidenceScore);

      setMatches(filteredMatches);
    } catch (error) {
      console.error('Error finding duplicates:', error);
    } finally {
      setLoading(false);
    }
  };

  const findPotentialMatches = (citizens: Citizen[]): Match[] => {
    const potentialMatches: Match[] = [];
    for (let i = 0; i < citizens.length; i++) {
      for (let j = i + 1; j < citizens.length; j++) {
        const citizen1 = citizens[i];
        const citizen2 = citizens[j];
        const matchedFields = getMatchedFields(citizen1, citizen2);

        if (matchedFields.length >= 2) {
          potentialMatches.push({
            citizen1,
            citizen2,
            matchedFields,
            confidenceScore: (matchedFields.length / 8) * 100,
          });
        }
      }
    }
    return potentialMatches;
  };

  const getMatchedFields = (c1: Citizen, c2: Citizen): string[] => {
    const matched: string[] = [];
    if (selectedFields.last_name && c1.last_name.toLowerCase() === c2.last_name.toLowerCase()) matched.push('last_name');
    if (selectedFields.first_name && c1.first_name.toLowerCase() === c2.first_name.toLowerCase()) matched.push('first_name');
    if (selectedFields.middle_name && (c1.middle_name?.toLowerCase() || '') === (c2.middle_name?.toLowerCase() || '')) matched.push('middle_name');
    if (selectedFields.extension_name && c1.extension_name?.toLowerCase() === c2.extension_name?.toLowerCase()) matched.push('extension_name');
    if (selectedFields.birth_date && c1.birth_date === c2.birth_date) matched.push('birth_date');

    const d1 = new Date(c1.birth_date);
    const d2 = new Date(c2.birth_date);

    if (selectedFields.birth_month && d1.getMonth() === d2.getMonth()) matched.push('birth_month');
    if (selectedFields.birth_day && d1.getDate() === d2.getDate()) matched.push('birth_day');
    if (selectedFields.birth_year && d1.getFullYear() === d2.getFullYear()) matched.push('birth_year');

    return matched;
  };

  const formatName = (c: Citizen) =>
    `${c.last_name} ${c.first_name} ${c.middle_name || ''} ${c.extension_name ? `(${c.extension_name})` : ''}`;

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBg = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const paginateMatches = (matches: Match[], page: number, perPage: number) => {
    const start = (page - 1) * perPage;
    return matches.slice(start, start + perPage);
  };

  const totalPages = Math.ceil(matches.length / itemsPerPage);

  const formatDate = (date: string) => format(new Date(date), 'MM/dd/yyyy');

  const handleCheckboxChange = (field: string) => {
    setSelectedFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const openModal = (match: Match) => {
    setSelectedMatch(match);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedMatch(null);
  };

  return (
    <div className="space-y-6 px-4 py-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Duplicate Record Check</h1>
          <p className="mt-2 text-gray-600">Identify potentially duplicate senior citizen records</p>
        </div>
        <button
          onClick={findDuplicates}
          disabled={loading}
          className={`btn-primary flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : 'Check for Duplicates'}
        </button>
      </div>

      {/* Matching Fields Controls */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-gray-800">Select Matching Fields</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
          {Object.keys(selectedFields).map((field) => (
            <label key={field} className="flex items-center space-x-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={selectedFields[field]}
                onChange={() => handleCheckboxChange(field)}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
              />
              <span>{field.replace(/_/g, ' ').toUpperCase()}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Confidence Slider */}
      <div className="mt-6">
        <label htmlFor="confidence-slider" className="block text-sm font-medium text-gray-700">Set Minimum Confidence Level</label>
        <input
          id="confidence-slider"
          type="range"
          min="0"
          max="100"
          value={minConfidence}
          onChange={(e) => setMinConfidence(Number(e.target.value))}
          className="mt-2 w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span>{minConfidence}%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Matches Table */}
      {matches.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Record 1</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Record 2</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Confidence</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginateMatches(matches, currentPage, itemsPerPage).map((match, idx) => (
                  <tr key={idx} onClick={() => openModal(match)} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{formatName(match.citizen1)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{formatName(match.citizen2)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full font-medium ${getConfidenceColor(match.confidenceScore)} ${getConfidenceBg(match.confidenceScore)}`}>
                        {match.confidenceScore.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-3 flex justify-between items-center bg-gray-50">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="btn-pagination"
            >
              Prev
            </button>
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="btn-pagination"
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        !loading && <p className="text-gray-500 mt-6">No matches found</p>
      )}

      {/* Modal */}
      {modalOpen && selectedMatch && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg overflow-hidden shadow-lg max-w-4xl w-full p-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Match Details</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              {['last_name', 'first_name', 'middle_name', 'extension_name', 'birth_date'].map((field) => {
                const value1 = selectedMatch.citizen1[field as keyof Citizen] || '';
                const value2 = selectedMatch.citizen2[field as keyof Citizen] || '';
                const isMatched = selectedMatch.matchedFields.includes(field);
                return (
                  <div key={field} className={`p-3 rounded-md ${isMatched ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <p className="text-sm text-gray-500 font-medium">{field.replace(/_/g, ' ').toUpperCase()}</p>
                    <p className="text-gray-900 text-sm">{value1} ↔ {value2}</p>
                  </div>
                );
              })}
              <div className="col-span-2 text-right text-lg font-semibold mt-4">
                Confidence Score:
                <span className={`ml-2 ${getConfidenceColor(selectedMatch.confidenceScore)}`}>
                  {selectedMatch.confidenceScore.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={closeModal} className="btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DuplicateCheck;
