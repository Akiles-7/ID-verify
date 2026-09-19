import React, { useEffect, useState } from 'react';
import MainLayout, { TopBar } from '../layout/MainLayout';
import { UserPlus, Shield, AlertCircle, Loader2, Users as UsersIcon, X, Check, Lock, User as UserIcon, Building, BadgeCheck, Trash2 } from 'lucide-react';
import api from '../services/api';

const roleBadge = {
  ROLE_ADMIN: 'bg-purple-50 text-purple-600 border border-purple-200',
  ROLE_OFFICER: 'bg-blue-50 text-[#2E6BE6] border border-blue-200',
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [deletingUserId, setDeletingUserId] = useState(null);

  // Form state for creating an officer
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    designation: 'Senior Officer',
    station: 'Port Authority Terminal 3',
  });

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/users');
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Access denied. Admin privileges required to view user management.');
      } else {
        setError('Unable to load users. Please ensure the backend is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateOfficer = async (e) => {
    e.preventDefault();
    setModalError('');
    if (!formData.username.trim() || !formData.password.trim()) {
      setModalError('Username and password are required.');
      return;
    }

    try {
      setModalLoading(true);
      const res = await api.post('/users', {
        ...formData,
        role: 'ROLE_OFFICER',
      });
      setUsers((prev) => [...prev, res.data]);
      setShowAddModal(false);
      setSuccessMessage(`Officer account '${formData.username}' created successfully!`);
      setTimeout(() => setSuccessMessage(''), 4000);
      setFormData({
        fullName: '',
        username: '',
        password: '',
        designation: 'Senior Officer',
        station: 'Port Authority Terminal 3',
      });
    } catch (err) {
      setModalError(err.response?.data?.message || err.response?.data || 'Failed to create officer account.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteOfficer = async (u) => {
    if (u.role === 'ROLE_ADMIN' || u.username === 'admin') {
      alert('System Administrator account cannot be deleted.');
      return;
    }

    const officerName = u.fullName || u.username;
    if (!window.confirm(`Are you sure you want to permanently delete officer "${officerName}" (@${u.username}) from the database? This officer will no longer be able to log in.`)) {
      return;
    }

    try {
      setDeletingUserId(u.id);
      await api.delete(`/users/${u.id}`);
      setUsers((prev) => prev.filter((item) => item.id !== u.id));
      setSuccessMessage(`Officer account '${officerName}' deleted successfully.`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(`Failed to delete officer: ${err.response?.data?.message || err.message}`);
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <MainLayout>
      <TopBar
        title="Officer & User Management"
        subtitle="Admin console: Register officers, assign stations, and manage credentials"
        actionButton={
          <button
            id="btn-add-user"
            onClick={() => { setShowAddModal(true); setModalError(''); }}
            className="px-4 py-2.5 rounded-xl bg-white text-[#2563EB] text-xs font-bold hover:bg-blue-50 active:scale-95 transition-all flex items-center gap-2 shadow-md"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register Officer</span>
          </button>
        }
      />

      {successMessage && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold shadow-xs">
          <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Add Officer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2E6BE6] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Register New Officer</h3>
                  <p className="text-[11px] text-gray-400">Create login credentials for inspection officer</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateOfficer} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1 text-[10px]">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. John Miller"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1 text-[10px]">
                    Username (Login)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. officer_john"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1 text-[10px]">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1 text-[10px]">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Senior Officer"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1 text-[10px]">
                    Station / Terminal
                  </label>
                  <input
                    type="text"
                    value={formData.station}
                    onChange={(e) => setFormData({ ...formData, station: e.target.value })}
                    placeholder="e.g. Terminal 2"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-xl text-[11px] text-blue-800 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Officer account will be assigned <strong>ROLE_OFFICER</strong> permissions.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 rounded-xl bg-[#2E6BE6] text-white font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {modalLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Register Officer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100">
            <div className="grid grid-cols-5 p-4 bg-gray-50 border-b border-gray-100">
              {['Name', 'Username', 'Role', 'Designation', 'Station'].map(h => (
                <div key={h} className="h-3 bg-gray-200 rounded w-2/3 animate-pulse" />
              ))}
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="grid grid-cols-5 p-4 gap-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100" />
                  <div className="h-3 bg-gray-100 rounded w-24" />
                </div>
                {[...Array(4)].map((_, j) => <div key={j} className="h-3 bg-gray-100 rounded w-20 my-auto" />)}
              </div>
            ))}
          </div>
        ) : users.length > 0 ? (
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Username', 'Role', 'Designation', 'Station'].map(h => (
                  <th key={h} className="p-4 text-gray-400 font-bold uppercase tracking-wider">{h}</th>
                ))}
                <th className="p-4 text-gray-400 font-bold uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => {
                const initials = u.fullName
                  ? u.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                  : u.username?.[0]?.toUpperCase() || '?';
                const isUserAdmin = u.role === 'ROLE_ADMIN' || u.username === 'admin';

                return (
                  <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#2E6BE6] text-white flex items-center justify-center font-bold text-xs shadow-sm shadow-blue-500/20">
                          {initials}
                        </div>
                        <span className="font-bold text-gray-900">{u.fullName || u.username}</span>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-gray-500">{u.username}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${roleBadge[u.role] || 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                        {u.role?.replace('ROLE_', '') || u.role}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-gray-600">{u.designation || '—'}</td>
                    <td className="p-4 text-gray-500">{u.station || '—'}</td>
                    <td className="p-4 text-right">
                      {isUserAdmin ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg">
                          <Shield className="w-3 h-3 text-purple-600" />
                          <span>Protected Admin</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={deletingUserId === u.id}
                          onClick={() => handleDeleteOfficer(u)}
                          title={`Delete officer ${u.fullName || u.username} from database`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 border border-red-200 font-bold text-xs transition-all active:scale-95 disabled:opacity-40 shadow-2xs"
                        >
                          {deletingUserId === u.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          )}
                          <span>Delete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : !error ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <UsersIcon className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-base font-bold text-gray-600">No users found</p>
            <p className="text-sm mt-1">Add user accounts to see them here.</p>
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
}
