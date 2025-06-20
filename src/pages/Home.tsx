import { useState, useEffect } from 'react';
import { MessageSquare, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
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
     
    </div>
  );
}

export default Home;
