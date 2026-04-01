/**
 * 결제/포인트 관리 탭 API 호출 함수 모음.
 *
 * 모든 요청은 backendApi(Spring Boot :8080)를 통해 처리된다.
 * PAYMENT_ADMIN_ENDPOINTS 상수를 사용하며 하드코딩 금지.
 *
 * @module paymentApi
 */

import { backendApi } from '@/shared/api/axiosInstance';
import { PAYMENT_ADMIN_ENDPOINTS } from '@/shared/constants/api';

/* ── 결제 주문 ── */

/**
 * 결제 내역 목록 조회.
 * @param {Object} params - 검색 조건
 * @param {string} [params.status]  - 결제 상태 필터 (COMPLETED|PENDING|FAILED|REFUNDED)
 * @param {string} [params.type]    - 결제 유형 필터 (SUBSCRIPTION|POINT_PACK|ITEM)
 * @param {string} [params.userId]  - 특정 사용자 ID 필터
 * @param {number} [params.page=0]  - 페이지 번호 (0-base)
 * @param {number} [params.size=20] - 페이지 크기
 * @returns {Promise<{content: Array, totalElements: number, totalPages: number}>}
 */
export function fetchPaymentOrders(params = {}) {
  const { page = 0, size = 20, ...rest } = params;
  const query = new URLSearchParams({ page, size, ...rest }).toString();
  return backendApi.get(`${PAYMENT_ADMIN_ENDPOINTS.ORDERS}?${query}`);
}

/**
 * 결제 주문 상세 조회.
 * @param {string} orderId - 주문 ID
 * @returns {Promise<Object>} 주문 상세 정보
 */
export function fetchOrderDetail(orderId) {
  return backendApi.get(PAYMENT_ADMIN_ENDPOINTS.ORDER_DETAIL(orderId));
}

/**
 * 환불 처리.
 * @param {string} orderId      - 환불할 주문 ID
 * @param {Object} data         - 환불 요청 데이터
 * @param {string} data.reason  - 환불 사유
 * @param {number} [data.amount] - 부분 환불 금액 (생략 시 전액 환불)
 * @returns {Promise<Object>} 환불 결과
 */
export function refundOrder(orderId, data) {
  return backendApi.post(PAYMENT_ADMIN_ENDPOINTS.REFUND(orderId), data);
}

/**
 * 보상 실패 주문 목록 조회.
 * Toss Payments 콜백 실패 또는 포인트 지급 실패로 처리되지 않은 주문.
 * @returns {Promise<Array>} 보상 실패 주문 목록
 */
export function fetchFailedOrders() {
  return backendApi.get(PAYMENT_ADMIN_ENDPOINTS.FAILED_ORDERS);
}

/**
 * 보상 실패 건 수동 보상 처리.
 * @param {string} orderId - 보상할 주문 ID
 * @returns {Promise<Object>} 처리 결과
 */
export function compensateOrder(orderId) {
  return backendApi.post(PAYMENT_ADMIN_ENDPOINTS.COMPENSATE(orderId));
}

/* ── 구독 ── */

/**
 * 구독 목록 조회.
 * @param {Object} params             - 검색 조건
 * @param {string} [params.status]    - 상태 필터 (ACTIVE|CANCELLED|EXPIRED)
 * @param {string} [params.plan]      - 플랜 필터 (BASIC|PREMIUM|ENTERPRISE)
 * @param {number} [params.page=0]    - 페이지 번호
 * @param {number} [params.size=20]   - 페이지 크기
 * @returns {Promise<{content: Array, totalElements: number, totalPages: number}>}
 */
export function fetchSubscriptions(params = {}) {
  const { page = 0, size = 20, ...rest } = params;
  const query = new URLSearchParams({ page, size, ...rest }).toString();
  return backendApi.get(`${PAYMENT_ADMIN_ENDPOINTS.SUBSCRIPTIONS}?${query}`);
}

/**
 * 구독 수동 취소.
 * @param {string|number} id - 구독 ID
 * @returns {Promise<Object>} 취소 결과
 */
export function cancelSubscription(id) {
  return backendApi.post(PAYMENT_ADMIN_ENDPOINTS.CANCEL_SUB(id));
}

/**
 * 구독 연장.
 * @param {string|number} id - 구독 ID
 * @returns {Promise<Object>} 연장 결과
 */
export function extendSubscription(id) {
  return backendApi.post(PAYMENT_ADMIN_ENDPOINTS.EXTEND_SUB(id));
}

/* ── 포인트 ── */

/**
 * 포인트 수동 지급 또는 차감.
 * @param {Object} data          - 지급/차감 요청 데이터
 * @param {string} data.userId   - 대상 사용자 ID
 * @param {number} data.amount   - 포인트 금액 (양수)
 * @param {string} data.reason   - 처리 사유
 * @param {string} data.type     - 처리 유형 (EARN: 지급 | DEDUCT: 차감)
 * @returns {Promise<Object>} 처리 결과 (잔액 포함)
 */
export function manualPointTransfer(data) {
  return backendApi.post(PAYMENT_ADMIN_ENDPOINTS.POINT_MANUAL, data);
}

/**
 * 특정 사용자의 포인트 변동 이력 조회.
 * @param {string} userId         - 사용자 ID
 * @param {Object} params         - 검색 조건
 * @param {number} [params.page=0]  - 페이지 번호
 * @param {number} [params.size=20] - 페이지 크기
 * @returns {Promise<{content: Array, totalElements: number, totalPages: number}>}
 */
export function fetchPointHistory(userId, params = {}) {
  const { page = 0, size = 20 } = params;
  const query = new URLSearchParams({ page, size }).toString();
  return backendApi.get(`${PAYMENT_ADMIN_ENDPOINTS.POINT_HISTORY(userId)}?${query}`);
}

/**
 * 포인트 교환 아이템 목록 조회.
 * @returns {Promise<Array>} 아이템 목록
 */
export function fetchPointItems() {
  return backendApi.get(PAYMENT_ADMIN_ENDPOINTS.POINT_ITEMS);
}

/**
 * 포인트 아이템 정보 수정.
 * @param {string|number} id  - 아이템 ID
 * @param {Object} data       - 수정할 데이터 (name, price, description, active 등)
 * @returns {Promise<Object>} 수정된 아이템 정보
 */
export function updatePointItem(id, data) {
  return backendApi.put(PAYMENT_ADMIN_ENDPOINTS.POINT_ITEM_DETAIL(id), data);
}
