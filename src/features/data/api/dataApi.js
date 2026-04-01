/**
 * 데이터 관리 탭 API 호출 함수.
 * 모든 엔드포인트는 DATA_ADMIN_ENDPOINTS 상수를 사용.
 * 영화 CRUD 및 파이프라인 트리거는 agentApi (FastAPI Agent :8000) 사용.
 *
 * @service Agent - FastAPI AI Agent (:8000)
 */

import { agentApi } from '@/shared/api/axiosInstance';
import { DATA_ADMIN_ENDPOINTS } from '@/shared/constants/api';

/* ── 데이터 현황 ── */

/**
 * 5DB(MySQL/Qdrant/Neo4j/ES/Redis) 전체 건수 및 소스별 분포 조회.
 * @returns {Promise<Object>} 통계 데이터
 */
export function fetchDataStats() {
  return agentApi.get(DATA_ADMIN_ENDPOINTS.STATS);
}

/**
 * 데이터 수집 파이프라인 헬스 상태 조회.
 * @returns {Promise<Object>} 헬스 데이터
 */
export function fetchDataHealth() {
  return agentApi.get(DATA_ADMIN_ENDPOINTS.HEALTH);
}

/**
 * 데이터 품질 점수 3종(정확도/완결성/일관성) 조회.
 * @returns {Promise<Object>} 품질 점수
 */
export function fetchDataQuality() {
  return agentApi.get(DATA_ADMIN_ENDPOINTS.QUALITY);
}

/* ── 영화 데이터 CRUD ── */

/**
 * 영화 목록 조회 (검색/필터/페이징).
 * @param {Object} params - 검색 파라미터 { keyword, page, size, source, sort }
 * @returns {Promise<Object>} { content, totalElements, totalPages, ... }
 */
export function fetchMovies(params) {
  return agentApi.get(DATA_ADMIN_ENDPOINTS.MOVIES, { params });
}

/**
 * 영화 상세 조회.
 * @param {string} id - 영화 ID
 * @returns {Promise<Object>} 영화 상세 데이터
 */
export function fetchMovieDetail(id) {
  return agentApi.get(DATA_ADMIN_ENDPOINTS.MOVIE_DETAIL(id));
}

/**
 * 영화 정보 수정.
 * @param {string} id - 영화 ID
 * @param {Object} data - 수정할 필드
 * @returns {Promise<Object>} 수정된 영화 데이터
 */
export function updateMovie(id, data) {
  return agentApi.put(DATA_ADMIN_ENDPOINTS.MOVIE_DETAIL(id), data);
}

/**
 * 영화 삭제 (5DB에서 전부 제거).
 * @param {string} id - 영화 ID
 * @returns {Promise<Object>} 삭제 결과
 */
export function deleteMovie(id) {
  return agentApi.delete(DATA_ADMIN_ENDPOINTS.MOVIE_DETAIL(id));
}

/**
 * 특정 영화의 5DB 동기화 상태 조회.
 * @param {string} id - 영화 ID
 * @returns {Promise<Object>} DB별 존재 여부
 */
export function fetchMovieDbStatus(id) {
  return agentApi.get(DATA_ADMIN_ENDPOINTS.MOVIE_DB_STATUS(id));
}

/* ── 파이프라인 ── */

/**
 * 데이터 수집/임베딩 파이프라인 실행 트리거.
 * @param {Object} data - 실행 옵션 { task, options }
 * @returns {Promise<Object>} 실행 시작 결과 (run_id 포함)
 */
export function runPipeline(data) {
  return agentApi.post(DATA_ADMIN_ENDPOINTS.PIPELINE_RUN, data);
}

/**
 * 현재 실행 중인 파이프라인 상태 조회.
 * @returns {Promise<Object>} { status, progress, current_step, ... }
 */
export function fetchPipelineStatus() {
  return agentApi.get(DATA_ADMIN_ENDPOINTS.PIPELINE_STATUS);
}

/**
 * 실행 중인 파이프라인 취소.
 * @returns {Promise<Object>} 취소 결과
 */
export function cancelPipeline() {
  return agentApi.post(DATA_ADMIN_ENDPOINTS.PIPELINE_CANCEL);
}

/**
 * 파이프라인 실행 이력 조회 (페이징).
 * @param {Object} params - { page, size }
 * @returns {Promise<Object>} 이력 목록
 */
export function fetchPipelineHistory(params) {
  return agentApi.get(DATA_ADMIN_ENDPOINTS.PIPELINE_HISTORY, { params });
}

/**
 * 파이프라인 체크포인트 조회 (중단 재개용).
 * @returns {Promise<Object>} 마지막 체크포인트 정보
 */
export function fetchPipelineCheckpoint() {
  return agentApi.get(DATA_ADMIN_ENDPOINTS.PIPELINE_CHECKPOINT);
}

/**
 * 실패한 파이프라인 작업 재시도.
 * @returns {Promise<Object>} 재시도 결과
 */
export function retryFailedPipeline() {
  return agentApi.post(DATA_ADMIN_ENDPOINTS.PIPELINE_RETRY);
}

/**
 * 파이프라인 SSE 로그 스트림 URL 반환.
 * EventSource로 직접 구독해야 하므로 URL 문자열만 반환.
 * @returns {string} SSE 엔드포인트 URL
 */
export function getPipelineLogUrl() {
  return DATA_ADMIN_ENDPOINTS.PIPELINE_LOG;
}
