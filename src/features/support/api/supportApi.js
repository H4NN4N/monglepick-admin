/**
 * 고객센터 관리 탭 API 호출 모듈.
 *
 * 모든 요청은 Backend(Spring Boot :8080) backendApi 인스턴스를 사용.
 * 엔드포인트는 SUPPORT_ADMIN_ENDPOINTS 상수에서 가져옴 (하드코딩 금지).
 *
 * 구성:
 * - 공지사항 CRUD + 순서 변경 (5개)
 * - FAQ CRUD + 순서 변경 (5개)
 * - 도움말 CRUD (4개)
 * - 티켓 목록/상세/상태변경/답변 (4개)
 * - 비속어 목록/추가/삭제/CSV 임포트/익스포트 (5개)
 */

import { backendApi } from '@/shared/api/axiosInstance';
import { SUPPORT_ADMIN_ENDPOINTS } from '@/shared/constants/api';

/* ── 공지사항 (Notices) ── */

/**
 * 공지사항 목록 조회.
 * @param {Object} params - { page, size, category, isPinned }
 * @returns {Promise<Object>} 페이징된 공지사항 목록
 */
export function fetchNotices(params) {
  return backendApi.get(SUPPORT_ADMIN_ENDPOINTS.NOTICES, { params });
}

/**
 * 공지사항 등록.
 * @param {Object} data - { title, category, content, isPinned, isPublished, scheduledAt }
 * @returns {Promise<Object>} 생성된 공지사항
 */
export function createNotice(data) {
  return backendApi.post(SUPPORT_ADMIN_ENDPOINTS.NOTICES, data);
}

/**
 * 공지사항 수정.
 * @param {number|string} id - 공지사항 ID
 * @param {Object} data - 수정할 필드
 * @returns {Promise<Object>} 수정된 공지사항
 */
export function updateNotice(id, data) {
  return backendApi.put(SUPPORT_ADMIN_ENDPOINTS.NOTICE_DETAIL(id), data);
}

/**
 * 공지사항 삭제.
 * @param {number|string} id - 공지사항 ID
 * @returns {Promise<void>}
 */
export function deleteNotice(id) {
  return backendApi.delete(SUPPORT_ADMIN_ENDPOINTS.NOTICE_DETAIL(id));
}

/**
 * 공지사항 순서 일괄 변경.
 * @param {Array<Object>} orders - [{ id, displayOrder }, ...]
 * @returns {Promise<void>}
 */
export function reorderNotices(orders) {
  return backendApi.put(SUPPORT_ADMIN_ENDPOINTS.NOTICE_REORDER, orders);
}

/* ── FAQ ── */

/**
 * FAQ 목록 조회.
 * @param {Object} params - { page, size, category, isPublished }
 * @returns {Promise<Object>} 페이징된 FAQ 목록
 */
export function fetchFaqs(params) {
  return backendApi.get(SUPPORT_ADMIN_ENDPOINTS.FAQ, { params });
}

/**
 * FAQ 등록.
 * @param {Object} data - { category, question, answer, isPublished }
 * @returns {Promise<Object>} 생성된 FAQ
 */
export function createFaq(data) {
  return backendApi.post(SUPPORT_ADMIN_ENDPOINTS.FAQ, data);
}

/**
 * FAQ 수정.
 * @param {number|string} id - FAQ ID
 * @param {Object} data - 수정할 필드
 * @returns {Promise<Object>} 수정된 FAQ
 */
export function updateFaq(id, data) {
  return backendApi.put(SUPPORT_ADMIN_ENDPOINTS.FAQ_DETAIL(id), data);
}

/**
 * FAQ 삭제.
 * @param {number|string} id - FAQ ID
 * @returns {Promise<void>}
 */
export function deleteFaq(id) {
  return backendApi.delete(SUPPORT_ADMIN_ENDPOINTS.FAQ_DETAIL(id));
}

/**
 * FAQ 순서 일괄 변경.
 * @param {Array<Object>} orders - [{ id, displayOrder }, ...]
 * @returns {Promise<void>}
 */
export function reorderFaqs(orders) {
  return backendApi.put(SUPPORT_ADMIN_ENDPOINTS.FAQ_REORDER, orders);
}

/* ── 도움말 (Help Articles) ── */

/**
 * 도움말 목록 조회.
 * @param {Object} params - { page, size, category }
 * @returns {Promise<Object>} 페이징된 도움말 목록
 */
export function fetchHelpArticles(params) {
  return backendApi.get(SUPPORT_ADMIN_ENDPOINTS.HELP, { params });
}

