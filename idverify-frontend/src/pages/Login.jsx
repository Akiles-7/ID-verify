import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, User, Loader2 } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../store';
import api from '../services/api';

export default function Login() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { username: username.trim(), password });
      dispatch(loginSuccess(res.data));
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data;
      if (msg) {
        setError(typeof msg === 'string' ? msg : 'Invalid username or password. Officer accounts must be registered by an Administrator.');
      } else if (username === 'admin' && password === 'admin123') {
        // Fallback demo login for default admin if backend offline
        const mockAdmin = {
          fullName: 'System Administrator',
          username: 'admin',
          role: 'ROLE_ADMIN',
          designation: 'Lead Admin',
          station: 'System Control',
        };
        dispatch(loginSuccess({ token: 'mock_jwt_token', refreshToken: 'mock_ref', user: mockAdmin }));
        navigate('/');
      } else {
        setError('Invalid credentials. If you are an officer, please ask your Administrator to register your account.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1A33] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#2E6BE6] flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/30">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">IDVerify</h1>
          <p className="text-xs font-mono text-gray-400 mt-0.5">FORENSIC v2.4 CONSOLE</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-xs font-semibold border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Username</label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username (e.g. admin)"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#2E6BE6] text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log in'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100 text-center text-xs text-gray-500 space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => { setUsername('admin'); setPassword('admin123'); setError(''); }}
              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-semibold transition-colors"
            >
              Default Admin: <code className="font-mono">admin / admin123</code>
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            Officers: Log in with credentials registered by Administrator
          </p>
        </div>
      </div>
    </div>
  );
}
