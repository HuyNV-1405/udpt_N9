import axios from 'axios';

export interface SiteConfig {
  id: string;
  name: string;
  shortName: string;
  url: string;
  lbPort: number;
  icon: string;
  badgeColor: string;
}

export const SITES: SiteConfig[] = [
  {
    id: 'SITE_CENTRAL',
    name: 'Site 1: Trụ sở chính - Báo cáo tổng hợp',
    shortName: 'Trụ sở chính (Tổng hợp)',
    url: 'http://localhost:8000/api',
    lbPort: 8000,
    icon: '🏢',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    id: 'SITE_HN',
    name: 'Site 2: Kho miền Bắc - Node HN',
    shortName: 'Kho miền Bắc (HN)',
    url: 'http://localhost:8001/api',
    lbPort: 8001,
    icon: '🏛️',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'SITE_HCM',
    name: 'Site 3: Kho miền Nam - Node HCM',
    shortName: 'Kho miền Nam (HCM)',
    url: 'http://localhost:8002/api',
    lbPort: 8002,
    icon: '🏬',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'LOCAL_DEV',
    name: 'Node cục bộ mặc định (Port 5000 / Proxy)',
    shortName: 'Cục bộ (:5000)',
    url: '/api',
    lbPort: 5000,
    icon: '💻',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
  },
];

/**
 * Xác định Site làm việc thông minh theo 3 cấp độ:
 * 1. Cổng truy cập Frontend (Port 3000 -> Central, 3001 -> HN, 3002 -> HCM)
 * 2. Tham số URL (?site=hn, ?site=hcm, ?site=central)
 * 3. Tài khoản đăng nhập / LocalStorage
 */
export const getActiveSite = (): SiteConfig => {
  // 1. Phân định theo Cổng truy cập (Port-based)
  const port = window.location.port;
  if (port === '3000') return SITES[0];
  if (port === '3001') return SITES[1];
  if (port === '3002') return SITES[2];

  // 2. Phân định theo Query Parameter (?site=hn, ?site=hcm, ?site=central)
  const urlParams = new URLSearchParams(window.location.search);
  const siteParam = urlParams.get('site')?.toUpperCase();
  if (siteParam === 'HN' || siteParam === 'SITE_HN') return SITES[1];
  if (siteParam === 'HCM' || siteParam === 'SITE_HCM') return SITES[2];
  if (siteParam === 'CENTRAL' || siteParam === 'SITE_CENTRAL') return SITES[0];

  // 3. Phân định theo LocalStorage
  const savedId = localStorage.getItem('wms_active_site_id');
  const found = SITES.find((s) => s.id === savedId);
  return found || SITES[0];
};

/**
 * Kiểm tra xem Site hiện tại có bị khóa cứng hay không (theo Cổng, URL hoặc Phân quyền Nhân viên)
 */
export const isSiteLocked = (currentUser?: any): { locked: boolean; reason?: string } => {
  const port = window.location.port;
  if (port === '3000') return { locked: true, reason: 'Cổng 3000 (Trụ sở chính)' };
  if (port === '3001') return { locked: true, reason: 'Cổng 3001 (Kho miền Bắc)' };
  if (port === '3002') return { locked: true, reason: 'Cổng 3002 (Kho miền Nam)' };

  const urlParams = new URLSearchParams(window.location.search);
  const p = urlParams.get('site');
  if (p) return { locked: true, reason: `URL ?site=${p.toLowerCase()}` };

  if (currentUser && currentUser.role !== 'ADMIN') {
    const un = (currentUser.username || '').toLowerCase();
    if (un.includes('hn')) return { locked: true, reason: 'Tài khoản Thủ kho HN' };
    if (un.includes('hcm')) return { locked: true, reason: 'Tài khoản Thủ kho HCM' };
  }

  return { locked: false };
};

export const setActiveSite = (siteId: string) => {
  localStorage.setItem('wms_active_site_id', siteId);
  window.dispatchEvent(new CustomEvent('wms:site-changed', { detail: siteId }));
};

const api = axios.create({
  baseURL: getActiveSite().url,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor tự động gắn JWT Token và trỏ đúng Site Base URL
api.interceptors.request.use((config) => {
  const activeSite = getActiveSite();
  if (config.url && !config.url.startsWith('http')) {
    config.baseURL = activeSite.url;
  }

  const token = localStorage.getItem('wms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor bắt thông tin Node phản hồi
api.interceptors.response.use(
  (response) => {
    const nodeName = response.headers['x-node-name'] || response.headers['X-Node-Name'];
    const siteId = response.headers['x-site-id'] || response.headers['X-Site-Id'];
    const lbName = response.headers['x-load-balancer'] || response.headers['X-Load-Balancer'];

    if (nodeName || lbName) {
      window.dispatchEvent(
        new CustomEvent('wms:node-info', {
          detail: {
            nodeName: nodeName || 'app-node',
            siteId: siteId || getActiveSite().id,
            lbName: lbName || `LB-Port-${getActiveSite().lbPort}`,
            timestamp: Date.now(),
          },
        })
      );
    }
    return response;
  },
  (error) => {
    if (error.response?.headers) {
      const nodeName = error.response.headers['x-node-name'];
      if (nodeName) {
        window.dispatchEvent(
          new CustomEvent('wms:node-info', {
            detail: {
              nodeName,
              status: 'ERROR',
              timestamp: Date.now(),
            },
          })
        );
      }
    }
    return Promise.reject(error);
  }
);

export default api;
