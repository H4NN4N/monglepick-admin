/**
 * 몽글픽 관리자 앱 라우팅 (11탭 + 로그인).
 *
 * 모든 관리자 페이지는 AdminGuard(인증+ADMIN 역할 검증)로 보호된다.
 * 11개 탭: 대시보드, 사용자, 콘텐츠, 결제/포인트, 데이터, AI운영,
 *          운영도구(신규), 고객센터, 통계, 시스템, 설정
 *
 * 운영 도구(/admin/operations) 페이지는 마스터 데이터 + 운영 도구
 * 통합 페이지로, 13개 추가 관리자 기능의 서브탭을 모은다.
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from '@/shared/components/AdminLayout';
import AdminGuard from '@/shared/components/AdminGuard';
import LoginPage from '@/features/auth/pages/LoginPage';

/* ── 11개 탭 페이지 import ── */
import DashboardPage from '@/features/dashboard/pages/DashboardPage';
import UsersPage from '@/features/users/pages/UsersPage';
import ContentPage from '@/features/content/pages/ContentPage';
import PaymentPage from '@/features/payment/pages/PaymentPage';
import DataPage from '@/features/data/pages/DataPage';
import AiOpsPage from '@/features/ai/pages/AiOpsPage';
import OperationsPage from '@/features/operations/pages/OperationsPage';
import SupportPage from '@/features/support/pages/SupportPage';
import StatsPage from '@/features/stats/pages/StatsPage';
import SystemPage from '@/features/system/pages/SystemPage';
import SettingsPage from '@/features/settings/pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      {/* 로그인 (공개) */}
      <Route path="/login" element={<LoginPage />} />

      {/* 관리자 (인증+ADMIN 필수) */}
      <Route
        path="/admin"
        element={
          <AdminGuard>
            <AdminLayout />
          </AdminGuard>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="content" element={<ContentPage />} />
        <Route path="payment" element={<PaymentPage />} />
        <Route path="data" element={<DataPage />} />
        <Route path="ai" element={<AiOpsPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="system" element={<SystemPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* 루트 → 관리자 대시보드 */}
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
