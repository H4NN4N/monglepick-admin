/**
 * 관리자 — 영화 티켓 추첨 관리 API 호출 함수 모음 (2026-04-28 신규).
 *
 * <p>Backend `AdminLotteryController` 의 5개 EP 를 호출한다.
 * "결제/포인트 → 추첨 관리" 서브탭 (LotteryTab) 에서 사용된다.</p>
 *
 * 모든 요청은 backendApi(Spring Boot :8080)를 통해 처리되며,
 * 공통 ApiResponse 래퍼는 axios 인터셉터에서 자동으로 풀어진다 (paymentApi 와 동일).
 *
 * @module lotteryApi
 */

import { backendApi } from '@/shared/api/axiosInstance';
import { SERVICE_URLS } from '@/shared/api/serviceUrls';
import { LOTTERY_ADMIN_ENDPOINTS } from '@/shared/constants/api';
import { getToken } from '@/shared/utils/storage';

/**
 * 추첨 회차 페이징 조회.
 *
 * @param {Object} params              - 검색 조건
 * @param {string} [params.status]     - 회차 상태 필터 (PENDING|DRAWING|COMPLETED, 생략 시 전체)
 * @param {number} [params.page=0]     - 페이지 번호 (0-base)
 * @param {number} [params.size=20]    - 페이지 크기
 * @param {string} [params.sort]       - 정렬 기준 (예: 'cycleYearMonth,desc' — 기본 백엔드에서 cycleYearMonth DESC)
 * @returns {Promise<{content: Array, totalElements: number, totalPages: number}>}
 */
export function fetchLotteryCycles(params = {}) {
  const { page = 0, size = 20, status, sort } = params;
  const qp = new URLSearchParams({ page, size });
  if (status) qp.append('status', status);
  if (sort)   qp.append('sort', sort);
  return backendApi.get(`${LOTTERY_ADMIN_ENDPOINTS.CYCLES}?${qp.toString()}`);
}

/**
 * 추첨 회차 상세 조회.
 *
 * @param {number|string} lotteryId - 회차 PK
 * @returns {Promise<Object>} LotterySummary (통계 포함)
 */
export function fetchLotteryCycle(lotteryId) {
  return backendApi.get(LOTTERY_ADMIN_ENDPOINTS.CYCLE_DETAIL(lotteryId));
}

/**
 * 추첨 회차 수정 — winner_count / notes 부분 업데이트.
 *
 * <p>두 필드 모두 nullable 하게 보낼 수 있다. null 인 필드는 백엔드에서 무시된다 (PATCH 시멘틱).
 * COMPLETED 회차의 winnerCount 변경은 LTR002 에러를 반환한다.</p>
 *
 * @param {number|string} lotteryId        - 회차 PK
 * @param {Object} data                    - 수정 요청
 * @param {number} [data.winnerCount]      - 새 당첨자 수 (1~1000)
 * @param {string} [data.notes]            - 운영자 메모 (최대 500자)
 * @returns {Promise<Object>} 수정된 LotterySummary
 */
export function updateLotteryCycle(lotteryId, data) {
  return backendApi.patch(LOTTERY_ADMIN_ENDPOINTS.CYCLE_UPDATE(lotteryId), data);
}

/**
 * 수동 추첨 실행 — 비가역 운영 액션.
 *
 * <p>회차의 PENDING entry 를 모두 WON/LOST 로 확정한다.
 * COMPLETED 회차는 LTR002 에러로 거부된다.</p>
 *
 * @param {number|string} lotteryId - 회차 PK
 * @returns {Promise<{lotteryId: number, cycleYearMonth: string, drawnCount: number, status: string}>}
 */
export function drawLotteryCycle(lotteryId) {
  return backendApi.post(LOTTERY_ADMIN_ENDPOINTS.CYCLE_DRAW(lotteryId));
}

/**
 * 회차별 응모자 명단 페이징 조회.
 *
 * @param {number|string} lotteryId    - 회차 PK
 * @param {Object} params              - 검색 조건
 * @param {string} [params.status]     - 응모 결과 필터 (PENDING|WON|LOST, 생략 시 전체)
 * @param {string} [params.keyword]    - 닉네임/이메일/userId 부분 일치 검색 (2026-04-29)
 * @param {number} [params.page=0]     - 페이지 번호
 * @param {number} [params.size=50]    - 페이지 크기 (운영 명단은 보통 50건씩)
 * @returns {Promise<{content: Array, totalElements: number, totalPages: number}>}
 */
export function fetchLotteryEntries(lotteryId, params = {}) {
  const { page = 0, size = 50, status, keyword } = params;
  const qp = new URLSearchParams({ page, size });
  if (status) qp.append('status', status);
  if (keyword && keyword.trim()) qp.append('keyword', keyword.trim());
  return backendApi.get(
    `${LOTTERY_ADMIN_ENDPOINTS.CYCLE_ENTRIES(lotteryId)}?${qp.toString()}`
  );
}

/**
 * 추첨 회차 강제 생성 (2026-04-29 신규).
 *
 * <p>운영자가 미래 회차/특수 회차를 사전 생성하고 싶을 때 사용.
 * 동일 cycleYearMonth 가 이미 존재하면 LTR002 에러를 반환한다.</p>
 *
 * @param {Object} data
 * @param {string} data.cycleYearMonth   - 'YYYY-MM' 형식
 * @param {number} [data.winnerCount=5]  - 당첨자 수 (1~1000)
 * @returns {Promise<Object>} 생성된 LotterySummary
 */
export function createLotteryCycle(data) {
  return backendApi.post(LOTTERY_ADMIN_ENDPOINTS.CYCLE_CREATE, data);
}

/**
 * DRAWING 상태 회차 PENDING 복구 (2026-04-29 신규).
 *
 * <p>운영 사고로 회차가 DRAWING 상태에서 멈췄을 때 사용. 다른 상태에서는 LTR002 에러.</p>
 *
 * @param {number|string} lotteryId
 * @returns {Promise<Object>} 복구된 LotterySummary
 */
export function resetLotteryCycle(lotteryId) {
  return backendApi.post(LOTTERY_ADMIN_ENDPOINTS.CYCLE_RESET(lotteryId));
}

/**
 * 회차별 응모자 CSV 다운로드 (2026-04-29 신규).
 *
 * <p>축약 fetch 가 아닌 raw fetch — 바이너리 응답을 Blob 으로 받아 a[download] 트릭으로 다운로드.
 * backendApi(axios) 인터셉터가 ApiResponse 래퍼 처리에 특화돼 있어 fetch 로 우회한다.
 * JWT 는 axios 와 동일하게 관리자 전용 `adminAccessToken` 을 사용한다.</p>
 *
 * @param {number|string} lotteryId
 * @param {string} [status]   응모 결과 필터 (보통 'WON')
 * @returns {Promise<Blob>}
 */
export async function downloadLotteryEntriesCsv(lotteryId, status) {
  const qp = new URLSearchParams();
  if (status) qp.append('status', status);
  const path = LOTTERY_ADMIN_ENDPOINTS.CYCLE_ENTRIES_EXPORT(lotteryId);
  const url = `${SERVICE_URLS.BACKEND}${path}${qp.toString() ? `?${qp}` : ''}`;
  const token = getToken();
  const res = await fetch(url, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `CSV 다운로드 실패 (HTTP ${res.status})`);
  }
  return res.blob();
}
