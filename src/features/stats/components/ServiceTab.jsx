/**
 * 서비스 통계 탭 컴포넌트.
 *
 * 구성:
 * 1. 기간 선택 버튼 그룹 (7d / 30d / 90d)
 * 2. KPI 카드 6개 (DAU, MAU, 신규 가입, 총 리뷰, 평균 평점, 총 게시글)
 * 3. 추이 차트 (Recharts LineChart: DAU + 신규 가입 + 리뷰)
 *
 * 데이터 패칭:
 * - 기간 변경 시 fetchOverview + fetchTrends 를 Promise.allSettled로 병렬 호출
 * - 각 섹션 독립적으로 에러 처리
 *
 * @param {Object} props - 없음 (내부 상태 관리)
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  MdPeople,
  MdCalendarToday,
  MdPersonAdd,
  MdRateReview,
  MdStar,
  MdArticle,
} from 'react-icons/md';
import StatsCard from '@/shared/components/StatsCard';
import { fetchOverview, fetchTrends } from '../api/statsApi';

/** 기간 선택 옵션 */
const PERIOD_OPTIONS = [
  { value: '7d',  label: '7일' },
  { value: '30d', label: '30일' },
  { value: '90d', label: '90일' },
];

/** 기간 문자열 → 일 수 매핑 */
const PERIOD_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

/**
 * 숫자 포맷 유틸 — null/undefined 안전 처리.
 * 12345 → "12,345"
 *
 * @param {number|null|undefined} val
 * @returns {string}
 */
function fmt(val) {
  if (val === null || val === undefined) return '-';
  return Number(val).toLocaleString();
}

/**
 * 소수점 1자리 포맷.
 * 4.523 → "4.5"
 *
 * @param {number|null|undefined} val
 * @returns {string}
 */
function fmtFloat(val) {
  if (val === null || val === undefined) return '-';
  return Number(val).toFixed(1);
}

/**
 * 커스텀 Tooltip 렌더러.
 * Recharts Tooltip의 content prop으로 사용.
 */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <TooltipBox>
      <TooltipDate>{label}</TooltipDate>
      {payload.map((entry) => (
        <TooltipRow key={entry.dataKey}>
          <TooltipDot style={{ background: entry.color }} />
          <TooltipLabel>{entry.name}</TooltipLabel>
          <TooltipValue>{Number(entry.value).toLocaleString()}</TooltipValue>
        </TooltipRow>
      ))}
    </TooltipBox>
  );
}

