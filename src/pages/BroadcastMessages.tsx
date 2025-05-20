import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { AlertCircle, Calendar, Check, Edit, MessageSquare, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../lib/database.types';

type BroadcastMessage = Database['public']['Tables']['broadcast_messages']['Row'];

interface BroadcastMessageFormData {
  message: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
}

function BroadcastMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<BroadcastMessageFormData>({
    defaultValues: {
      message: '',
      is_active: true,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  });

  // Load broadcast messages
  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('broadcast_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching broadcast messages:', error);
      toast.error('Failed to load broadcast messages');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: BroadcastMessageFormData) => {
    try {
      if (editingId) {
        // Update existing message
        const { error } = await supabase
          .from('broadcast_messages')
          .update({
            message: data.message,
            is_active: data.is_active,
            start_date: new Date(data.start_date).toISOString(),
            end_date: new Date(data.end_date).toISOString()
          })
          .eq('id', editingId);

        if (error) throw error;
       
        toast.success('Broadcast message updated successfully');
      } else {
        // Create new message
        const { data: newMessage, error } = await supabase
          .from('broadcast_messages')
          .insert({
            message: data.message,
            is_active: data.is_active,
            start_date: new Date(data.start_date).toISOString(),
            end_date: new Date(data.end_date).toISOString(),
            created_by: user?.id
          })
          .select()
          .single();

        if (error) throw error;

        
        toast.success('Broadcast message created successfully');
      }

      // Reset form and refresh messages
      reset();
      setIsAdding(false);
      setEditingId(null);
      fetchMessages();
    } catch (error) {
      console.error('Error saving broadcast message:', error);
      toast.error('Failed to save broadcast message');
    }
  };

  const handleEdit = (message: BroadcastMessage) => {
    setEditingId(message.id);
    reset({
      message: message.message,
      is_active: message.is_active,
      start_date: new Date(message.start_date).toISOString().split('T')[0],
      end_date: new Date(message.end_date).toISOString().split('T')[0]
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this broadcast message?')) return;

    try {
      const { error } = await supabase
        .from('broadcast_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;

     
      toast.success('Broadcast message deleted successfully');
      fetchMessages();
    } catch (error) {
      console.error('Error deleting broadcast message:', error);
      toast.error('Failed to delete broadcast message');
    }
  };

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('broadcast_messages')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      
      toast.success(`Broadcast message ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchMessages();
    } catch (error) {
      console.error('Error updating broadcast message status:', error);
      toast.error('Failed to update broadcast message status');
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Broadcast Messages</h2>
          <p className="text-gray-600">Manage temporary messages shown to users after login</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
              reset({
                message: '',
                is_active: true,
                start_date: new Date().toISOString().split('T')[0],
                end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              });
            }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Message
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Broadcast Message' : 'Create New Broadcast Message'}
          </h3>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Message Content
                </label>
                <textarea
                  id="message"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter the message to display to users after login"
                  {...register('message', { required: 'Message content is required' })}
                ></textarea>
                {errors.message && (
                  <p className="mt-1 text-sm text-red-500 flex items-center">
                    <AlertCircle className="h-3.5 w-3.5 mr-1" />
                    {errors.message.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      id="start_date"
                      className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      {...register('start_date', { required: 'Start date is required' })}
                    />
                  </div>
                  {errors.start_date && (
                    <p className="mt-1 text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-3.5 w-3.5 mr-1" />
                      {errors.start_date.message}
                    </p>
                  )}
                </div>

                <div className="flex-1">
                  <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      id="end_date"
                      className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      {...register('end_date', { required: 'End date is required' })}
                    />
                  </div>
                  {errors.end_date && (
                    <p className="mt-1 text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-3.5 w-3.5 mr-1" />
                      {errors.end_date.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  {...register('is_active')}
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                  Active
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                    reset();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {editingId ? 'Update Message' : 'Create Message'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : messages.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No broadcast messages</h3>
          <p className="text-gray-500 mb-4">
            Create your first broadcast message to display important information to users after login.
          </p>
          {!isAdding && (
            <button
              onClick={() => {
                setIsAdding(true);
                reset({
                  message: '',
                  is_active: true,
                  start_date: new Date().toISOString().split('T')[0],
                  end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                });
              }}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Message
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-md">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Range
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {messages.map((message) => (
                <tr key={message.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-normal">
                    <div className="text-sm text-gray-900">{message.message}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {formatDate(message.start_date)} - {formatDate(message.end_date)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        message.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {message.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleToggleActive(message.id, message.is_active)}
                        className={`p-1 rounded-md ${
                          message.is_active
                            ? 'text-red-600 hover:bg-red-100'
                            : 'text-green-600 hover:bg-green-100'
                        }`}
                        title={message.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {message.is_active ? (
                          <X className="h-5 w-5" />
                        ) : (
                          <Check className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(message)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded-md"
                        title="Edit"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(message.id)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded-md"
                        title="Delete"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default BroadcastMessages;
