import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, FileScan, FolderCheck, Settings as SettingsIcon, LogOut, Users as UsersIcon } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/authSlice';

export default function Sidebar({ caseCount = 0 }) {
  const user = useSelector((state) => state.auth.user) || {
    fullName: 'System Administrator',
    designation: 'Lead Admin',
    station: 'System Control',
  };

  const isAdmin = user?.role === 'ROLE_ADMIN' || user?.role === 'ADMIN' || user?.username === 'admin';

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    dispatch(logout());
    navigate('/login');
  };

  const mainNav = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'New Scan', path: '/scan/new', icon: FileScan },
    { name: 'Case Queue', path: '/cases', icon: FolderCheck, badge: caseCount > 0 ? caseCount : null },
    ...(isAdmin ? [{ name: 'Officers / Users', path: '/users', icon: UsersIcon }] : []),
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <aside className="w-64 bg-[#0F1A33] text-white flex flex-col min-h-screen border-r border-[#1B2A4A] select-none">
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#2E6BE6] flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-none text-white tracking-wide">IDVerify</h1>
          <span className="text-[11px] font-mono text-gray-400 tracking-wider">FORENSIC v2.4</span>
        </div>
      </div>

      {/* Main Nav */}
      <div className="px-4 py-2">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Main</div>
        <nav className="space-y-1">
          {mainNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-[#2E6BE6] text-white shadow-md shadow-blue-600/30'
                      : 'text-gray-300 hover:bg-[#1B2A4A] hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </div>
                {item.badge ? (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer User Card */}
      <div className="mt-auto p-4 border-t border-[#1B2A4A]">
        <div className="flex items-center justify-between bg-[#1B2A4A]/50 p-2.5 rounded-xl">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#2E6BE6] font-bold text-white text-xs flex items-center justify-center shrink-0">
              {user.fullName ? user.fullName.split(' ').map(n => n[0]).join('') : 'SA'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user.fullName || 'System Administrator'}</div>
              <div className="text-[11px] text-gray-400 truncate">{user.designation || 'Lead Admin'} · {user.station || 'System Control'}</div>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