/**
 * 도움말 등록.
 * @param {Object} data - { title, category, content, displayOrder }
 * @returns {Promise<Object>} 생성된 도움말
 */
export function createHelpArticle(data) {
  return backendApi.post(SUPPORT_ADMIN_ENDPOINTS.HELP, data);
}

/**
 * 도움말 수정.
 * @param {number|string} id - 도움말 ID
 * @param {Object} data - 수정할 필드
 * @returns {Promise<Object>} 수정된 도움말
 */
export function updateHelpArticle(id, data) {
  return backendApi.put(SUPPORT_ADMIN_ENDPOINTS.HELP_DETAIL(id), data);
}

/**
 * 도움말 삭제.
 * @param {number|string} id - 도움말 ID
 * @returns {Promise<void>}
 */
export function deleteHelpArticle(id) {
  return backendApi.delete(SUPPORT_ADMIN_ENDPOINTS.HELP_DETAIL(id));
}

/* ── 상담 티켓 (Support Tickets) ── */

/**
 * 티켓 목록 조회.
 * @param {Object} params - { page, size, status, category, priority }
 * @returns {Promise<Object>} 페이징된 티켓 목록
 */
export function fetchTickets(params) {
  return backendApi.get(SUPPORT_ADMIN_ENDPOINTS.TICKETS, { params });
}

/**
 * 티켓 상세 조회 (답변 이력 포함).
 * @param {number|string} id - 티켓 ID
 * @returns {Promise<Object>} 티켓 상세 및 답변 이력
 */
export function fetchTicketDetail(id) {
  return backendApi.get(SUPPORT_ADMIN_ENDPOINTS.TICKET_DETAIL(id));
}

/**
 * 티켓 상태 변경.
 * @param {number|string} id - 티켓 ID
 * @param {Object} data - { status } (OPEN/IN_PROGRESS/RESOLVED/CLOSED)
 * @returns {Promise<Object>} 업데이트된 티켓
 */
export function updateTicketStatus(id, data) {
  return backendApi.put(SUPPORT_ADMIN_ENDPOINTS.TICKET_STATUS(id), data);
}

/**
 * 티켓 답변 작성.
 * @param {number|string} id - 티켓 ID
 * @param {Object} data - { content }
 * @returns {Promise<Object>} 작성된 답변
 */
export function replyToTicket(id, data) {
  return backendApi.post(SUPPORT_ADMIN_ENDPOINTS.TICKET_REPLY(id), data);
}

/* ── 비속어 사전 (Profanity) ── */

/**
 * 비속어 목록 조회.
 * @param {Object} params - { page, size, category, isActive }
 * @returns {Promise<Object>} 페이징된 비속어 목록
 */
export function fetchProfanity(params) {
  return backendApi.get(SUPPORT_ADMIN_ENDPOINTS.PROFANITY, { params });
}

/**
 * 비속어 추가.
 * @param {Object} data - { word, category, severity }
 * @returns {Promise<Object>} 추가된 비속어 항목
 */
export function addProfanity(data) {
  return backendApi.post(SUPPORT_ADMIN_ENDPOINTS.PROFANITY, data);
}

/**
 * 비속어 삭제.
 * @param {number|string} id - 비속어 항목 ID
 * @returns {Promise<void>}
 */
export function deleteProfanity(id) {
  return backendApi.delete(SUPPORT_ADMIN_ENDPOINTS.PROFANITY_DETAIL(id));
}

/**
 * 비속어 CSV 일괄 임포트.
 * Content-Type은 multipart/form-data로 자동 설정됨.
 * @param {File} file - CSV 파일 객체
 * @returns {Promise<Object>} 임포트 결과 (추가 수, 중복 수 등)
 */
export function importProfanity(file) {
  const formData = new FormData();
  formData.append('file', file);
  return backendApi.post(SUPPORT_ADMIN_ENDPOINTS.PROFANITY_IMPORT, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/**
 * 비속어 전체 CSV 익스포트.
 * responseType: 'blob'으로 파일 다운로드 처리.
 * axiosInstance의 response.data 언래핑을 우회하기 위해 별도 처리.
 * @returns {Promise<Blob>} CSV 파일 Blob
 */
export function exportProfanity() {
  return backendApi.get(SUPPORT_ADMIN_ENDPOINTS.PROFANITY_EXPORT, {
    responseType: 'blob',
    // axiosInstance 인터셉터가 response.data를 반환하므로 Blob이 그대로 반환됨
  });
}
