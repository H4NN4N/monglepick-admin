/**
 * 관리자 권한 체크 가드.
 * 미인증 → /login 리다이렉트, ADMIN 아님 → 접근 거부.
 */

import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../stores/useAuthStore';

export default function AdminGuard({ children }) {
  const user = useAuthStore((s) => s.adminUser);
  const token = useAuthStore((s) => s.adminAccessToken);
  const isLoading = useAuthStore((s) => s.isLoading);
  const hasTriedRestore = useAuthStore((s) => s.hasTriedRestore);
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    if (!token && !hasTriedRestore && !isLoading) {
      restoreSession();
    }
  }, [token, hasTriedRestore, isLoading, restoreSession]);

  if (isLoading || (!token && !hasTriedRestore)) {
    return null;
  }

  /* 미인증 → 로그인 페이지 */
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  /* ADMIN 역할 아님 → 접근 거부 */
  const role = user.userRole || user.role;
  if (role !== 'ADMIN') {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>접근 권한이 없습니다</h2>
        <p>관리자 계정으로 로그인해주세요.</p>
      </div>
    );
  }

  return children;
}
