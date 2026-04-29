/**
 * AI 퀴즈 운영 통계 카드 컴포넌트 (2026-04-28 신규).
 *
 * <p>quiz_generation 에이전트가 자동 생성한 퀴즈의 운영 KPI 를 한 화면에 표시한다.
 * GenerationHistory 상단에 마운트되어 이력 테이블 위에서 요약 지표를 제공한다.</p>
 *
 * <h3>표시 영역</h3>
 * <ul>
 *   <li>상단 KPI 4 박스: 오늘 / 7일 / 30일 누적 + 검수 통과율</li>
 *   <li>중단 상태 분포: PENDING / APPROVED / REJECTED / PUBLISHED 4 카드</li>
 *   <li>하단 14일 trend: 일자별 막대 차트 (sparkline 형식, max 자동 스케일)</li>
 * </ul>
 *
 * <h3>데이터 흐름</h3>
 * <p>GET /api/v1/admin/ai/quiz/stats 1회 호출 → 응답을 그대로 렌더. 새로고침 버튼은
 * 부모(GenerationHistory) 의 새로고침과 별도로 동작하지 않고, 부모 새로고침 시
 * key 변경으로 자동 재마운트되도록 한다 (refreshKey prop).</p>
 *
 * <h3>로딩/에러 처리</h3>
 * <p>로딩 중: skeleton placeholder (회색 박스).
 * 에러 시: 한 줄 안내 메시지 + 0 값 fallback (관리자 화면이 깨지지 않도록).</p>
 *
 * @param {Object} props
 * @param {number|string} [props.refreshKey] 부모가 새로고침할 때 변경시켜 강제 리페치 트리거
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { fetchQuizStats } from '../api/aiApi';

/* ── 상수 ───────────────────────────────────────── */

/**
 * KPI 카드 색상 매트릭스 — ReviewVerificationTab 의 KPI_COLORS 와 시각 일관성 유지.
 * default(중성)/success(긍정)/warning(주의)/error(부정)/info(정보) 5 변형.
 */
