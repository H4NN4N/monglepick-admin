/**
 * 사용자 행동 분석 탭 컴포넌트.
 *
 * 구성:
 * 1. 기간 선택 버튼 그룹 (7d / 30d / 90d)
 * 2. 장르 선호 차트 (Recharts BarChart: 행동 프로필 장르 선호도 집계)
 * 3. 시간대별 활동 차트 (Recharts BarChart: 0~23시 활동량)
 * 4. 리텐션 전용 필터 (최근 코호트 수)
 * 5. 리텐션 테이블 (코호트 × 주차, 리텐션율 높을수록 진한 초록 셀 배경)
 *
 * 데이터 패칭:
 * - 행동 분석과 리텐션을 분리 호출
 * - 행동 기간 변경 시 장르/시간대만 재호출
 * - 리텐션 필터 변경 시 리텐션만 재호출
 *
 * @param {Object} props - 없음 (내부 상태 관리)
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fetchBehavior, fetchRetention } from '../api/statsApi';

/** 기간 선택 옵션 */
const PERIOD_OPTIONS = [
  { value: '7d',  label: '7일' },
  { value: '30d', label: '30일' },
  { value: '90d', label: '90일' },
];

const COHORT_OPTIONS = [
  { value: 4, label: '4개 코호트' },
  { value: 8, label: '8개 코호트' },
  { value: 12, label: '12개 코호트' },
];

/**
 * 리텐션율(0~1)을 셀 배경색으로 변환.
 * 1.0 → 진한 초록 (#16a34a), 0.0 → 흰색에 가까운 연한 초록 (#f0fdf4).
 * 중간값은 선형 보간.
 *
 * @param {number|null|undefined} rate - 리텐션율 (0~1)
 * @returns {string} CSS 색상 문자열
 */
function retentionCellBg(rate) {
  if (rate === null || rate === undefined) return 'transparent';
  const r = Math.min(Math.max(Number(rate), 0), 1);
  /* 초록 채도 채널: 0% → 240(연), 100% → 22(진) */
  const lightness = Math.round(97 - r * 75);
  return `hsl(142, 76%, ${lightness}%)`;
}

/**
 * 리텐션율 텍스트 색상.
 * 리텐션율이 높으면 진한 초록 텍스트, 낮으면 기본 텍스트.
 *
 * @param {number|null|undefined} rate
 * @returns {string}
 */
function retentionCellColor(rate) {
  if (rate === null || rate === undefined) return 'inherit';
  return Number(rate) >= 0.5 ? '#14532d' : '#374151';
}

/**
 * 퍼센트 포맷. 0.7234 → "72.3%"
 *
 * @param {number|null|undefined} val
 * @returns {string}
 */
function fmtPct(val) {
  if (val === null || val === undefined) return '-';
  return `${(Number(val) * 100).toFixed(1)}%`;
}

/**
 * 숫자 천 단위 포맷.
 *
 * @param {number|null|undefined} val
 * @returns {string}
 */
function fmt(val) {
  if (val === null || val === undefined) return '-';
  return Number(val).toLocaleString();
}

/**
 * 커스텀 Tooltip 렌더러 (장르 선호 차트용).
 */
function GenreTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const percentage = payload[0]?.payload?.percentage;

  return (
    <TooltipBox>
      <TooltipDate>{label}</TooltipDate>
      {payload.map((entry) => (
        <TooltipRow key={entry.dataKey}>
          <TooltipDot style={{ background: entry.color }} />
          <TooltipLabel>{entry.name}</TooltipLabel>
          <TooltipValue>{fmt(entry.value)}</TooltipValue>
        </TooltipRow>
      ))}
      {percentage !== null && percentage !== undefined && (
        <TooltipRow>
          <TooltipDot style={{ background: '#94a3b8' }} />
          <TooltipLabel>전체 비중</TooltipLabel>
          <TooltipValue>{Number(percentage).toFixed(1)}%</TooltipValue>
        </TooltipRow>
      )}
    </TooltipBox>
  );
}

