/**
 * 운영 도구 — 월드컵 후보 영화(WorldcupCandidate) 관리 API.
 *
 * 백엔드 AdminWorldcupCandidateController(/api/v1/admin/worldcup-candidates) 7개 EP.
 *
 * - 목록 조회 (페이징 + category 필터)
 * - 단건 조회
 * - 신규 등록 ((movieId, category) UNIQUE)
 * - 메타 수정 (popularity/isActive/adminNote)
 * - 활성화 토글
 * - 인기도 임계값 미만 일괄 비활성화
 * - hard delete
 */

import { backendApi } from '@/shared/api/axiosInstance';

const BASE = '/api/v1/admin/worldcup-candidates';

/** 후보 목록 조회 (페이징) */
export function fetchCandidates(params = {}) {
  return backendApi.get(BASE, { params });
}

/** 후보 단건 조회 */
export function fetchCandidate(id) {
  return backendApi.get(`${BASE}/${id}`);
}

/** 신규 후보 등록 */
export function createCandidate(payload) {
  return backendApi.post(BASE, payload);
}

/** 후보 메타 수정 */
export function updateCandidate(id, payload) {
  return backendApi.put(`${BASE}/${id}`, payload);
}

/** 활성/비활성 토글 */
export function updateCandidateActive(id, isActive) {
  return backendApi.patch(`${BASE}/${id}/active`, { isActive });
}

/** 인기도 임계값 미만 일괄 비활성화 */
export function deactivateBelowPopularity(threshold) {
  return backendApi.post(`${BASE}/deactivate-below`, { threshold });
}

/** 후보 삭제 */
export function deleteCandidate(id) {
  return backendApi.delete(`${BASE}/${id}`);
}
