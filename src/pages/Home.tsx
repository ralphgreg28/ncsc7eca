import { useState, useEffect } from 'react';
import { MessageSquare, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../lib/database.types';

type BroadcastMessage = Database['public']['Tables']['broadcast_messages']['Row'];

function Home() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchActiveMessages();
    }
  }, [user]);

  const fetchActiveMessages = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const now = new Date().toISOString();
      
      // Fetch active messages that are within the date range
      const { data: activeMessages, error } = await supabase
        .from('broadcast_messages')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(activeMessages || []);
    } catch (error) {
      console.error('Error fetching broadcast messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to the Expanded Centenarian Information Management System</h1>
        <p className="mt-1 text-gray-600">National Commission of Senior Citizens</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
          Latest Announcements
        </h2>
        
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No announcements</h3>
            <p className="text-gray-500">
              There are no active announcements at this time.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className="bg-blue-50 border border-blue-200 rounded-lg p-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-lg text-blue-800 whitespace-pre-line">
                      {message.message}
                    </p>
                    <p className="mt-2 text-sm text-blue-600">
                      Valid until: {formatDate(message.end_date)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <a 
            href="/dashboard" 
            className="bg-blue-50 hover:bg-blue-100 transition-colors p-4 rounded-lg flex flex-col items-center text-center"
          >
            <div className="bg-blue-100 p-3 rounded-full mb-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-medium text-blue-900">Dashboard</h3>
            <p className="text-sm text-blue-700 mt-1">View analytics and statistics</p>
          </a>
          <a 
            href="/citizens/list" 
            className="bg-indigo-50 hover:bg-indigo-100 transition-colors p-4 rounded-lg flex flex-col items-center text-center"
          >
            <div className="bg-indigo-100 p-3 rounded-full mb-3">
              <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="font-medium text-indigo-900">Senior Citizens Records</h3>
            <p className="text-sm text-indigo-700 mt-1">View and manage senior citizens</p>
          </a>
          
          <a 
            href="/citizens/new" 
            className="bg-green-50 hover:bg-green-100 transition-colors p-4 rounded-lg flex flex-col items-center text-center"
          >
            <div className="bg-green-100 p-3 rounded-full mb-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h3 className="font-medium text-green-900">Encode Potential ECA Beneficiary</h3>
            <p className="text-sm text-green-700 mt-1">Register a new senior citizen</p>
          </a>
          
          <a 
            href="/citizens/duplicates" 
            className="bg-amber-50 hover:bg-amber-100 transition-colors p-4 rounded-lg flex flex-col items-center text-center"
          >
            <div className="bg-amber-100 p-3 rounded-full mb-3">
              <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="font-medium text-amber-900">Duplicate Check</h3>
            <p className="text-sm text-amber-700 mt-1">Find and manage duplicate records</p>
          </a>
        </div>
      </div>
    </div>
  );
}

export default Home;
