/**
 * 운영 도구 — 영화(Movie) 마스터 관리 API 호출.
 *
 * 백엔드 AdminMovieController(/api/v1/admin/movies) 5개 EP 호출.
 *
 * - 목록 조회 (페이징 + 키워드 검색)
 * - 단건 조회
 * - 신규 등록 (movieId/tmdbId UNIQUE — 중복 시 409, source='admin' 고정)
 * - 수정 (식별자 제외 핵심 필드)
 * - 삭제 (hard delete — orphan FK 주의)
 */

import { backendApi } from '@/shared/api/axiosInstance';

const BASE = '/api/v1/admin/movies';

/**
 * 영화 목록 조회 (페이징 + 키워드).
 *
 * @param {Object} params
 * @param {string} [params.keyword]  제목 검색 키워드
 * @param {number} [params.page=0]
 * @param {number} [params.size=20]
 */
export function fetchMovies(params = {}) {
  return backendApi.get(BASE, { params });
}

/** 영화 단건 조회 */
export function fetchMovie(movieId) {
  return backendApi.get(`${BASE}/${encodeURIComponent(movieId)}`);
}

/** 영화 신규 등록 */
export function createMovie(payload) {
  return backendApi.post(BASE, payload);
}

/** 영화 수정 */
export function updateMovie(movieId, payload) {
  return backendApi.put(`${BASE}/${encodeURIComponent(movieId)}`, payload);
}

/** 영화 삭제 (hard delete) */
export function deleteMovie(movieId) {
  return backendApi.delete(`${BASE}/${encodeURIComponent(movieId)}`);
}