const KPI_COLORS = {
  default: { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
  success: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
  warning: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  error:   { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  info:    { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
};

/** 안전 fallback 값 — 응답 결손 / 로딩 / 에러 시에도 화면 레이아웃이 유지되게 한다. */
const EMPTY_STATS = {
  totalToday: 0,
  total7d: 0,
  total30d: 0,
  byStatus: { PENDING: 0, APPROVED: 0, REJECTED: 0, PUBLISHED: 0 },
  approvalRate: 0,
  dailyTrend14d: [],
};

/* ── 컴포넌트 ───────────────────────────────────── */

export default function QuizStatsCard({ refreshKey }) {
  /** 통계 응답 (또는 EMPTY_STATS fallback) */
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* 마운트 + refreshKey 변경 시 재조회. 1회성 GET 이라 별도 cancel 토큰 없이 단순 fetch. */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchQuizStats()
      .then((res) => {
        if (cancelled) return;
        // backendApi response interceptor 가 ApiResponse.ok 의 data 만 까서 반환한다고 가정.
        // 만약 wrapping 이 그대로 오면 res?.data 도 흡수 (방어적 코딩).
        const payload = res?.byStatus ? res : (res?.data ?? EMPTY_STATS);
        setStats({ ...EMPTY_STATS, ...payload });
      })
      .catch((err) => {
        if (cancelled) return;
        // 화면이 깨지지 않도록 0 값 fallback + 에러 메시지만 노출
        setStats(EMPTY_STATS);
        setError(err?.message || '통계 조회 실패');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const byStatus = stats.byStatus || EMPTY_STATS.byStatus;
  const trend = stats.dailyTrend14d || [];
  /* 14일 trend 최대값 — 막대 높이 정규화 기준. 0 일 때 1 로 보정 (division-by-zero 회피). */
  const maxTrend = Math.max(1, ...trend.map((d) => d.count ?? 0));
  /* 검수 통과율 % 표시 — 모수 0 시 '—' 표기로 NaN 방지 */
  const approvedCount = byStatus.APPROVED ?? 0;
  const rejectedCount = byStatus.REJECTED ?? 0;
  const reviewedTotal = approvedCount + rejectedCount;
  const approvalRatePct = reviewedTotal === 0
    ? null
    : Math.round((stats.approvalRate ?? 0) * 1000) / 10;  // 소수 1자리

  return (
    <Wrapper>
      <Header>
        <Title>AI 퀴즈 운영 통계</Title>
        {error && <ErrorText>⚠ {error}</ErrorText>}
      </Header>

      {/* ── 상단 KPI 4 박스 ── */}
      <KpiGrid>
        <KpiCard $variant="info">
          <KpiLabel>오늘 신규</KpiLabel>
          <KpiValue>{loading ? '—' : stats.totalToday}</KpiValue>
          <KpiSub>건</KpiSub>
        </KpiCard>
        <KpiCard $variant="info">
          <KpiLabel>최근 7일</KpiLabel>
          <KpiValue>{loading ? '—' : stats.total7d}</KpiValue>
          <KpiSub>건</KpiSub>
        </KpiCard>
        <KpiCard $variant="info">
          <KpiLabel>최근 30일</KpiLabel>
          <KpiValue>{loading ? '—' : stats.total30d}</KpiValue>
          <KpiSub>건</KpiSub>
        </KpiCard>
        <KpiCard $variant={approvalRatePct === null ? 'default' : 'success'}>
          <KpiLabel>검수 통과율</KpiLabel>
          <KpiValue>
            {loading || approvalRatePct === null ? '—' : `${approvalRatePct}%`}
          </KpiValue>
          <KpiSub>
            {approvalRatePct === null
              ? '검수 미실시'
              : `${approvedCount}/${reviewedTotal}`}
          </KpiSub>
        </KpiCard>
      </KpiGrid>

      {/* ── 중단 상태 분포 ── */}
      <SubTitle>상태별 분포</SubTitle>
      <KpiGrid>
        <KpiCard $variant="default">
          <KpiLabel>대기 PENDING</KpiLabel>
          <KpiValue>{loading ? '—' : byStatus.PENDING}</KpiValue>
        </KpiCard>
        <KpiCard $variant="success">
          <KpiLabel>승인 APPROVED</KpiLabel>
          <KpiValue>{loading ? '—' : byStatus.APPROVED}</KpiValue>
        </KpiCard>
        <KpiCard $variant="error">
          <KpiLabel>반려 REJECTED</KpiLabel>
          <KpiValue>{loading ? '—' : byStatus.REJECTED}</KpiValue>
        </KpiCard>
        <KpiCard $variant="warning">
          <KpiLabel>출제 PUBLISHED</KpiLabel>
          <KpiValue>{loading ? '—' : byStatus.PUBLISHED}</KpiValue>
        </KpiCard>
      </KpiGrid>

      {/* ── 하단 14일 trend ── */}
      <SubTitle>최근 14일 생성 추이</SubTitle>
      <TrendChart>
        {trend.length === 0 ? (
          <TrendEmpty>{loading ? '불러오는 중…' : '데이터 없음'}</TrendEmpty>
        ) : (
          trend.map((d) => {
            /* 0건 막대도 최소 2px 으로 보여서 X축 끊김 방지 */
            const heightPct = ((d.count ?? 0) / maxTrend) * 100;
            const minHeight = 2;
            return (
              <TrendBarWrapper key={d.date} title={`${d.date} · ${d.count}건`}>
                <TrendBar
                  style={{ height: `max(${minHeight}px, ${heightPct}%)` }}
                  $hasValue={(d.count ?? 0) > 0}
                />
                <TrendLabel>{(d.date || '').slice(5)}</TrendLabel>
              </TrendBarWrapper>
            );
          })
        )}
      </TrendChart>
    </Wrapper>
  );
}

/* ── styled-components ────────────────────────────────────── */

const Wrapper = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  gap: ${({ theme }) => theme.spacing.md};
`;

const Title = styled.h4`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  margin: 0;
`;

const SubTitle = styled.h5`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textMuted};
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
`;

const ErrorText = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: #dc2626;
`;

/* KPI 그리드 — ReviewVerificationTab 와 동일 패턴 (140px 최소 폭, auto-fill) */
const KpiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const KpiCard = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ $variant }) => KPI_COLORS[$variant]?.bg ?? KPI_COLORS.default.bg};
  border: 1px solid ${({ $variant }) => KPI_COLORS[$variant]?.border ?? KPI_COLORS.default.border};
  color: ${({ $variant }) => KPI_COLORS[$variant]?.color ?? KPI_COLORS.default.color};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const KpiLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
`;

const KpiValue = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xl};
  font-weight: ${({ theme }) => theme.fontWeights.bold};
`;

const KpiSub = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  opacity: 0.7;
`;

/* 14일 trend 막대 차트 — 외부 라이브러리 없이 styled-components 만으로 구현 */
const TrendChart = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 90px;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-top: 1px dashed ${({ theme }) => theme.colors.border};
`;

const TrendBarWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  height: 100%;
  cursor: default;
`;

const TrendBar = styled.div`
  width: 100%;
  background: ${({ $hasValue, theme }) => ($hasValue ? theme.colors.primary : theme.colors.border)};
  border-radius: 2px 2px 0 0;
  transition: height 0.2s ease;
`;

const TrendLabel = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TrendEmpty = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;
