/**
 * 데이터 관리 탭 API 호출 함수.
 * 모든 엔드포인트는 DATA_ADMIN_ENDPOINTS 상수를 사용.
 * 영화 CRUD 및 파이프라인 트리거는 agentApi (FastAPI Agent :8000) 사용.
 *
 * @service Agent - FastAPI AI Agent (:8000)
 */

import { agentApi } from '@/shared/api/axiosInstance';
import { DATA_ADMIN_ENDPOINTS } from '@/shared/constants/api';

/* ── 데이터 현황 ──
 *
 * 2026-04-14: Agent admin_data.py 의 실제 구현 경로와 일치시킴.
 * 과거 이름(fetchDataStats/fetchDataHealth)은 alias 로 유지 — 기존 호출부는 자연스럽게 작동.
 */

/**
 * 5DB(MySQL/Qdrant/Neo4j/ES/Redis) 전체 건수 카드.
 * GET /admin/data/overview
 * @returns {Promise<Object>} { mysql, qdrant, neo4j, elasticsearch, redis, checkedAt }
 */
export function fetchDataOverview() {
  return agentApi.get(DATA_ADMIN_ENDPOINTS.OVERVIEW);
}

/**
 * 소스별(TMDB/KOBIS/KMDb 등) 영화 분포.
 * GET /admin/data/distribution
 * @returns {Promise<Object>} { distribution: [{source, count, percentage}], total }
 */
export function fetchDataDistribution() {
  return agentApi.get(DATA_ADMIN_ENDPOINTS.DISTRIBUTION);
}

/**
 * 데이터 품질 지표 (NULL 비율/중복/평균 평점).
 * GET /admin/data/quality
 * @returns {Promise<Object>} { totalMovies, nullRates, duplicateTitles, averageRating, ... }
 */
export function fetchDataQuality() {
  return agentApi.get(DATA_ADMIN_ENDPOINTS.QUALITY);
}

/* 레거시 별칭 — 기존 import 호환용 */
export const fetchDataStats = fetchDataOverview;
export const fetchDataHealth = fetchDataDistribution;

/* ── 영화 데이터 CRUD ──
 *
 * 2026-04-08: 기존 Backend(Spring Boot) AdminMovieController 경로를 단일 진실 원본 원칙에 따라
 * Agent(FastAPI admin_data.py) 로 일원화했다. 관리자 페이지에서 호출하는 모든 영화 CRUD 는
 * 이 파일(dataApi.js)을 사용하며, 별도의 backendApi 기반 movieApi.js 는 삭제되었다.
 */

/**
 * 영화 목록 조회 (검색/필터/페이징).
 * @param {Object} params - 검색 파라미터 { keyword, page, size, source, sort }
 * @returns {Promise<Object>} { content, totalElements, totalPages, ... }
 */
export function fetchMovies(params) {
  return agentApi.get(DATA_ADMIN_ENDPOINTS.MOVIES, { params });
}

/**
 * 영화 상세 조회 (5DB 통합).
 * @param {string} id - 영화 ID
 * @returns {Promise<Object>} 영화 상세 데이터
 */
export function fetchMovieDetail(id) {
  return agentApi.get(DATA_ADMIN_ENDPOINTS.MOVIE_DETAIL(id));
}

/**
 * 영화 신규 등록 (Agent MySQL INSERT).
 *
 * 주의: 검색 인덱스(Qdrant/Neo4j/ES)는 다음 파이프라인 실행 시 자동 반영된다.
 *       즉시 반영이 필요하면 등록 후 `/pipeline/run` 을 수동으로 트리거해야 한다.
 *
 * @param {Object} data - 영화 등록 필드 (movieId/title 필수, 그 외 선택)
 * @returns {Promise<Object>} 등록 결과 { success, movieId, message, needsReindex }
 */
export function createMovie(data) {
  return agentApi.post(DATA_ADMIN_ENDPOINTS.MOVIES, data);
}

/**
 * 영화 정보 수정 (4DB 동기 반영 베스트-에포트).
 * @param {string} id - 영화 ID
 * @param {Object} data - 수정할 필드
 * @returns {Promise<Object>} 수정된 영화 데이터
 */
export function updateMovie(id, data) {
  return agentApi.put(DATA_ADMIN_ENDPOINTS.MOVIE_DETAIL(id), data);
}

/**
 * 영화 삭제 (4DB 동기 삭제 베스트-에포트).
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
 *
 * 2026-04-15: Agent 는 다중 job 모델이라 `job_id` 가 필수다(없으면 422). 마지막 실행 시점에
 * 받아둔 jobId 를 그대로 전달한다.
 *
 * @param {string} jobId - 취소할 작업 ID (runPipeline 응답의 job_id)
 * @returns {Promise<Object>} 취소 결과
 */
export function cancelPipeline(jobId) {
  return agentApi.post(DATA_ADMIN_ENDPOINTS.PIPELINE_CANCEL, { job_id: jobId });
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
 *
 * 2026-04-15: Agent (`/admin/pipeline/logs`) 는 `job_id` 쿼리 파라미터를 필수로 요구한다.
 * jobId 없이 호출하면 422 가 떨어지므로 runPipeline 응답에서 받은 job_id 를 반드시 전달한다.
 *
 * @param {string} jobId - 작업 ID (runPipeline 응답의 job_id)
 * @returns {string} SSE 엔드포인트 URL (쿼리 포함)
 */
export function getPipelineLogUrl(jobId) {
  const base = DATA_ADMIN_ENDPOINTS.PIPELINE_LOG;
  return jobId ? `${base}?job_id=${encodeURIComponent(jobId)}` : base;
}
