/**
 * 통계/분석 관리자 API 모듈.
 *
 * 정한나 담당 탭(통계/분석)에서 사용하는 모든 API 호출을 정의합니다.
 * 엔드포인트 기본 경로: /api/v1/admin/stats
 *
 * 서비스 개요:
 * - 서비스 통계 : DAU/MAU, 신규 가입, 리뷰, 게시글 추이
 * - 추천 분석   : CTR, 만족도, 장르 분포, 추천 로그
 * - 검색 분석   : 인기 검색어, 검색 품질 지표
 * - 사용자 행동 : 장르 선호, 시간대별 활동, 코호트 리텐션
 * - 매출        : 월매출, MRR, ARPU, 구독 현황
 */

import { backendApi } from '@/shared/api/axiosInstance';

/** 통계 API 기본 경로 */
const STATS = '/api/v1/admin/stats';

/**
 * 서비스 개요 KPI 조회.
 * DAU, MAU, 신규 가입, 총 리뷰, 평균 평점, 총 게시글 수를 반환.
 *
 * @param {Object} params
 * @param {string} [params.period] - 집계 기간 (7d | 30d | 90d)
 * @returns {Promise<Object>} { dau, mau, newUsers, totalReviews, avgRating, totalPosts }
 */
export function fetchOverview(params) {
  return backendApi.get(`${STATS}/overview`, { params });
}

/**
 * 서비스 추이 데이터 조회.
 * 날짜별 DAU, 신규 가입 수, 리뷰 수 시계열 데이터를 반환.
 *
 * @param {Object} params
 * @param {string} [params.period] - 집계 기간 (7d | 30d | 90d)
 * @returns {Promise<Array>} [{ date, dau, newUsers, reviews }]
 */
export function fetchTrends(params) {
  return backendApi.get(`${STATS}/trends`, { params });
}

/**
 * 추천 성과 지표 조회.
 * 클릭률(CTR), 사용자 만족도, 총 추천 수를 반환.
 *
 * @param {Object} params
 * @param {string} [params.period] - 집계 기간 (7d | 30d | 90d)
 * @returns {Promise<Object>} { ctr, satisfaction, totalRecommendations }
 */
export function fetchRecommendation(params) {
  return backendApi.get(`${STATS}/recommendation`, { params });
}

/**
 * 추천 장르 분포 조회.
 * 장르별 추천 비율 (PieChart/BarChart용).
 *
 * @returns {Promise<Array>} [{ genre, count, ratio }]
 */
export function fetchRecommendationDistribution() {
  return backendApi.get(`${STATS}/recommendation/distribution`);
}

/**
 * 추천 로그 목록 조회 (페이징).
 * userId, movieId, 추천 점수, 피드백, 발생 시간 포함.
 *
 * @param {Object} params
 * @param {number} [params.page=0]  - 페이지 번호 (0-based)
 * @param {number} [params.size=20] - 페이지 크기
 * @param {string} [params.period]  - 집계 기간 (7d | 30d)
 * @returns {Promise<Object>} { content: [...], totalElements, totalPages }
 */
export function fetchRecommendationLogs(params) {
  return backendApi.get(`${STATS}/recommendation/logs`, { params });
}

/**
 * 인기 검색어 목록 조회.
 * trending_keywords 누적 검색 수 기반 TOP N.
 *
 * @param {Object} params
 * @param {number} [params.limit=20] - 상위 N개
 * @returns {Promise<Array>} [{ keyword, searchCount, id, displayRank, manualPriority, isExcluded, adminNote }]
 */
export async function fetchPopularKeywords(params) {
  const data = await backendApi.get(`${STATS}/search/popular`, { params });
  return Array.isArray(data?.keywords) ? data.keywords : [];
}

/**
 * 기간별 검색 이력 키워드 통계 조회.
 *
 * @param {Object} params
 * @param {string} [params.period] - 집계 기간 (1d | 7d | 30d)
 * @param {number} [params.limit=20] - 상위 N개
 * @returns {Promise<Array>} [{ keyword, searchCount, resultCount, conversionRate }]
 */
export async function fetchSearchHistoryKeywords(params) {
  const data = await backendApi.get(`${STATS}/search/history`, { params });
  return Array.isArray(data?.keywords) ? data.keywords : [];
}

/**
 * 특정 키워드의 클릭 영화 상세 통계 조회.
 *
 * @param {Object} params
 * @param {string} params.keyword - 기준 키워드
 * @param {string} [params.period] - 집계 기간 (1d | 7d | 30d)
 * @param {number} [params.limit=20] - 상위 N개
 * @returns {Promise<Object>} { keyword, totalClicks, movies }
 */
