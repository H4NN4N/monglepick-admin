/**
 * 관리자 페이지 라우트 상수 (11탭).
 *
 * 11번째 탭 OPERATIONS는 마스터 데이터 + 운영 도구 통합 페이지로,
 * 업적/장르/카테고리/리워드정책/포인트팩/도장깨기 템플릿/퀴즈/월드컵 후보/
 * 인기검색어/OCR 이벤트 등 13개 관리자 추가 기능의 서브탭을 모은다.
 */
export const ADMIN_ROUTES = {
  ROOT: '/admin',
  DASHBOARD: '/admin/dashboard',
  USERS: '/admin/users',
  CONTENT: '/admin/content',
  PAYMENT: '/admin/payment',
  DATA: '/admin/data',
  AI: '/admin/ai',
  SUPPORT: '/admin/support',
  STATS: '/admin/stats',
  SYSTEM: '/admin/system',
  SETTINGS: '/admin/settings',
  OPERATIONS: '/admin/operations',
  LOGIN: '/login',
};
