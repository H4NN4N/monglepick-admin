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
 *
 * Toss Payments 콜백 실패 또는 포인트/구독 지급 실패로 `COMPENSATION_FAILED`
 * 상태가 된 주문을 반환한다. 별도 엔드포인트 없이 결제 목록 API에 상태 필터로
 * 조회하며, 응답의 `content` 배열만 추출해 평탄화한다.
 *
 * @returns {Promise<Array>} 보상 실패 주문 목록 (빈 배열 가능)
 */
export function fetchFailedOrders() {
  // 백엔드는 /payment/orders/failed 엔드포인트를 제공하지 않는다.
  // 대신 ORDERS 목록에 status=COMPENSATION_FAILED 필터로 조회한다.
  const query = new URLSearchParams({ status: 'COMPENSATION_FAILED', page: 0, size: 100 }).toString();
  return backendApi
    .get(`${PAYMENT_ADMIN_ENDPOINTS.ORDERS}?${query}`)
    .then((page) => (Array.isArray(page?.content) ? page.content : []));
}

/**
 * 보상 실패 건 수동 보상 처리.
 *
 * 백엔드는 `POST /api/v1/admin/subscription/{orderId}/compensate` (설계서 잔존 경로)이며,
 * body로 `adminNote`(필수)를 받는다. 실제로는 주문 UUID를 복구하는 엔드포인트다.
 *
 * @param {string} orderId - 복구할 주문 UUID
 * @param {Object} [data]  - 보상 요청 데이터
 * @param {string} [data.adminNote] - 보상 메모 (관리자 입력). 미지정 시 기본값 사용.
 * @returns {Promise<Object>} 복구 결과
 */
export function compensateOrder(orderId, data = {}) {
  return backendApi.post(PAYMENT_ADMIN_ENDPOINTS.COMPENSATE(orderId), {
    adminNote: data.adminNote?.trim() || '관리자 수동 보상 처리',
  });
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
 *
 * 백엔드 AdminPaymentController.cancelSubscription 은 `PUT` 메서드이므로 동일하게 사용한다.
 *
 * @param {string|number} id - 구독 레코드 ID (PK)
 * @returns {Promise<Object>} 취소 결과
 */
export function cancelSubscription(id) {
  return backendApi.put(PAYMENT_ADMIN_ENDPOINTS.CANCEL_SUB(id));
}

/**
 * 구독 연장 (1주기).
 *
 * 백엔드 AdminPaymentController.extendSubscription 은 `PUT` 메서드이며,
 * body 로 adminNote (선택)를 받는다.
 *
 * @param {string|number} id - 구독 레코드 ID (PK)
 * @param {Object} [data]    - 연장 요청 데이터
 * @param {string} [data.adminNote] - 관리자 메모
 * @returns {Promise<Object>} 연장 결과
 */
export function extendSubscription(id, data = {}) {
  return backendApi.put(PAYMENT_ADMIN_ENDPOINTS.EXTEND_SUB(id), {
    adminNote: data.adminNote?.trim() || null,
  });
}

/* ── 포인트 ── */

/**
 * 포인트 수동 지급 또는 차감.
 *
 * 백엔드(`AdminManualPointRequest`)는 `amount` 부호로 지급(+)/차감(-)을 구분한다.
 * 프론트 UI 는 편의상 `type='EARN'|'DEDUCT'`로 입력받으므로, 여기서 부호를 결정해 전달한다.
 *
 * @param {Object} data          - 지급/차감 요청 데이터
 * @param {string} data.userId   - 대상 사용자 ID
 * @param {number} data.amount   - 포인트 금액 (항상 양수 입력)
 * @param {string} data.reason   - 처리 사유
 * @param {string} [data.type='EARN'] - 처리 유형 (EARN: 지급 | DEDUCT: 차감)
 * @returns {Promise<Object>} 처리 결과 (잔액 포함)
 */
export function manualPointTransfer(data) {
  const { userId, amount, reason, type = 'EARN' } = data;
  /* 백엔드 규약: 양수=지급, 음수=차감. UI type 을 amount 부호로 변환한다. */
  const signedAmount = type === 'DEDUCT'
    ? -Math.abs(Number(amount))
    : Math.abs(Number(amount));
  return backendApi.post(PAYMENT_ADMIN_ENDPOINTS.POINT_MANUAL, {
    userId,
    amount: signedAmount,
    reason,
  });
}

/**
 * 특정 사용자의 포인트 변동 이력 조회.
 *
 * 백엔드는 전역 `/point/histories` 엔드포인트에 `userId` 쿼리 파라미터로 필터링을 받는다.
 * userId 를 생략하면 전체 사용자 이력을 반환한다 (본 API 는 필수로 전달).
 *
 * @param {string} userId         - 사용자 ID (필수)
 * @param {Object} params         - 검색 조건
 * @param {number} [params.page=0]  - 페이지 번호 (0-base)
 * @param {number} [params.size=20] - 페이지 크기
 * @returns {Promise<{content: Array, totalElements: number, totalPages: number}>}
 */
export function fetchPointHistory(userId, params = {}) {
  const { page = 0, size = 20 } = params;
  const query = new URLSearchParams({ userId, page, size }).toString();
  return backendApi.get(`${PAYMENT_ADMIN_ENDPOINTS.POINT_HISTORIES}?${query}`);
}

/**
 * 포인트 교환 아이템 목록 조회.
 * @returns {Promise<Array>} 아이템 목록
 */
export function fetchPointItems() {
  return backendApi.get(PAYMENT_ADMIN_ENDPOINTS.POINT_ITEMS);
}

/**
 * 포인트 아이템 신규 등록 — 2026-04-09 P0 누락분 보강.
 *
 * Backend `AdminPaymentService.createPointItem()` + `POST /api/v1/admin/point/items`
 * 엔드포인트는 이미 구현되어 있었으나 Frontend 호출부가 없어 관리자가 UI 에서
 * 신규 포인트 상품을 추가할 수 없었다. 본 함수는 해당 API 를 연결한다.
 *
 * UI 연결(신규 등록 모달)은 후속 작업으로 분리되어 있으며, 그 시점까지는
 * 개발자 콘솔/테스트 스크립트에서 직접 호출할 수 있다.
 *
 * @param {Object} data                   - 포인트 아이템 등록 요청
 * @param {string} data.itemName          - 아이템 이름 (필수)
 * @param {string} [data.itemDescription] - 설명 (선택)
 * @param {number} data.itemPrice         - 가격 (필수, 원 단위)
 * @param {string} [data.itemCategory]    - 카테고리 (미지정 시 "general")
 * @param {boolean} [data.isActive]       - 활성화 여부 (기본 true)
 * @returns {Promise<Object>} 등록된 아이템 응답 DTO
 */
export function createPointItem(data) {
  return backendApi.post(PAYMENT_ADMIN_ENDPOINTS.POINT_ITEMS, data);
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