/**
 * 커스텀 Tooltip 렌더러 (시간대 차트용).
 */
function HourlyTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <TooltipBox>
      <TooltipDate>{label}시</TooltipDate>
      {payload.map((entry) => (
        <TooltipRow key={entry.dataKey}>
          <TooltipDot style={{ background: entry.color }} />
          <TooltipLabel>{entry.name}</TooltipLabel>
          <TooltipValue>{fmt(entry.value)}</TooltipValue>
        </TooltipRow>
      ))}
    </TooltipBox>
  );
}

export default function BehaviorTab() {
  /** 현재 선택된 기간 */
  const [period, setPeriod] = useState('30d');
  const [cohortWeeks, setCohortWeeks] = useState(8);

  /** 행동 분석 데이터 상태 */
  const [behavior, setBehavior] = useState(null);
  const [behaviorLoading, setBehaviorLoading] = useState(true);
  const [behaviorError, setBehaviorError] = useState(null);

  /** 리텐션 데이터 상태 */
  const [retention, setRetention] = useState([]);
  const [retentionLoading, setRetentionLoading] = useState(true);
  const [retentionError, setRetentionError] = useState(null);

  /**
   * 행동 분석 호출.
   *
   * @param {string} p - 기간 (7d | 30d | 90d)
   */
  const loadBehaviorData = useCallback(async (p) => {
    setBehaviorLoading(true);
    setBehaviorError(null);

    const behaviorResult = await fetchBehavior({ period: p })
      .then((value) => ({ status: 'fulfilled', value }))
      .catch((reason) => ({ status: 'rejected', reason }));

    /* 행동 분석 처리 */
    if (behaviorResult.status === 'fulfilled') {
      setBehavior(behaviorResult.value);
    } else {
      setBehaviorError(
        behaviorResult.reason?.message ?? '행동 분석 데이터를 불러올 수 없습니다.',
      );
    }
    setBehaviorLoading(false);
  }, []);

  /**
   * 리텐션 호출.
   *
   * @param {number} cw - 최근 코호트 수
   */
  const loadRetentionData = useCallback(async (cw) => {
    setRetentionLoading(true);
    setRetentionError(null);

    const retentionResult = await fetchRetention({
      cohortWeeks: cw,
    })
      .then((value) => ({ status: 'fulfilled', value }))
      .catch((reason) => ({ status: 'rejected', reason }));

    if (retentionResult.status === 'fulfilled') {
      setRetention(
        Array.isArray(retentionResult.value) ? retentionResult.value : [],
      );
    } else {
      setRetentionError(
        retentionResult.reason?.message ?? '리텐션 데이터를 불러올 수 없습니다.',
      );
    }
    setRetentionLoading(false);
  }, []);

  /* 최초 마운트 + 기간 변경 시 행동 분석 로드 */
  useEffect(() => {
    loadBehaviorData(period);
  }, [period, loadBehaviorData]);

  /* 최초 마운트 + 리텐션 필터 변경 시 리텐션 로드 */
  useEffect(() => {
    loadRetentionData(cohortWeeks);
  }, [cohortWeeks, loadRetentionData]);

  /* 장르 선호 데이터 안전 접근 */
  const genreStats = behavior?.genreStats ?? [];
  /* 시간대별 활동 데이터 안전 접근 */
  const hourlyActivity = behavior?.hourlyActivity ?? [];

  /**
   * 리텐션 테이블 헤더 주차 목록.
   * 전체 코호트에서 최대 week 인덱스를 찾고 0주차부터 순서대로 생성한다.
   */
  const maxWeekIndex = retention.reduce((max, row) => {
    const rowMax = Object.keys(row)
      .filter((key) => key.startsWith('week'))
      .reduce((innerMax, key) => {
        const parsed = Number(key.replace('week', ''));
        return Number.isNaN(parsed) ? innerMax : Math.max(innerMax, parsed);
      }, -1);

    return Math.max(max, rowMax);
  }, -1);

  const weekKeys = maxWeekIndex >= 0
    ? Array.from({ length: maxWeekIndex + 1 }, (_, index) => `week${index}`)
    : [];

  return (
    <Wrapper>
      {/* ── 기간 선택 ── */}
      <FilterRow>
        <FilterLabel>집계 기간</FilterLabel>
        <PeriodGroup>
          {PERIOD_OPTIONS.map((opt) => (
            <PeriodButton
              key={opt.value}
              $active={period === opt.value}
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </PeriodButton>
          ))}
        </PeriodGroup>
      </FilterRow>

      {behaviorError && <ErrorMsg>{behaviorError}</ErrorMsg>}

      {/* ── 차트 2개: 장르 선호 + 시간대별 활동 ── */}
      <ChartGrid>
        {/* ── 장르 선호 차트 ── */}
        <ChartCard>
          <ChartTitle>장르별 선호도 분포</ChartTitle>
          <ChartBody $height={320}>
            {behaviorLoading ? (
              <LoadingMsg>차트 데이터를 불러오는 중...</LoadingMsg>
            ) : genreStats.length === 0 ? (
              <LoadingMsg>표시할 데이터가 없습니다.</LoadingMsg>
            ) : (
              /*
               * 가로 BarChart: 행동 프로필 장르 선호도 집계(count) 막대.
               * layout="vertical"로 장르 이름이 Y축에 표시.
               */
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={genreStats}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
                  barGap={2}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => Number(v).toLocaleString()}
                  />
                  <YAxis
                    type="category"
                    dataKey="genre"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={72}
                  />
                  <Tooltip content={<GenreTooltip />} />
                  <Bar
                    dataKey="count"
                    name="선호도 집계"
                    fill="#6366f1"
                    radius={[0, 4, 4, 0]}
                    barSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartBody>
        </ChartCard>

        {/* ── 시간대별 활동 차트 ── */}
        <ChartCard>
          <ChartTitle>시간대별 활동량 (0~23시)</ChartTitle>
          <ChartBody $height={320}>
            {behaviorLoading ? (
              <LoadingMsg>차트 데이터를 불러오는 중...</LoadingMsg>
            ) : hourlyActivity.length === 0 ? (
              <LoadingMsg>표시할 데이터가 없습니다.</LoadingMsg>
            ) : (
              /*
               * 세로 BarChart: X축=시간(0~23), Y축=활동량.
               * 시간대를 모두 표시하기 위해 tick interval 조정.
               */
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={hourlyActivity}
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                    /* 0, 4, 8, 12, 16, 20시만 레이블 표시 (혼잡 방지) */
                    interval={3}
                    tickFormatter={(v) => `${v}시`}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => Number(v).toLocaleString()}
                  />
                  <Tooltip content={<HourlyTooltip />} />
                  <Bar
                    dataKey="activityCount"
                    name="활동량"
                    fill="#f59e0b"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartBody>
        </ChartCard>
      </ChartGrid>

      {/* ── 코호트 리텐션 테이블 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>코호트 리텐션</SectionLabel>
      {retentionError && <ErrorMsg>{retentionError}</ErrorMsg>}
      <RetentionFilterRow>
        <FilterGroup>
          <FilterLabel>최근 코호트 수</FilterLabel>
          <PeriodGroup>
            {COHORT_OPTIONS.map((opt) => (
              <PeriodButton
                key={opt.value}
                $active={cohortWeeks === opt.value}
                onClick={() => setCohortWeeks(opt.value)}
              >
                {opt.label}
              </PeriodButton>
            ))}
          </PeriodGroup>
        </FilterGroup>
      </RetentionFilterRow>
      <RetentionCard>
        <ChartTitle>주차별 리텐션율</ChartTitle>
        <RetentionNote>
          최근 완료된 주간 코호트만 표시합니다. `0주차`는 가입 주간 100%이며, 이후 주차는 실제 활동 로그 기준 유지율입니다.
        </RetentionNote>
        {retentionLoading ? (
          <LoadingMsg style={{ padding: '32px 0' }}>
            리텐션 데이터를 불러오는 중...
          </LoadingMsg>
        ) : retention.length === 0 ? (
          <LoadingMsg style={{ padding: '32px 0' }}>
            표시할 리텐션 데이터가 없습니다.
          </LoadingMsg>
        ) : (
          <RetentionScrollWrapper>
            <RetentionTable>
              <thead>
                <tr>
                  {/* 코호트 열 헤더 */}
                  <RetentionTh>코호트</RetentionTh>
                  {weekKeys.map((wk) => {
                    /* week0 → "0주차", week1 → "1주차" */
                    const weekNum = wk.replace('week', '');
                    return (
                      <RetentionTh key={wk}>{weekNum}주차</RetentionTh>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {retention.map((row) => (
                  <tr key={row.cohort}>
                    {/* 코호트 이름 (예: "2026-W12") */}
                    <CohortTd>{row.cohort}</CohortTd>
                    {weekKeys.map((wk) => {
                      const rate = row[wk];
                      return (
                        <RetentionTd
                          key={wk}
                          style={{
                            background: retentionCellBg(rate),
                            color: retentionCellColor(rate),
                          }}
                        >
                          {rate != null ? fmtPct(rate) : '-'}
                        </RetentionTd>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </RetentionTable>
          </RetentionScrollWrapper>
        )}
      </RetentionCard>
    </Wrapper>
  );
}

/* ── styled-components ── */

const Wrapper = styled.div``;

const FilterRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
`;

const RetentionFilterRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xl};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;
`;

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const FilterLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

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

  & + & {
    border-left: 1px solid ${({ theme }) => theme.colors.border};
  }

  &:hover {
    background: ${({ $active, theme }) =>
      $active ? theme.colors.primaryHover : theme.colors.bgHover};
  }
`;

const SectionLabel = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

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
 * 차트 2개를 나란히 배치하는 그리드.
 * 768px 이하에서는 단일 열로 축소.
 */
const ChartGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.xl};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

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

/**
 * 차트 본체 래퍼.
 * $height prop으로 최소 높이를 동적으로 지정.
 */
const ChartBody = styled.div`
  min-height: ${({ $height }) => $height ?? 280}px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LoadingMsg = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
`;

/** 리텐션 카드 (별도 전체 너비 카드) */
const RetentionCard = styled(ChartCard)``;

/** 리텐션 테이블 색상 범례 안내 문구 */
const RetentionNote = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  margin-top: -${({ theme }) => theme.spacing.md};
`;

/** 리텐션 테이블 가로 스크롤 래퍼 */
const RetentionScrollWrapper = styled.div`
  overflow-x: auto;
`;

const RetentionTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

const RetentionTh = styled.th`
  padding: 8px 12px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
  border-bottom: 2px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
  min-width: 64px;

  /* 첫 번째 열(코호트)은 왼쪽 정렬 */
  &:first-child {
    text-align: left;
    min-width: 100px;
  }
`;

/** 코호트 이름 셀 */
const CohortTd = styled.td`
  padding: 8px 12px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
  white-space: nowrap;
`;

/**
 * 리텐션 데이터 셀.
 * background / color는 인라인 스타일로 동적 적용 (retentionCellBg/Color 함수).
 */
const RetentionTd = styled.td`
  padding: 8px 12px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  text-align: center;
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
  white-space: nowrap;
  transition: filter 0.15s ease;

  &:hover {
    filter: brightness(0.95);
  }
`;

/* ── 커스텀 Tooltip 스타일 ── */

const TooltipBox = styled.div`
  background: #ffffff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  min-width: 150px;
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
