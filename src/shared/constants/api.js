/**
 * 관리자 API 상수 정의.
 *
 * 서비스 분류:
 * - @service Backend  → backendApi  (Spring Boot :8080) — /api/v1/admin/*
 * - @service Agent    → agentApi    (FastAPI :8000)     — /api/v1/admin/*
 */

/** API 버전 접두사 */
export const API_VERSION = '/api/v1';

/** 관리자 API 접두사 */
const ADMIN = `${API_VERSION}/admin`;

/* ── 인증 (Backend) ── */
export const AUTH_ENDPOINTS = {
  /** 관리자 전용 로그인 — 백엔드에서 ADMIN role 검증 후 JWT 발급 (일반 유저 403 차단) */
  LOGIN: `${API_VERSION}/admin/auth/login`,
  REFRESH: `/jwt/refresh`,
  LOGOUT: `${API_VERSION}/auth/logout`,
};

/* ── 시스템 (윤형주) ── */
export const SYSTEM_ENDPOINTS = {
  /** 4개 서비스 헬스체크 집계 - GET (Backend) */
  SERVICES: `${ADMIN}/system/services`,
  /** 5개 DB 상태 - GET (Agent) */
  DB: `${ADMIN}/system/db`,
  /** Ollama 모델 상태 - GET (Agent) */
  OLLAMA: `${ADMIN}/system/ollama`,
  /** 현재 설정값 조회 - GET (Backend) */
  CONFIG: `${ADMIN}/system/config`,
};

/* ── 결제/포인트 관리 (윤형주) ──
 *
 * 백엔드 AdminPaymentController(@RequestMapping("/api/v1/admin")) 기준 경로/메서드.
 *
 * 주의사항:
 * - 보상 실패 건 목록은 별도 엔드포인트가 없다.
 *   ORDERS 경로에 `status=COMPENSATION_FAILED` 필터로 조회한다 (paymentApi.fetchFailedOrders 참조).
 * - 보상 복구(COMPENSATE) 경로는 설계서에 맞춰 `/subscription/{orderId}/compensate`(POST)이며,
 *   {orderId}는 주문 UUID로 해석된다. AdminCompensateRequest는 adminNote 필수.
 * - 구독 취소/연장은 PUT 메서드를 사용한다 (AdminPaymentController cancel/extend).
 * - 포인트 이력은 전역 목록 엔드포인트에 userId 쿼리 파라미터로 필터링한다.
 */
export const PAYMENT_ADMIN_ENDPOINTS = {
  ORDERS: `${ADMIN}/payment/orders`,
  ORDER_DETAIL: (orderId) => `${ADMIN}/payment/orders/${orderId}`,
  REFUND: (orderId) => `${ADMIN}/payment/orders/${orderId}/refund`,
  /** 보상 복구 — POST, body={adminNote} */
  COMPENSATE: (orderId) => `${ADMIN}/subscription/${orderId}/compensate`,
  SUBSCRIPTIONS: `${ADMIN}/subscription`,
  /** 구독 취소 — PUT (body 없음) */
  CANCEL_SUB: (id) => `${ADMIN}/subscription/${id}/cancel`,
  /** 구독 연장 — PUT (body 선택) */
  EXTEND_SUB: (id) => `${ADMIN}/subscription/${id}/extend`,
  /** 포인트 수동 지급/차감 — POST, body={userId, amount(±), reason} */
  POINT_MANUAL: `${ADMIN}/point/manual`,
  /** 포인트 변동 이력 — GET, query: userId/page/size */
  POINT_HISTORIES: `${ADMIN}/point/histories`,
  POINT_ITEMS: `${ADMIN}/point/items`,
  POINT_ITEM_DETAIL: (id) => `${ADMIN}/point/items/${id}`,
};

/* ── 고객센터 관리 (윤형주) ──
 * 2026-04-08: 앱 공지(AppNotice) 통합으로 NOTICE_ACTIVE 추가 (활성 토글 PATCH).
 *             구 /api/v1/admin/app-notices/* 엔드포인트는 /notices/*로 흡수됨.
 */
export const SUPPORT_ADMIN_ENDPOINTS = {
  /* 공지사항 */
  NOTICES: `${ADMIN}/notices`,
  NOTICE_DETAIL: (id) => `${ADMIN}/notices/${id}`,
  NOTICE_REORDER: `${ADMIN}/notices/reorder`,
  NOTICE_ACTIVE: (id) => `${ADMIN}/notices/${id}/active`,
  /* FAQ */
  FAQ: `${ADMIN}/faq`,
  FAQ_DETAIL: (id) => `${ADMIN}/faq/${id}`,
  FAQ_REORDER: `${ADMIN}/faq/reorder`,
  /* 도움말 */
  HELP: `${ADMIN}/help-articles`,
  HELP_DETAIL: (id) => `${ADMIN}/help-articles/${id}`,
  /* 티켓 */
  TICKETS: `${ADMIN}/tickets`,
  TICKET_DETAIL: (id) => `${ADMIN}/tickets/${id}`,
  TICKET_STATUS: (id) => `${ADMIN}/tickets/${id}/status`,
  TICKET_REPLY: (id) => `${ADMIN}/tickets/${id}/reply`,
  /* 2026-04-08: 비속어 사전(PROFANITY*) 엔드포인트 제거 */
};

/* ── AI 운영 (윤형주) ──
 * 2026-04-08: REVIEW_GENERATE / REVIEW_HISTORY 제거 — AI 리뷰 생성 기능 삭제
 */
export const AI_ADMIN_ENDPOINTS = {
  QUIZ_GENERATE: `${ADMIN}/ai/quiz/generate`,
  QUIZ_HISTORY: `${ADMIN}/ai/quiz/history`,
  CHAT_SESSIONS: `${ADMIN}/ai/chat/sessions`,
  CHAT_MESSAGES: (sessionId) => `${ADMIN}/ai/chat/sessions/${sessionId}/messages`,
  CHAT_STATS: `${ADMIN}/ai/chat/stats`,
};

/* ── 데이터 관리 (윤형주 — Agent) ── */
// 2026-04-14: Agent 가 실제로 제공하는 경로와 일치시킴 (기존 /data/stats, /data/health 는
// 미구현이라 "데이터 현황" 탭이 비어 보였던 원인). admin_data.py 의 데이터 현황 3EP 와 매핑:
//   OVERVIEW     → /admin/data/overview     (5DB 건수 카드)
//   DISTRIBUTION → /admin/data/distribution (소스별 분포)
//   QUALITY      → /admin/data/quality      (NULL 비율 등 품질)
export const DATA_ADMIN_ENDPOINTS = {
  OVERVIEW: `${ADMIN}/data/overview`,
  DISTRIBUTION: `${ADMIN}/data/distribution`,
  QUALITY: `${ADMIN}/data/quality`,
  MOVIES: `${ADMIN}/movies`,
  MOVIE_DETAIL: (id) => `${ADMIN}/movies/${id}`,
  MOVIE_DB_STATUS: (id) => `${ADMIN}/movies/${id}/db-status`,
  PIPELINE_RUN: `${ADMIN}/pipeline/run`,
  PIPELINE_STATUS: `${ADMIN}/pipeline/status`,
  PIPELINE_LOG: `${ADMIN}/pipeline/log/stream`,
  PIPELINE_CANCEL: `${ADMIN}/pipeline/cancel`,
  PIPELINE_HISTORY: `${ADMIN}/pipeline/history`,
  PIPELINE_CHECKPOINT: `${ADMIN}/pipeline/checkpoint`,
  PIPELINE_RETRY: `${ADMIN}/pipeline/retry-failed`,
};