export function fetchSearchKeywordClicks(params) {
  return backendApi.get(`${STATS}/search/history/clicks`, { params });
}

/**
 * 검색 품질 지표 조회.
 * 검색 성공률, 총 검색 수, 0건 결과 검색 수.
 *
 * @param {Object} params
 * @param {string} [params.period] - 집계 기간 (1d | 7d | 30d)
 * @returns {Promise<Object>} { successRate, totalSearches, zeroResultSearches }
 */
export function fetchSearchQuality(params) {
  return backendApi.get(`${STATS}/search/quality`, { params });
}

/**
 * 사용자 행동 분석 조회.
 * 장르별 시청/리뷰 수, 시간대별(0~23시) 활동량.
 *
 * @param {Object} params
 * @param {string} [params.period] - 집계 기간 (7d | 30d | 90d)
 * @returns {Promise<Object>} {
 *   genreStats: [{ genre, watchCount, reviewCount }],
 *   hourlyActivity: [{ hour, activityCount }]
 * }
 */
export function fetchBehavior(params) {
  return backendApi.get(`${STATS}/behavior`, { params });
}

/**
 * 코호트 리텐션 데이터 조회.
 * 코호트(가입 주차) × 유지 주차별 리텐션율.
 *
 * @param {Object} params
 * @param {number} [params.weeks=8] - 분석할 코호트 주차 수
 * @returns {Promise<Array>} [{ cohort, week0, week1, ..., weekN }]
 */
export function fetchRetention(params) {
  return backendApi.get(`${STATS}/retention`, { params });
}

/**
 * 매출 분석 데이터 조회 (확장 — 2026-04-28).
 *
 * Backend RevenueResponse 모든 필드를 한 번에 반환.
 * 기간(period) 은 dailyRevenue/시간대/요일/Top payer/결제수단/플랜분포의 윈도우 크기를 결정.
 * monthlyRevenue/MRR/오늘/어제/이번주/12개월 추이는 기간 무관 항상 계산.
 *
 * @param {Object} params
 * @param {string} [params.period] - 집계 기간 (7d | 30d | 90d)
 * @returns {Promise<Object>} {
 *   monthlyRevenue, mrr, arpu, avgOrderValue, totalRevenue,
 *   todayRevenue, yesterdayRevenue, weekRevenue,
 *   totalOrders, todayOrders, payingUsers,
 *   refundAmount, refundCount, refundRate, netRevenue,
 *   dailyRevenue: [{ date, amount, count }],
 *   monthlyRevenueTrend: [{ month, amount, count }],
 *   paymentMethodDistribution: [{ provider, label, amount, count, ratio }],
 *   planRevenueDistribution: [{ planCode, planName, amount, count, ratio }],
 *   orderTypeDistribution: [{ type, label, amount, count, ratio }],
 *   hourlyDistribution: [{ hour, amount, count }],
 *   weekdayDistribution: [{ weekday, weekdayName, amount, count }],
 *   topPayers: [{ userId, nickname, totalAmount, orderCount }]
 * }
 */
export function fetchRevenue(params) {
  return backendApi.get(`${STATS}/revenue`, { params });
}

/**
 * 구독 현황 조회 (확장 — 2026-04-28).
 *
 * Frontend 호환 키로 정렬: activeSubscriptions / planDistribution / churnRate(0~1).
 *
 * @returns {Promise<Object>} {
 *   activeSubscriptions, totalSubscriptions,
 *   newThisMonth, cancelledThisMonth, expiredThisMonth,
 *   churnRate,                            // 0.0 ~ 1.0 비율
 *   subscriptionMrr, avgRevenuePerSubscriber,
 *   planDistribution: [{ planCode, plan, count, ratio }],
 *   planMrr: [{ planCode, plan, mrr, count, ratio }]
 * }
 */
export function fetchSubscription() {
  return backendApi.get(`${STATS}/subscription`);
}

// ══════════════════════════════════════════════
// 포인트 경제 분석
// ══════════════════════════════════════════════

/** 포인트 경제 개요 KPI (총발행/소비/잔액/활성사용자/오늘) */
export function fetchPointEconomyOverview() {
  return backendApi.get(`${STATS}/point-economy/overview`);
}

