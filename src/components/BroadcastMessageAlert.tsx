import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../lib/database.types';

type BroadcastMessage = Database['public']['Tables']['broadcast_messages']['Row'];

function BroadcastMessageAlert() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
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

      if (activeMessages && activeMessages.length > 0) {
        // Fetch messages that the user has already viewed
        const { data: viewedMessages, error: viewedError } = await supabase
          .from('broadcast_message_views')
          .select('message_id')
          .eq('staff_id', user.id);

        if (viewedError) throw viewedError;

        // Filter out messages that the user has already viewed
        const viewedMessageIds = viewedMessages?.map(vm => vm.message_id) || [];
        const unviewedMessages = activeMessages.filter(
          message => !viewedMessageIds.includes(message.id)
        );

        setMessages(unviewedMessages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching broadcast messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessageAsViewed = async (messageId: number) => {
    if (!user) return;
    
    try {
      // We don't need to check for existing views since we have a UNIQUE constraint
      // in the database that will prevent duplicate views
      
      const { error } = await supabase
        .from('broadcast_message_views')
        .insert({
          message_id: messageId,
          staff_id: user.id
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error marking message as viewed:', error);
    }
  };

  const dismissCurrentMessage = async () => {
    if (messages.length === 0) return;
    
    const currentMessage = messages[currentMessageIndex];
    await markMessageAsViewed(currentMessage.id);
    
    if (currentMessageIndex < messages.length - 1) {
      // Move to the next message
      setCurrentMessageIndex(currentMessageIndex + 1);
    } else {
      // No more messages to show
      setMessages([]);
      setCurrentMessageIndex(0);
    }
  };

  if (loading || messages.length === 0) {
    return null;
  }

  const currentMessage = messages[currentMessageIndex];

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center p-4">
      <div className="w-full max-w-3xl bg-blue-50 border border-blue-200 rounded-lg shadow-lg">
        <div className="p-4 flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-lg text-blue-800 whitespace-pre-line font-large">
              {currentMessage.message}
            </p>
            {messages.length > 1 && (
              <p className="mt-2 text-sm text-blue-600">
                Message {currentMessageIndex + 1} of {messages.length}
              </p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              type="button"
              onClick={dismissCurrentMessage}
              className="inline-flex text-blue-500 hover:text-blue-700 focus:outline-none"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BroadcastMessageAlert;
