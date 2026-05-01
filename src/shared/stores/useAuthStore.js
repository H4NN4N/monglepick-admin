/**
 * 관리자 인증 상태 Zustand 스토어.
 * monglepick-client의 useAuthStore와 동일 패턴.
 * ADMIN role 검증이 추가됨.
 */

import { create } from 'zustand';
import { getToken, setToken, getUser, setUser, clearAll } from '../utils/storage';
import { backendApi } from '../api/axiosInstance';
import { AUTH_ENDPOINTS } from '../constants/api';

/** JWT 만료 검사 */
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

const useAuthStore = create((set, get) => {
  /* 초기 상태: localStorage에서 복원 */
  const savedToken = getToken();
  const savedUser = getUser();
  const isValid = savedToken && savedUser && !isTokenExpired(savedToken);

  if (savedToken && !isValid) {
    clearAll();
  }

  return {
    adminUser: isValid ? savedUser : null,
    adminAccessToken: isValid ? savedToken : null,
    isLoading: false,
    hasTriedRestore: false,

    /** 인증 여부 */
    isAuthenticated: () => {
      const { adminAccessToken, adminUser } = get();
      return Boolean(adminAccessToken && adminUser);
    },

    isAdminAuthenticated: () => {
      const { adminAccessToken, adminUser } = get();
      return Boolean(adminAccessToken && adminUser);
    },

    /** ADMIN 역할 여부 */
    isAdmin: () => {
      const { adminUser } = get();
      return adminUser?.userRole === 'ADMIN' || adminUser?.role === 'ADMIN';
    },

    /** 로그인 처리 */
    login: ({ accessToken, user: userData }) => {
      set({
        adminAccessToken: accessToken,
        adminUser: userData,
        hasTriedRestore: true,
      });
      setToken(accessToken);
      setUser(userData);
    },

    /** 관리자 refresh 쿠키 기반 세션 복구 */
    restoreSession: async () => {
      set({ isLoading: true });
      try {
        const data = await backendApi.post(AUTH_ENDPOINTS.REFRESH);
        const accessToken = data?.accessToken;
        const userData = data?.user;
        if (!accessToken || !userData) {
          throw new Error('관리자 인증 정보를 복구할 수 없습니다.');
        }
        set({
          adminAccessToken: accessToken,
          adminUser: userData,
          isLoading: false,
          hasTriedRestore: true,
        });
        setToken(accessToken);
        setUser(userData);
        return true;
      } catch {
        clearAll();
        set({
          adminAccessToken: null,
          adminUser: null,
          isLoading: false,
          hasTriedRestore: true,
        });
        return false;
      }
    },

    /** 로그아웃 처리 */
    logout: async () => {
      try {
        await backendApi.post(AUTH_ENDPOINTS.LOGOUT);
      } catch {
        // best-effort — 네트워크 오류 시에도 클라이언트 로그아웃 진행
      }
      set({
        adminAccessToken: null,
        adminUser: null,
        hasTriedRestore: true,
      });
      clearAll();
    },

    /** 사용자 정보 업데이트 */
    updateUser: (updatedUser) => {
      set({ adminUser: updatedUser });
      setUser(updatedUser);
    },
  };
});

export default useAuthStore;
