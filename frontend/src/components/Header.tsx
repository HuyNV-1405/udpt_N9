import React, { useState, useEffect } from 'react';
import { User, NotificationItem } from '../types';
import { UserCheck, LogOut, Bell, Server, Network, RefreshCw, Lock } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { SITES, getActiveSite, setActiveSite, isSiteLocked, SiteConfig } from '../api/client';

interface HeaderProps {
  user: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  alertCount: number;
  onAlertClick: () => void;
  notifications?: NotificationItem[];
  readNotificationIds?: string[];
  onMarkAllNotificationsRead?: (silent?: boolean) => void;
  onSelectNotification?: (item: NotificationItem) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenLogin,
  onLogout,
  alertCount,
  onAlertClick,
  notifications = [],
  readNotificationIds = [],
  onMarkAllNotificationsRead,
  onSelectNotification,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeSite, setActiveSiteState] = useState<SiteConfig>(getActiveSite());
  const [servingNode, setServingNode] = useState<string>('central_app_1');
  const [servingLb, setServingLb] = useState<string>('Nginx LB :8000');
  const [isRotating, setIsRotating] = useState<boolean>(false);

  const lockInfo = isSiteLocked(user);
  const unreadNotifCount = notifications.filter((n) => !readNotificationIds.includes(n.id)).length;

  useEffect(() => {
    const handleNodeInfo = (event: any) => {
      if (event.detail) {
        if (event.detail.nodeName) setServingNode(event.detail.nodeName);
        if (event.detail.lbName) setServingLb(event.detail.lbName);
        setIsRotating(true);
        setTimeout(() => setIsRotating(false), 500);
      }
    };

    const handleSiteChange = (e: any) => {
      const siteId = e.detail;
      const found = SITES.find((s) => s.id === siteId);
      if (found) {
        setActiveSiteState(found);
        setServingLb(`Nginx LB :${found.lbPort}`);
      }
    };

    window.addEventListener('wms:node-info', handleNodeInfo);
    window.addEventListener('wms:site-changed', handleSiteChange);
    return () => {
      window.removeEventListener('wms:node-info', handleNodeInfo);
      window.removeEventListener('wms:site-changed', handleSiteChange);
    };
  }, []);

  const handleSiteSelect = (siteId: string) => {
    setActiveSite(siteId);
    const newSite = SITES.find((s) => s.id === siteId) || SITES[0];
    setActiveSiteState(newSite);
    setServingLb(`Nginx LB :${newSite.lbPort}`);
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="bg-red-50 text-red-700 border border-red-200 text-xs px-2.5 py-0.5 rounded-full font-semibold">Admin Quản trị</span>;
      case 'QUAN_LY_KHO':
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs px-2.5 py-0.5 rounded-full font-semibold">Quản lý kho</span>;
      case 'NHAN_VIEN_KHO':
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2.5 py-0.5 rounded-full font-semibold">Nhân viên kho</span>;
      default:
        return null;
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 sticky top-0 z-20">
      {/* Cụm chọn Site phân tán & Hiển thị Node phục vụ */}
      <div className="flex items-center gap-3">
        {/* Phân định theo Cổng / Tài khoản */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-sm">
          <Network className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-semibold text-slate-600 hidden sm:inline">Chi nhánh:</span>

          {lockInfo.locked ? (
            /* Khi bị khóa theo cổng hoặc theo tài khoản nhân viên kho */
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                {activeSite.icon} {activeSite.shortName}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-mono font-semibold" title={`Khóa cứng theo ${lockInfo.reason}`}>
                <Lock className="w-3 h-3 text-amber-600" />
                {lockInfo.reason}
              </span>
            </div>
          ) : (
            /* Khi là Admin hoặc chưa khóa: Cho phép tự do chuyển Site */
            <select
              value={activeSite.id}
              onChange={(e) => handleSiteSelect(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer pr-1"
            >
              {SITES.slice(0, 3).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.icon} {site.name} (LB: {site.lbPort})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Badge hiển thị Node đang phục vụ (Minh chứng cân bằng tải Load Balancer) */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm" title="Minh chứng cân bằng tải Load Balancer: Mỗi request được phân phối luân phiên giữa 2 Node App">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Server className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            Node: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-900">{servingNode}</strong>
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-600 font-mono text-[11px]">{servingLb}</span>
          <RefreshCw className={`w-3 h-3 text-emerald-600 ${isRotating ? 'animate-spin' : ''}`} />
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Notification button with dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              const willOpen = !showNotifications;
              setShowNotifications(willOpen);
              if (willOpen && unreadNotifCount > 0 && onMarkAllNotificationsRead) {
                onMarkAllNotificationsRead(true);
              }
            }}
            className="relative p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            title="Xem thông báo duyệt phiếu & yêu cầu"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            )}
          </button>

          <NotificationDropdown
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
            notifications={notifications}
            readIds={readNotificationIds}
            onMarkAllAsRead={onMarkAllNotificationsRead || (() => {})}
            onSelectNotification={(item) => {
              if (onSelectNotification) onSelectNotification(item);
            }}
            alertCount={alertCount}
            onViewAlerts={onAlertClick}
          />
        </div>

        {/* User Account / Role switcher */}
        {user ? (
          <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-800 flex items-center justify-end gap-2">
                <span>{user.hoTen}</span>
                {getRoleBadge(user.role)}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                @{user.username} • {user.maNV}
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenLogin}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>Đăng nhập hệ thống</span>
          </button>
        )}
      </div>
    </header>
  );
};
