/**
 * 콘텐츠 관리 API 호출 함수.
 *
 * 담당 영역:
 * - 신고 목록 조회 및 조치 처리
 * - 혐오표현(독성) 로그 조회 및 조치 처리
 * - 게시글 목록 조회, 수정, 삭제
 * - 리뷰 목록 조회, 삭제
 *
 * 모든 함수는 backendApi (JWT 자동 갱신 포함) 인스턴스를 사용.
 */

import { backendApi } from '@/shared/api/axiosInstance';

/** 관리자 API 기본 경로 */
const ADMIN = '/api/v1/admin';

/* ── 신고 관리 ── */

/**
 * 신고 목록 조회.
 * @param {Object} params - 쿼리 파라미터
 * @param {string} [params.status] - 필터 상태 (pending/reviewed/dismissed)
 * @param {number} [params.page=0] - 페이지 번호 (0-based)
 * @param {number} [params.size=10] - 페이지 크기
 * @returns {Promise<Object>} 페이징된 신고 목록 { content, totalElements, totalPages }
 */
export function fetchReports(params) {
  return backendApi.get(`${ADMIN}/reports`, { params });
}

/**
 * 신고 조치 처리.
 * @param {string|number} id - 신고 ID
 * @param {Object} data - 조치 데이터
 * @param {string} data.action - 조치 유형 (blind/delete/dismiss)
 * @param {string} [data.reason] - 처리 사유 (선택)
 * @returns {Promise<Object>} 처리 결과
 */
export function processReport(id, data) {
  return backendApi.put(`${ADMIN}/reports/${id}/action`, data);
}

/* ── 혐오표현(독성) 로그 ── */

/**
 * 혐오표현 감지 로그 목록 조회.
 * @param {Object} params - 쿼리 파라미터
 * @param {number} [params.minScore] - 최소 독성 점수 필터 (0.0~1.0)
 * @param {number} [params.page=0] - 페이지 번호 (0-based)
 * @param {number} [params.size=10] - 페이지 크기
 * @returns {Promise<Object>} 페이징된 독성 로그 목록
 */
export function fetchToxicityLogs(params) {
  return backendApi.get(`${ADMIN}/toxicity`, { params });
}

/**
 * 혐오표현 조치 처리.
 * @param {string|number} id - 독성 로그 ID
 * @param {Object} data - 조치 데이터
 * @param {string} data.action - 조치 유형 (restore/delete/warn)
 * @param {string} [data.reason] - 처리 사유 (선택)
 * @returns {Promise<Object>} 처리 결과
 */
export function processToxicity(id, data) {
  return backendApi.put(`${ADMIN}/toxicity/${id}/action`, data);
}

/* ── 게시글 관리 ── */

/**
 * 게시글 목록 조회.
 * @param {Object} params - 쿼리 파라미터
 * @param {string} [params.keyword] - 제목/내용 키워드 검색
 * @param {string} [params.category] - 카테고리 필터 (FREE/DISCUSSION/RECOMMENDATION/NEWS)
 * @param {string} [params.status] - 상태 필터 (normal/blinded/deleted)
 * @param {number} [params.page=0] - 페이지 번호 (0-based)
 * @param {number} [params.size=10] - 페이지 크기
 * @returns {Promise<Object>} 페이징된 게시글 목록
 */
export function fetchPosts(params) {
  return backendApi.get(`${ADMIN}/posts`, { params });
}

/**
 * 게시글 수정.
 * @param {string|number} id - 게시글 ID
 * @param {Object} data - 수정 데이터
 * @param {string} data.title - 제목
 * @param {string} data.content - 내용
 * @param {string} data.category - 카테고리
 * @param {string} data.editReason - 수정 사유
 * @returns {Promise<Object>} 수정된 게시글 정보
 */
export function updatePost(id, data) {
  return backendApi.put(`${ADMIN}/posts/${id}`, data);
}

/**
 * 게시글 삭제.
 * @param {string|number} id - 게시글 ID
 * @returns {Promise<void>}
 */
export function deletePost(id) {
  return backendApi.delete(`${ADMIN}/posts/${id}`);
}

/* ── 리뷰 관리 ── */

/**
 * 리뷰 목록 조회.
 *
 * 도장깨기 인증 리뷰 모니터링: categoryCode='COURSE' 로 필터링하면
 * ReviewCategoryCode.COURSE 로 작성된 리뷰만 조회된다.
 * 기타 카테고리: THEATER_RECEIPT/WORLDCUP/WISHLIST/AI_RECOMMEND/PLAYLIST.
 *
 * @param {Object} params - 쿼리 파라미터
 * @param {string} [params.movieId] - 영화 ID 필터
 * @param {number} [params.minRating] - 최소 평점 필터 (1~5)
 * @param {string} [params.categoryCode] - 카테고리 enum 이름 필터 (생략 시 전체)
 * @param {number} [params.page=0] - 페이지 번호 (0-based)
 * @param {number} [params.size=10] - 페이지 크기
 * @returns {Promise<Object>} 페이징된 리뷰 목록
 */
export function fetchReviews(params) {
  return backendApi.get(`${ADMIN}/reviews`, { params });
}

/**
 * 리뷰 삭제.
 * @param {string|number} id - 리뷰 ID
 * @returns {Promise<void>}
 */
export function deleteReview(id) {
  return backendApi.delete(`${ADMIN}/reviews/${id}`);
}
