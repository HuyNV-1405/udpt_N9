import React, { useState, useEffect } from 'react';
import { UserCheck, Shield, KeyRound, Sparkles, X, UserPlus, LogIn, Lock, User as UserIcon, Mail, Phone, ChevronRight } from 'lucide-react';
import { Role } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (username: string, pass: string) => Promise<void>;
  onRegister?: (data: {
    username: string;
    password: string;
    hoTen: string;
    role: Role;
    maNV?: string;
    email?: string;
    sdt?: string;
  }) => Promise<void>;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  onRegister,
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login form state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123');

  // Register form state
  const [regData, setRegData] = useState({
    hoTen: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: 'NHAN_VIEN_KHO' as Role,
    maNV: '',
    email: '',
    sdt: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const demoAccounts = [
    { label: '🏢 Admin Trụ Sở Chính (Xem toàn quốc)', user: 'admin', pass: 'Admin@123', role: 'Toàn quyền cấu hình, xem mọi Site' },
    { label: '🏛️ Thủ Kho Miền Bắc (Khóa Node HN)', user: 'kho_hn', pass: 'Khohn@123', role: 'Quản lý kho Hà Nội (LB :8001)' },
    { label: '🏬 Thủ Kho Miền Nam (Khóa Node HCM)', user: 'kho_hcm', pass: 'Khohcm@123', role: 'Quản lý kho TP.HCM (LB :8002)' },
    { label: 'Nhân Viên Kho', user: 'nhanvienkho', pass: 'Nhanvien@123', role: 'Thực hiện kiểm đếm, cất hàng' },
  ];

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await onLogin(username, password);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Đăng nhập không thành công');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!regData.hoTen.trim()) {
      setError('Vui lòng nhập họ và tên');
      return;
    }
    if (!regData.username.trim()) {
      setError('Vui lòng nhập tên đăng nhập');
      return;
    }
    if (regData.username.includes(' ')) {
      setError('Tên đăng nhập không được chứa khoảng trắng');
      return;
    }
    if (regData.password.length < 6) {
      setError('Mật khẩu phải có độ dài từ 6 ký tự trở lên');
      return;
    }
    if (regData.password !== regData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    if (!onRegister) {
      setError('Chức năng đăng ký chưa được kích hoạt');
      return;
    }

    setIsLoading(true);
    try {
      await onRegister({
        hoTen: regData.hoTen.trim(),
        username: regData.username.trim(),
        password: regData.password,
        role: regData.role,
        maNV: regData.maNV.trim() || undefined,
        email: regData.email.trim() || undefined,
        sdt: regData.sdt.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Đăng ký tài khoản thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-red-600 to-rose-700 text-white text-center relative shrink-0 shadow-sm">
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-2.5 shadow-md">
            {mode === 'LOGIN' ? <Shield className="w-5 h-5 text-white" /> : <UserPlus className="w-5 h-5 text-white" />}
          </div>
          <h3 className="text-base font-bold">
            {mode === 'LOGIN' ? 'Đăng Nhập Hệ Thống Quản Lý Kho' : 'Đăng Ký Tài Khoản Mới'}
          </h3>
          <p className="text-[11px] text-red-100 mt-0.5">
            {mode === 'LOGIN'
              ? 'Xác thực tài khoản và kiểm thử phân quyền nghiệp vụ'
              : 'Tạo tài khoản người dùng và tham gia vận hành kho'}
          </p>
          <button
            type="button"
            onClick={onClose}
            title="Đóng cửa sổ (Phím Esc)"
            className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg bg-white/20 hover:bg-black/20 text-white font-bold transition-all cursor-pointer shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMode('LOGIN');
              setError('');
            }}
            className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              mode === 'LOGIN'
                ? 'border-red-600 text-red-600 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Đăng Nhập</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('REGISTER');
              setError('');
            }}
            className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              mode === 'REGISTER'
                ? 'border-red-600 text-red-600 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Đăng Ký Tài Khoản</span>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mt-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        {/* Form Body */}
        {mode === 'LOGIN' ? (
          /* ================= GIAO DIỆN ĐĂNG NHẬP ================= */
          <form onSubmit={handleLoginSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tên Đăng Nhập</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="VD: admin, nhanvienkho..."
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mật Khẩu</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isLoading ? 'Đang xác thực...' : 'Đăng Nhập'}</span>
            </button>

            {/* Switch to Register link */}
            <div className="text-center pt-1 text-slate-600">
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('REGISTER');
                  setError('');
                }}
                className="font-bold text-red-600 hover:underline cursor-pointer"
              >
                Đăng ký tài khoản mới &rarr;
              </button>
            </div>

            {/* Quick Demo Accounts Selection */}
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Tài khoản mẫu từ Seeding (Nhấp để chọn nhanh):</span>
              </div>
              <div className="space-y-1.5">
                {demoAccounts.map((acc) => (
                  <button
                    type="button"
                    key={acc.user}
                    onClick={() => handleSelectDemo(acc.user, acc.pass)}
                    className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between text-[11px] cursor-pointer ${
                      username === acc.user
                        ? 'bg-red-50 border-red-300 text-red-900 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <span className="font-bold">{acc.label}</span>
                      <span className="text-slate-400 ml-1.5">(@{acc.user})</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{acc.role}</span>
                  </button>
                ))}
              </div>
            </div>
          </form>
        ) : (
          /* ================= GIAO DIỆN ĐĂNG KÝ TÀI KHOẢN ================= */
          <form onSubmit={handleRegisterSubmit} className="p-6 space-y-3 text-xs overflow-y-auto flex-1">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Họ Và Tên *</label>
              <input
                type="text"
                required
                placeholder="VD: Nguyễn Văn An"
                value={regData.hoTen}
                onChange={(e) => setRegData({ ...regData, hoTen: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên Đăng Nhập *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: nguyenvanan"
                  value={regData.username}
                  onChange={(e) => setRegData({ ...regData, username: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mã NV (Tùy chọn)</label>
                <input
                  type="text"
                  placeholder="Tự động nếu để trống"
                  value={regData.maNV}
                  onChange={(e) => setRegData({ ...regData, maNV: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mật Khẩu *</label>
                <input
                  type="password"
                  required
                  placeholder="Tối thiểu 6 ký tự..."
                  value={regData.password}
                  onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Xác Nhận Mật Khẩu *</label>
                <input
                  type="password"
                  required
                  placeholder="Nhập lại mật khẩu..."
                  value={regData.confirmPassword}
                  onChange={(e) => setRegData({ ...regData, confirmPassword: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vai Trò Đăng Ký Trong Hệ Thống *</label>
              <select
                value={regData.role}
                onChange={(e) => setRegData({ ...regData, role: e.target.value as Role })}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-medium text-slate-800"
              >
                <option value="NHAN_VIEN_KHO">Nhân Viên Kho (Xếp kệ, lấy hàng, tác nghiệp)</option>
                <option value="QUAN_LY_KHO">Quản Lý Kho (Phê duyệt phiếu nhập/xuất/chuyển)</option>
                <option value="NHAN_VIEN_MUA_HANG">Nhân Viên Mua Hàng (Tạo phiếu nhập từ NCC)</option>
                <option value="NHAN_VIEN_BAN_HANG">Nhân Viên Kinh Doanh (Tạo yêu cầu xuất kho)</option>
                <option value="ADMIN">Admin Quản Trị Hệ Thống (Toàn quyền)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="VD: an@wms.com"
                  value={regData.email}
                  onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số Điện Thoại</label>
                <input
                  type="tel"
                  placeholder="VD: 0912345678"
                  value={regData.sdt}
                  onChange={(e) => setRegData({ ...regData, sdt: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isLoading ? 'Đang tạo tài khoản...' : 'Hoàn Tất Đăng Ký'}</span>
              </button>
            </div>

            {/* Switch to Login link */}
            <div className="text-center pt-2 text-slate-600">
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('LOGIN');
                  setError('');
                }}
                className="font-bold text-red-600 hover:underline cursor-pointer"
              >
                Đăng nhập ngay &rarr;
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
