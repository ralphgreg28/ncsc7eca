import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Edit2, Trash2, Plus, X, Search, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  extension_name: string | null;
  birth_date: string;
  sex: 'Male' | 'Female';
  position: 'Administrator' | 'PDO';
  status: 'Active' | 'Inactive';
  last_login: string | null;
  assignments?: Assignment[];
}

interface UserFormData {
  username: string;
  password?: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  extension_name?: string;
  birth_date: string;
  sex: 'Male' | 'Female';
  position: 'Administrator' | 'PDO';
  status: 'Active' | 'Inactive';
}

interface Province {
  code: string;
  name: string;
}

interface LGU {
  code: string;
  name: string;
  province_code: string;
}

interface Assignment {
  id?: number;
  staff_id: string;
  province_code: string;
  province_name?: string;
  lgu_code: string | null;
  lgu_name?: string | null;
}

function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [lgus, setLgus] = useState<LGU[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedLgu, setSelectedLgu] = useState<string>('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const { register, handleSubmit, reset, formState: { errors }, watch } = useForm<UserFormData>();
  
  const watchPosition = watch('position');

  useEffect(() => {
    fetchUsers();
    fetchProvinces();
  }, []);

  // Fetch provinces when component mounts
  const fetchProvinces = async () => {
    try {
      const { data, error } = await supabase
        .from('provinces')
        .select('code, name')
        .order('name');
      
      if (error) throw error;
      setProvinces(data || []);
    } catch (error) {
      console.error('Error fetching provinces:', error);
      toast.error('Failed to load provinces');
    }
  };

  // Fetch LGUs when a province is selected
  const fetchLgus = async (provinceCode: string) => {
    try {
      setLgus([]);
      setSelectedLgu('');
      
      const { data, error } = await supabase
        .from('lgus')
        .select('code, name, province_code')
        .eq('province_code', provinceCode)
        .order('name');
      
      if (error) throw error;
      setLgus(data || []);
    } catch (error) {
      console.error('Error fetching LGUs:', error);
      toast.error('Failed to load LGUs');
    }
  };

  // Fetch assignments for a user
  const fetchAssignments = async (userId: string) => {
    try {
      setLoadingAssignments(true);
      
      // Check if the staff_assignments table exists by querying it
      const { error: tableCheckError } = await supabase
        .from('staff_assignments')
        .select('id')
        .limit(1);
      
      // If the table doesn't exist yet (migration not applied), just return empty assignments
      if (tableCheckError) {
        console.warn('Staff assignments table may not exist yet:', tableCheckError);
        setAssignments([]);
        return;
      }
      
      // Get assignments with province and LGU names
      const { data, error } = await supabase
        .from('staff_assignments')
        .select(`
          id,
          staff_id,
          province_code,
          lgu_code
        `)
        .eq('staff_id', userId);
      
      if (error) {
        console.error('Error fetching assignments:', error);
        toast.error(`Failed to load assignments: ${error.message}`);
        setAssignments([]);
        return;
      }
      
      if (!data || data.length === 0) {
        setAssignments([]);
        return;
      }
      
      // Fetch province and LGU names for each assignment
      const assignmentsWithNames = await Promise.all(data.map(async (assignment) => {
        try {
          const [provinceResult, lguResult] = await Promise.all([
            supabase.from('provinces').select('name').eq('code', assignment.province_code).single(),
            assignment.lgu_code 
              ? supabase.from('lgus').select('name').eq('code', assignment.lgu_code).single() 
              : Promise.resolve({ data: null, error: null })
          ]);
          
          return {
            ...assignment,
            province_name: provinceResult.data?.name || 'Unknown Province',
            lgu_name: lguResult.data?.name || null
          };
        } catch (err) {
          console.error('Error fetching province/LGU details:', err);
          return {
            ...assignment,
            province_name: 'Unknown Province',
            lgu_name: null
          };
        }
      }));
      
      setAssignments(assignmentsWithNames);
    } catch (error) {
      console.error('Error in fetchAssignments:', error);
      toast.error('Failed to load assignments. Please try again.');
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  // Add a new assignment
  const addAssignment = async () => {
    if (!selectedProvince) {
      toast.error('Please select a province');
      return;
    }
    
    try {
      // Check if assignment already exists
      const existingAssignment = assignments.find(a => 
        a.province_code === selectedProvince && a.lgu_code === (selectedLgu || null)
      );
      
      if (existingAssignment) {
        toast.warning('This assignment already exists');
        return;
      }
      
      // Get province and LGU names
      const provinceName = provinces.find(p => p.code === selectedProvince)?.name || 'Unknown Province';
      const lguName = selectedLgu ? lgus.find(l => l.code === selectedLgu)?.name || null : null;
      
      if (editingUser) {
        // Check if the staff_assignments table exists by querying it
        const { error: tableCheckError } = await supabase
          .from('staff_assignments')
          .select('id')
          .limit(1);
        
        // If the table doesn't exist yet (migration not applied), just add to local state
        if (tableCheckError) {
          console.warn('Staff assignments table may not exist yet:', tableCheckError);
          toast.warning('Assignment added locally only. Database table may not exist yet.');
          
          // Generate a temporary ID for the UI
          const tempId = Date.now();
          
          setAssignments([...assignments, {
            id: tempId,
            staff_id: editingUser.id,
            province_code: selectedProvince,
            province_name: provinceName,
            lgu_code: selectedLgu || null,
            lgu_name: lguName
          }]);
        } else {
          // If editing an existing user and table exists, save to database
          const { data, error } = await supabase
            .from('staff_assignments')
            .insert({
              staff_id: editingUser.id,
              province_code: selectedProvince,
              lgu_code: selectedLgu || null
            })
            .select();
          
          if (error) {
            console.error('Error inserting assignment:', error);
            toast.error(`Failed to save assignment: ${error.message}`);
            
            // Still add to local state even if database insert fails
            const tempId = Date.now();
            setAssignments([...assignments, {
              id: tempId,
              staff_id: editingUser.id,
              province_code: selectedProvince,
              province_name: provinceName,
              lgu_code: selectedLgu || null,
              lgu_name: lguName
            }]);
          } else {
            // Add to local state with the database ID
            setAssignments([...assignments, {
              ...data[0],
              province_name: provinceName,
              lgu_name: lguName
            }]);
            
            toast.success('Assignment added successfully');
          }
        }
      } else {
        // If creating a new user, just add to local state
        // Generate a temporary ID for the UI
        const tempId = Date.now();
        
        setAssignments([...assignments, {
          id: tempId,
          staff_id: 'temp',
          province_code: selectedProvince,
          province_name: provinceName,
          lgu_code: selectedLgu || null,
          lgu_name: lguName
        }]);
        
        toast.success('Assignment added successfully');
      }
      
      // Reset selection
      setSelectedProvince('');
      setSelectedLgu('');
      setLgus([]);
    } catch (error) {
      console.error('Error in addAssignment:', error);
      toast.error('Failed to add assignment. Please try again.');
      
      // Ensure UI is reset even if there's an error
      setSelectedProvince('');
      setSelectedLgu('');
      setLgus([]);
    }
  };

  // Remove an assignment
  const removeAssignment = async (assignmentId: number) => {
    try {
      // Check if this is a temporary assignment (for new users)
      const isTemporaryAssignment = assignments.find(a => a.id === assignmentId && a.staff_id === 'temp');
      
      if (isTemporaryAssignment) {
        // For new users, just remove from local state
        setAssignments(assignments.filter(a => a.id !== assignmentId));
        toast.success('Assignment removed successfully');
      } else {
        // Check if the staff_assignments table exists by querying it
        const { error: tableCheckError } = await supabase
          .from('staff_assignments')
          .select('id')
          .limit(1);
        
        // If the table doesn't exist yet (migration not applied), just remove from local state
        if (tableCheckError) {
          console.warn('Staff assignments table may not exist yet:', tableCheckError);
          setAssignments(assignments.filter(a => a.id !== assignmentId));
          toast.warning('Assignment removed locally only. Database table may not exist yet.');
        } else {
          // For existing users, delete from database
          const { error } = await supabase
            .from('staff_assignments')
            .delete()
            .eq('id', assignmentId);
          
          if (error) {
            console.error('Error deleting assignment:', error);
            toast.error(`Failed to delete assignment: ${error.message}`);
            // Still remove from local state even if database delete fails
            setAssignments(assignments.filter(a => a.id !== assignmentId));
          } else {
            // Remove from local state
            setAssignments(assignments.filter(a => a.id !== assignmentId));
            toast.success('Assignment removed successfully');
          }
        }
      }
    } catch (error) {
      console.error('Error in removeAssignment:', error);
      toast.error('Failed to remove assignment. Please try again.');
      
      // Still remove from local state even if there's an error
      setAssignments(assignments.filter(a => a.id !== assignmentId));
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('last_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: UserFormData) => {
    try {
      if (editingUser) {
        // For updates, only include password_hash if a new password is provided
        const updateData: any = { ...data };
        delete updateData.password; // Remove password from the data object
        
        if (data.password) {
          // If a new password is provided, set it as password_hash
          updateData.password_hash = data.password;
        }

        const { error } = await supabase
          .from('staff')
          .update(updateData)
          .eq('id', editingUser.id);

        if (error) throw error;
        
        // If the user is a PDO and there are assignments, update them
        if (data.position === 'PDO' && assignments.length > 0) {
          // Check if the staff_assignments table exists by querying it
          const { error: tableCheckError } = await supabase
            .from('staff_assignments')
            .select('id')
            .limit(1);
          
          // If the table doesn't exist yet (migration not applied), show a warning
          if (tableCheckError) {
            console.warn('Staff assignments table may not exist yet:', tableCheckError);
            toast.warning('User updated successfully, but assignments could not be saved. The database table may not exist yet.');
          } else {
            try {
              // First, delete all existing assignments for this user
              await supabase
                .from('staff_assignments')
                .delete()
                .eq('staff_id', editingUser.id);
              
              // Then, insert the new assignments
              const assignmentsData = assignments.map(assignment => ({
                staff_id: editingUser.id,
                province_code: assignment.province_code,
                lgu_code: assignment.lgu_code
              }));
              
              // Insert assignments
              const { error: assignmentError } = await supabase
                .from('staff_assignments')
                .insert(assignmentsData);
              
              if (assignmentError) {
                console.error('Error saving assignments:', assignmentError);
                toast.warning(`User updated but failed to save assignments: ${assignmentError.message}`);
              } else {
                toast.success('User and assignments updated successfully');
              }
            } catch (assignmentError) {
              console.error('Error updating assignments:', assignmentError);
              toast.warning('User updated but failed to update assignments');
            }
          }
        } else {
          toast.success('User updated successfully');
        }
      } else {
        // For new users, password is required and stored as password_hash
        if (!data.password) {
          toast.error('Password is required for new users');
          return;
        }

        // Insert the new user
        const { data: newUser, error } = await supabase
          .from('staff')
          .insert({
            ...data,
            password_hash: data.password, // Store password as password_hash
            password: undefined, // Remove password field before inserting
          })
          .select();

        if (error) throw error;
        
        // If the new user is a PDO and there are assignments, save them
        if (data.position === 'PDO' && assignments.length > 0 && newUser && newUser.length > 0) {
          const userId = newUser[0].id;
          
          // Check if the staff_assignments table exists by querying it
          const { error: tableCheckError } = await supabase
            .from('staff_assignments')
            .select('id')
            .limit(1);
          
          // If the table doesn't exist yet (migration not applied), show a warning
          if (tableCheckError) {
            console.warn('Staff assignments table may not exist yet:', tableCheckError);
            toast.warning('User created successfully, but assignments could not be saved. The database table may not exist yet.');
          } else {
            // Prepare assignments data for insertion
            const assignmentsData = assignments.map(assignment => ({
              staff_id: userId,
              province_code: assignment.province_code,
              lgu_code: assignment.lgu_code
            }));
            
            // Insert assignments
            const { error: assignmentError } = await supabase
              .from('staff_assignments')
              .insert(assignmentsData);
            
            if (assignmentError) {
              console.error('Error saving assignments:', assignmentError);
              toast.warning(`User created but failed to save assignments: ${assignmentError.message}`);
            } else {
              toast.success('User and assignments created successfully');
            }
          }
        } else {
          toast.success('User created successfully');
        }
      }

      setShowModal(false);
      fetchUsers();
      reset();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error('Failed to save user');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('User deleted successfully');
      setShowDeleteConfirm(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const openEditModal = async (user: User) => {
    setEditingUser(user);
    reset({
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      middle_name: user.middle_name || undefined,
      extension_name: user.extension_name || undefined,
      birth_date: user.birth_date,
      sex: user.sex,
      position: user.position,
      status: user.status,
    });
    
    // Reset assignments state
    setAssignments([]);
    setSelectedProvince('');
    setSelectedLgu('');
    setLgus([]);
    
    // If user is a PDO, fetch their assignments
    if (user.position === 'PDO') {
      await fetchAssignments(user.id);
    }
    
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    reset({
      username: '',
      password: '',
      email: '',
      first_name: '',
      last_name: '',
      middle_name: '',
      extension_name: '',
      birth_date: '',
      sex: 'Male',
      position: 'PDO',
      status: 'Active',
    });
    
    // Reset assignments state
    setAssignments([]);
    setSelectedProvince('');
    setSelectedLgu('');
    setLgus([]);
    
    setShowModal(true);
  };

  // Filter users based on search term
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.first_name.toLowerCase().includes(searchLower) ||
      user.last_name.toLowerCase().includes(searchLower) ||
      user.username.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.position.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage system users and their roles</p>
        </div>
        
        <button 
          onClick={openCreateModal}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </button>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
        {/* Card Header with Search */}
        <div className="sm:flex sm:items-center sm:justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="text-sm font-medium text-gray-700">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'User' : 'Users'} Found
          </div>
          <div className="mt-3 sm:mt-0 sm:ml-4">
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>
        
        {/* Table Section */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">Username</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">Email</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Position</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">Last Login</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="flex justify-center">
                      <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">Loading users...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="flex justify-center">
                      <User className="h-12 w-12 text-gray-300" />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      {searchTerm ? 'No users match your search' : 'No users found'}
                    </p>
                    <button 
                      onClick={openCreateModal}
                      className="mt-2 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add User
                    </button>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                          {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.last_name}, {user.first_name}</div>
                          <div className="text-xs text-gray-500">{user.middle_name && `${user.middle_name} `}{user.extension_name && `(${user.extension_name})`}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 hidden md:table-cell">{user.username}</td>
                    <td className="px-4 py-4 text-sm text-gray-500 hidden lg:table-cell">{user.email}</td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-800">
                        {user.position}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-0.5 inline-flex items-center rounded-full text-xs font-medium ${
                        user.status === 'Active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        <span className={`h-2 w-2 rounded-full mr-1.5 ${
                          user.status === 'Active' ? 'bg-green-500' : 'bg-red-500'
                        }`}></span>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 hidden lg:table-cell">
                      {user.last_login 
                        ? format(new Date(user.last_login), 'MMM d, yyyy HH:mm') 
                        : <span className="text-gray-400 italic">Never</span>}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-blue-600 hover:text-blue-900 bg-blue-50 p-1.5 rounded-md transition-colors duration-200"
                          title="Edit user"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(user.id)}
                          className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-md transition-colors duration-200"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Section */}
        {!loading && filteredUsers.length > 0 && (
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{filteredUsers.length}</span> users
              </div>
              <div className="flex-1 flex justify-end">
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                    Previous
                  </button>
                  <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                    1
                  </button>
                  <button className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl transform transition-all">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">{editingUser ? 'Edit User' : 'Create New User'}</h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-gray-400 hover:text-gray-500 bg-gray-100 rounded-full p-2 transition-colors duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Personal Information Section */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Personal Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">First Name</label>
                    <input
                      type="text"
                      {...register('first_name', { required: 'First name is required' })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                    {errors.first_name && (
                      <p className="mt-1 text-xs text-red-600">{errors.first_name.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input
                      type="text"
                      {...register('last_name', { required: 'Last name is required' })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                    {errors.last_name && (
                      <p className="mt-1 text-xs text-red-600">{errors.last_name.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="middle_name" className="block text-sm font-medium text-gray-700">Middle Name</label>
                    <input
                      type="text"
                      {...register('middle_name')}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="extension_name" className="block text-sm font-medium text-gray-700">Extension Name</label>
                    <input
                      type="text"
                      {...register('extension_name')}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700">Birth Date</label>
                    <input
                      type="date"
                      {...register('birth_date', { required: 'Birth date is required' })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                    {errors.birth_date && (
                      <p className="mt-1 text-xs text-red-600">{errors.birth_date.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Sex</label>
                    <select
                      {...register('sex', { required: 'Sex is required' })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Account Information Section */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Account Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                    <input
                      type="text"
                      {...register('username', { required: 'Username is required' })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                    {errors.username && (
                      <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      {...register('email', { required: 'Email is required' })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      Password {!editingUser && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="password"
                      {...register('password', { required: !editingUser })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      placeholder={editingUser ? "Leave blank to keep current password" : ""}
                    />
                    {errors.password && (
                      <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Position</label>
                    <select
                      {...register('position', { required: 'Position is required' })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    >
                      <option value="Administrator">Administrator</option>
                      <option value="PDO">PDO</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <select
                      {...register('status', { required: 'Status is required' })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* PDO Assignments Section - Only visible for PDO users */}
              {watchPosition === 'PDO' && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                    Province & LGU Assignments
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Assign which provinces and LGUs this PDO user can view and manage.
                  </p>
                  
                  {/* Assignment Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Province</label>
                      <select
                        value={selectedProvince}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedProvince(value);
                          if (value) {
                            fetchLgus(value);
                          } else {
                            setLgus([]);
                            setSelectedLgu('');
                          }
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Select Province</option>
                        {provinces.map(province => (
                          <option key={province.code} value={province.code}>
                            {province.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">LGU (Optional)</label>
                      <select
                        value={selectedLgu}
                        onChange={(e) => setSelectedLgu(e.target.value)}
                        disabled={!selectedProvince || lgus.length === 0}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      >
                        <option value="">All LGUs in Province</option>
                        {lgus.map(lgu => (
                          <option key={lgu.code} value={lgu.code}>
                            {lgu.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Leave blank to assign all LGUs in the selected province
                      </p>
                    </div>
                    
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={addAssignment}
                        disabled={!selectedProvince}
                        className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add Assignment
                      </button>
                    </div>
                  </div>
                  
                  {/* Current Assignments */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Current Assignments</h4>
                    
                    {loadingAssignments ? (
                      <div className="text-center py-4">
                        <svg className="animate-spin h-5 w-5 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-sm text-gray-500 mt-2">Loading assignments...</p>
                      </div>
                    ) : assignments.length === 0 ? (
                      <div className="text-center py-4 bg-gray-100 rounded-md">
                        <p className="text-sm text-gray-500">No assignments yet. Add one above.</p>
                      </div>
                    ) : (
                      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                        <ul className="divide-y divide-gray-200">
                          {assignments.map((assignment) => (
                            <li key={assignment.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                              <div>
                                <p className="text-sm font-medium text-gray-800">
                                  {assignment.province_name}
                                </p>
                                {assignment.lgu_name && (
                                  <p className="text-xs text-gray-500">
                                    LGU: {assignment.lgu_name}
                                  </p>
                                )}
                                {!assignment.lgu_name && (
                                  <p className="text-xs text-gray-500">
                                    All LGUs in province
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => assignment.id && removeAssignment(assignment.id)}
                                className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-md transition-colors duration-200"
                                title="Remove assignment"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                >
                  {editingUser ? 'Update' : 'Create'} User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl transform transition-all">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 bg-red-100 rounded-full p-2 mr-3">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Confirm Delete</h3>
            </div>
            
            <p className="text-sm text-gray-500 mb-5">
              Are you sure you want to delete this user? This action cannot be undone.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowDeleteConfirm(null)} 
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                Cancel
              </button>
              <button 
                onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)} 
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
