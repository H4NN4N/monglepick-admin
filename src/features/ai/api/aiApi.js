/**
 * AI 운영 탭 API 호출 함수.
 * AI_ADMIN_ENDPOINTS 상수 사용.
 *
 * - 퀴즈/리뷰 생성 트리거: agentApi (FastAPI Agent :8000)
 * - 퀴즈/리뷰 이력, 챗봇 세션: backendApi (Spring Boot :8080)
 *
 * @service Agent   - 퀴즈 생성 트리거, 리뷰 생성 트리거
 * @service Backend - 이력 조회, 챗봇 세션/메시지/통계
 */

import { backendApi, agentApi } from '@/shared/api/axiosInstance';
import { AI_ADMIN_ENDPOINTS } from '@/shared/constants/api';

/* ── 퀴즈 ── */

/**
 * AI 퀴즈 생성 트리거 (Agent).
 * @param {Object} data - { genre, difficulty, count }
 * @returns {Promise<Object>} 생성 결과
 */
export function generateQuiz(data) {
  return agentApi.post(AI_ADMIN_ENDPOINTS.QUIZ_GENERATE, data);
}

/**
 * AI 퀴즈 생성 이력 조회 (Backend, 페이징).
 * @param {Object} params - { page, size }
 * @returns {Promise<Object>} 이력 목록
 */
export function fetchQuizHistory(params) {
  return backendApi.get(AI_ADMIN_ENDPOINTS.QUIZ_HISTORY, { params });
}

/* 2026-04-08: generateReview / fetchReviewHistory 제거 — AI 리뷰 생성 기능 삭제 */

/* ── 챗봇 로그 ── */

/**
 * 챗봇 대화 세션 목록 조회 (Backend, 페이징).
 * @param {Object} params - { page, size, keyword }
 * @returns {Promise<Object>} 세션 목록
 */
export function fetchChatSessions(params) {
  return backendApi.get(AI_ADMIN_ENDPOINTS.CHAT_SESSIONS, { params });
}

/**
 * 특정 세션의 메시지 목록 조회 (Backend).
 * @param {string} sessionId - 세션 ID
 * @returns {Promise<Array>} 메시지 배열
 */
export function fetchChatMessages(sessionId) {
  return backendApi.get(AI_ADMIN_ENDPOINTS.CHAT_MESSAGES(sessionId));
}

/**
 * 챗봇 사용 통계 조회 (Backend).
 * @param {Object} params - { from, to } (ISO 날짜 문자열)
 * @returns {Promise<Object>} 통계 데이터
 */
export function fetchChatStats(params) {
  return backendApi.get(AI_ADMIN_ENDPOINTS.CHAT_STATS, { params });
}