export default function ServiceTab() {
  /** 현재 선택된 기간 */
  const [period, setPeriod] = useState('7d');

  /** KPI 개요 데이터 */
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(null);

  /** 추이 차트 데이터 */
  const [trends, setTrends] = useState([]);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [trendsError, setTrendsError] = useState(null);

  /**
   * 기간을 기준으로 개요 + 추이 데이터를 병렬 호출.
   * Promise.allSettled 사용 — 한 API 실패 시 다른 섹션은 정상 표시.
   *
   * @param {string} p - 기간 (7d | 30d | 90d)
   */
  const loadData = useCallback(async (p) => {
    /* 각 섹션 로딩 초기화 */
    setOverviewLoading(true);
    setTrendsLoading(true);
    setOverviewError(null);
    setTrendsError(null);

    const [overviewResult, trendsResult] = await Promise.allSettled([
      fetchOverview({ period: p }),
      fetchTrends({ period: p }),
    ]);

    /* 개요 처리 */
    if (overviewResult.status === 'fulfilled') {
      setOverview(overviewResult.value);
    } else {
      setOverviewError(overviewResult.reason?.message ?? 'KPI 데이터를 불러올 수 없습니다.');
    }
    setOverviewLoading(false);

    /* 추이 처리 */
    if (trendsResult.status === 'fulfilled') {
      setTrends(Array.isArray(trendsResult.value) ? trendsResult.value : []);
    } else {
      setTrendsError(trendsResult.reason?.message ?? '추이 데이터를 불러올 수 없습니다.');
    }
    setTrendsLoading(false);
  }, []);

  /* 최초 마운트 + 기간 변경 시 데이터 로드 */
  useEffect(() => {
    loadData(period);
  }, [period, loadData]);

  /**
   * 기간 선택 변경 핸들러.
   *
   * @param {string} p - 새 기간 값
   */
  function handlePeriodChange(p) {
    setPeriod(p);
  }

  /* 개요 데이터 안전 접근 */
  const d = overview ?? {};
  const periodDays = PERIOD_DAYS[period] ?? 7;

  /** KPI 카드 정의 배열 */
  const kpiCards = [
    {
      key: 'dau',
      icon: <MdPeople size={18} />,
      title: 'DAU',
      value: overviewLoading ? '...' : fmt(d.dau),
      subtitle: `최근 ${periodDays}일 최대 일간 활성 사용자`,
      status: 'info',
    },
    {
      key: 'mau',
      icon: <MdCalendarToday size={18} />,
      title: 'MAU',
      value: overviewLoading ? '...' : fmt(d.mau),
      subtitle: `최근 ${periodDays}일 내 활성 사용자`,
      status: 'info',
    },
    {
      key: 'newUsers',
      icon: <MdPersonAdd size={18} />,
      title: '신규 가입',
      value: overviewLoading ? '...' : fmt(d.newUsers),
      subtitle: `최근 ${periodDays}일 내 신규 가입자`,
      status: 'success',
    },
    {
      key: 'totalReviews',
      icon: <MdRateReview size={18} />,
      title: '총 리뷰',
      value: overviewLoading ? '...' : fmt(d.totalReviews),
      subtitle: '누적 리뷰 수',
      status: 'info',
    },
    {
      key: 'avgRating',
      icon: <MdStar size={18} />,
      title: '평균 평점',
      value: overviewLoading ? '...' : fmtFloat(d.avgRating),
      subtitle: '전체 리뷰 평균',
      status: 'success',
    },
    {
      key: 'totalPosts',
      icon: <MdArticle size={18} />,
      title: '총 게시글',
      value: overviewLoading ? '...' : fmt(d.totalPosts),
      subtitle: '커뮤니티 누적 게시글',
      status: 'info',
    },
  ];

  return (
    <Wrapper>
      {/* ── 기간 선택 버튼 그룹 ── */}
      <FilterRow>
        <FilterLabel>집계 기간</FilterLabel>
        <PeriodGroup>
          {PERIOD_OPTIONS.map((opt) => (
            <PeriodButton
              key={opt.value}
              $active={period === opt.value}
              onClick={() => handlePeriodChange(opt.value)}
            >
              {opt.label}
            </PeriodButton>
          ))}
        </PeriodGroup>
      </FilterRow>

      {/* ── KPI 카드 섹션 ── */}
      <SectionLabel>핵심 지표</SectionLabel>
      {overviewError && <ErrorMsg>{overviewError}</ErrorMsg>}
      <KpiGrid>
        {kpiCards.map((card) => (
          <StatsCard
            key={card.key}
            icon={card.icon}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            status={card.status}
          />
        ))}
      </KpiGrid>

      {/* ── 추이 차트 섹션 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>추이 분석</SectionLabel>
      {trendsError && <ErrorMsg>{trendsError}</ErrorMsg>}
      <ChartCard>
        <ChartTitle>DAU / 신규 가입 / 리뷰 추이</ChartTitle>
        <ChartBody>
          {trendsLoading ? (
            /* 로딩 중 플레이스홀더 */
            <LoadingMsg>차트 데이터를 불러오는 중...</LoadingMsg>
          ) : trends.length === 0 ? (
            /* 데이터 없음 */
            <LoadingMsg>표시할 데이터가 없습니다.</LoadingMsg>
          ) : (
            /*
             * ResponsiveContainer: 부모 너비에 맞춰 자동 리사이즈.
             * LineChart: DAU(초록), 신규 가입(보라), 리뷰(주황) 3개 라인.
             */
            <ResponsiveContainer width="100%" height={350}>
              <LineChart
                data={trends}
                margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
              >
                {/* 격자선 */}
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

                {/* X축: 날짜 레이블 */}
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />

                {/* Y축: 수치 */}
                <YAxis
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => Number(v).toLocaleString()}
                />

                {/* 커스텀 Tooltip */}
                <Tooltip content={<CustomTooltip />} />

                {/* 범례 */}
                <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '12px' }} />

                {/* DAU 라인 */}
                <Line
                  type="monotone"
                  dataKey="dau"
                  name="DAU"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981' }}
                  activeDot={{ r: 5 }}
                />

                {/* 신규 가입 라인 */}
                <Line
                  type="monotone"
                  dataKey="newUsers"
                  name="신규 가입"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#6366f1' }}
                  activeDot={{ r: 5 }}
                />

                {/* 리뷰 라인 */}
                <Line
                  type="monotone"
                  dataKey="reviews"
                  name="리뷰"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#f59e0b' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartBody>
      </ChartCard>
    </Wrapper>
  );
}

/* ── styled-components ── */

const Wrapper = styled.div``;

/** 기간 선택 행 */
const FilterRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
`;

const FilterLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

/**
 * 기간 선택 버튼 그룹.
 * 세그먼트 컨트롤 형태 — TrendChart.jsx와 동일한 패턴.
 */
const PeriodGroup = styled.div`
  display: flex;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  overflow: hidden;
`;

const PeriodButton = styled.button`
  padding: 5px ${({ theme }) => theme.spacing.lg};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ $active, theme }) =>
    $active ? '#ffffff' : theme.colors.textSecondary};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primary : 'transparent'};
  transition: all ${({ theme }) => theme.transitions.fast};
  white-space: nowrap;

  /* 버튼 사이 구분선 */
  & + & {
    border-left: 1px solid ${({ theme }) => theme.colors.border};
  }

  &:hover {
    background: ${({ $active, theme }) =>
      $active ? theme.colors.primaryHover : theme.colors.bgHover};
  }
`;

/**
 * 섹션 레이블.
 * 작은 회색 대문자 텍스트로 섹션 구분 — DashboardPage와 동일 패턴.
 */
const SectionLabel = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

/**
 * KPI 카드 그리드.
 * minmax(220px, 1fr)로 반응형 열 수 자동 조정.
 */
const KpiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
`;

/** 에러 메시지 박스 */
const ErrorMsg = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.error};
  background: ${({ theme }) => theme.colors.errorBg};
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

/**
 * 차트 카드 래퍼.
 * bgCard 배경 + 테두리 + 그림자 + 패딩.
 */
const ChartCard = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.xl};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const ChartTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.heading};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const ChartBody = styled.div`
  min-height: 350px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LoadingMsg = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
`;

/* ── 커스텀 Tooltip 스타일 ── */

const TooltipBox = styled.div`
  background: #ffffff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  min-width: 160px;
`;

const TooltipDate = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const TooltipRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

const TooltipDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
`;

const TooltipLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  flex: 1;
`;

const TooltipValue = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
`;