/** 포인트 유형별 분포 (earn/spend/bonus/expire/refund/revoke) */
export function fetchPointTypeDistribution() {
  return backendApi.get(`${STATS}/point-economy/distribution`);
}

/** 등급별 사용자 분포 (6등급) */
export function fetchGradeDistribution() {
  return backendApi.get(`${STATS}/point-economy/grades`);
}

/** 일별 포인트 발행/소비 추이 */
export function fetchPointTrends(params) {
  return backendApi.get(`${STATS}/point-economy/trends`, { params });
}

// ══════════════════════════════════════════════
// AI 서비스 분석
// ══════════════════════════════════════════════

/** AI 서비스 개요 KPI (세션/턴/평균/오늘) */
export function fetchAiServiceOverview() {
  return backendApi.get(`${STATS}/ai-service/overview`);
}

/** AI 세션 일별 추이 */
export function fetchAiSessionTrends(params) {
  return backendApi.get(`${STATS}/ai-service/trends`, { params });
}

/** AI 의도(Intent) 분포 */
export function fetchAiIntentDistribution() {
  return backendApi.get(`${STATS}/ai-service/intents`);
}

/** AI 쿼터 소진 현황 */
export function fetchAiQuotaStats() {
  return backendApi.get(`${STATS}/ai-service/quota`);
}

// ══════════════════════════════════════════════
// 커뮤니티 분석
// ══════════════════════════════════════════════

/** 커뮤니티 개요 KPI (게시글/댓글/신고/오늘) */
export function fetchCommunityOverview() {
  return backendApi.get(`${STATS}/community/overview`);
}

/** 커뮤니티 일별 추이 */
export function fetchCommunityTrends(params) {
  return backendApi.get(`${STATS}/community/trends`, { params });
}

/** 게시글 카테고리별 분포 */
export function fetchPostCategoryDistribution() {
  return backendApi.get(`${STATS}/community/categories`);
}

/** 신고/독성 분석 */
export function fetchReportAnalysis() {
  return backendApi.get(`${STATS}/community/reports`);
}

// ══════════════════════════════════════════════
// 사용자 참여도 분석
// ══════════════════════════════════════════════

/** 사용자 참여도 개요 KPI (출석/활동/위시리스트) */
export function fetchEngagementOverview() {
  return backendApi.get(`${STATS}/engagement/overview`);
}

/** 활동별 참여 현황 분포 */
export function fetchActivityDistribution() {
  return backendApi.get(`${STATS}/engagement/activity-distribution`);
}

/** 출석 연속일 구간 분포 */
export function fetchAttendanceStreak() {
  return backendApi.get(`${STATS}/engagement/attendance-streak`);
}

// ══════════════════════════════════════════════
// 콘텐츠 성과 분석
// ══════════════════════════════════════════════

/** 콘텐츠 성과 개요 KPI (코스/업적/퀴즈) */
export function fetchContentPerformanceOverview() {
  return backendApi.get(`${STATS}/content-performance/overview`);
}

/** 코스별 완주율 */
export function fetchCourseCompletion() {
  return backendApi.get(`${STATS}/content-performance/course-completion`);
}

/**
 * 리뷰 품질 지표 (카테고리별/평점 분포).
 *
 * v3.6 (2026-04-28): "학습·도전 활동" 탭에서 리뷰 품질 섹션이 제거되어 호출처가 없다.
 * 향후 "커뮤니티" 탭으로 이관 예정 — 백엔드 엔드포인트 자체는 유지되어 있어 그대로 재사용 가능.
 */
export function fetchReviewQuality() {
  return backendApi.get(`${STATS}/content-performance/review-quality`);
}

// ══════════════════════════════════════════════
// 사용자 단계별 진행 분석 (구 "전환 퍼널")
// ══════════════════════════════════════════════

/** 5단계 사용자 진행 (가입→첫활동→AI→리뷰→결제). v3.6 에서 6→5단계로 단순화. */
export function fetchConversionFunnel(params) {
  return backendApi.get(`${STATS}/funnel/conversion`, { params });
}

// ══════════════════════════════════════════════
// 이탈 위험 분석
// ══════════════════════════════════════════════

/** 이탈 위험 개요 (위험 등급별 사용자 분포) */
export function fetchChurnRiskOverview() {
  return backendApi.get(`${STATS}/churn-risk/overview`);
}

/** 이탈 위험 신호 집계 (미로그인/포인트0/구독만료 등) */
export function fetchChurnRiskSignals() {
  return backendApi.get(`${STATS}/churn-risk/signals`);
}
