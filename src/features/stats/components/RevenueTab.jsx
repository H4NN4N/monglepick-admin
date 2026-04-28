/**
 * 매출 분석 탭 컴포넌트 (확장 — 2026-04-28).
 *
 * 구성:
 *  Row 1. 핵심 KPI (오늘/어제/이번주/월매출/MRR/순매출/객단가/ARPU/누적매출)
 *  Row 2. 환불 KPI (환불액/환불건수/환불률/결제건수/결제유저)
 *  Row 3. 일별 매출 + 결제 건수 ComposedChart (선택 기간)
 *  Row 4. 월별 매출 추이 LineChart (최근 12개월)
 *  Row 5. 결제 수단 분포 PieChart + 주문 유형 분포 PieChart
 *  Row 6. 구독 플랜별 매출 BarChart (선택 기간)
 *  Row 7. 시간대(0~23시) 분포 BarChart
 *  Row 8. 요일(월~일) 분포 BarChart
 *  Row 9. 구독 현황 KPI + 활성 구독 분포 PieChart + 플랜별 MRR Bar
 *  Row 10. Top 10 결제 사용자 표
 *
 * 데이터 패칭:
 * - Promise.allSettled 로 매출 + 구독 현황 병렬 호출
 * - 기간 변경 시 매출 API 만 재호출 (구독 현황은 기간 무관)
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
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  ComposedChart,
} from 'recharts';
import {
  MdAttachMoney,
  MdTrendingUp,
  MdPerson,
  MdSubscriptions,
  MdExitToApp,
  MdReceiptLong,
  MdToday,
  MdHistoryToggleOff,
  MdCalendarViewWeek,
  MdAssignmentReturn,
  MdShoppingCart,
  MdGroups,
  MdAccountBalance,
  MdEmojiEvents,
} from 'react-icons/md';
import StatsCard from '@/shared/components/StatsCard';
import { fetchRevenue, fetchSubscription } from '../api/statsApi';

/** 기간 선택 옵션 */
const PERIOD_OPTIONS = [
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: '90d', label: '90일' },
];

/** 차트 색상 팔레트 — 플랜/결제수단/주문유형 분포 공통 사용 */
const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
];

// ──────────────────────────────────────────────
// 포맷터
// ──────────────────────────────────────────────

/** 금액 한국어 포맷. 2,850,000 → "285만원", 100000000 → "1.0억원" */
function fmtAmount(amount) {
  if (amount === null || amount === undefined) return '-';
  const n = Number(amount);
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억원`;
  if (n >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}

/** Y축용 짧은 금액 포맷 */
function fmtAxis(v) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(0)}억`;
  if (v >= 10_000) return `${Math.floor(v / 10_000)}만`;
  return String(v);
}

/** 비율(0.0~1.0) → "5.4%" 포맷 */
function fmtPct(val) {
  if (val === null || val === undefined) return '-';
  return `${(Number(val) * 100).toFixed(1)}%`;
}

/** 천 단위 콤마 */
function fmt(val) {
  if (val === null || val === undefined) return '-';
  return Number(val).toLocaleString();
}

// ──────────────────────────────────────────────
// 커스텀 Tooltip
// ──────────────────────────────────────────────

/** 매출/금액 차트용 Tooltip — 금액은 fmtAmount, 그 외는 fmt */
function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <TooltipBox>
      <TooltipDate>{label}</TooltipDate>
      {payload.map((entry) => {
        const isMoney = entry.dataKey === 'amount' || entry.dataKey === 'mrr';
        return (
          <TooltipRow key={entry.dataKey}>
            <TooltipDot style={{ background: entry.color }} />
            <TooltipLabel>{entry.name}</TooltipLabel>
            <TooltipValue>
              {isMoney ? fmtAmount(entry.value) : fmt(entry.value)}
            </TooltipValue>
          </TooltipRow>
        );
      })}
    </TooltipBox>
  );
}

/** PieChart 라벨 — 이름 + 비율 */
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, ratio }) {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#64748b"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={12}
    >
      {`${name} ${fmtPct(ratio)}`}
    </text>
  );
}

// ──────────────────────────────────────────────
// 메인 컴포넌트
// ──────────────────────────────────────────────

export default function RevenueTab() {
  const [period, setPeriod] = useState('30d');

  /** 매출 데이터 */
  const [revenue, setRevenue] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState(null);

  /** 구독 현황 */
  const [subscription, setSubscription] = useState(null);
  const [subLoading, setSubLoading] = useState(true);
  const [subError, setSubError] = useState(null);

  /** 최초 마운트: 매출 + 구독 병렬 로드 */
  const loadAll = useCallback(async (p) => {
    setRevenueLoading(true);
    setSubLoading(true);
    setRevenueError(null);
    setSubError(null);

    const [revenueResult, subResult] = await Promise.allSettled([
      fetchRevenue({ period: p }),
      fetchSubscription(),
    ]);

    if (revenueResult.status === 'fulfilled') {
      setRevenue(revenueResult.value);
    } else {
      setRevenueError(
        revenueResult.reason?.message ?? '매출 데이터를 불러올 수 없습니다.',
      );
    }
    setRevenueLoading(false);

    if (subResult.status === 'fulfilled') {
      setSubscription(subResult.value);
    } else {
      setSubError(subResult.reason?.message ?? '구독 현황을 불러올 수 없습니다.');
    }
    setSubLoading(false);
  }, []);

  /** 기간 변경 시 매출만 재로딩 */
  const loadRevenue = useCallback(async (p) => {
    setRevenueLoading(true);
    setRevenueError(null);
    try {
      const data = await fetchRevenue({ period: p });
      setRevenue(data);
    } catch (err) {
      setRevenueError(err?.message ?? '매출 데이터를 불러올 수 없습니다.');
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAll]);

  function handlePeriodChange(p) {
    setPeriod(p);
    loadRevenue(p);
  }

  /* 안전 접근 */
  const r = revenue ?? {};
  const s = subscription ?? {};
  const dailyRevenue = Array.isArray(r.dailyRevenue) ? r.dailyRevenue : [];
  const monthlyTrend = Array.isArray(r.monthlyRevenueTrend) ? r.monthlyRevenueTrend : [];
  const methodDist = Array.isArray(r.paymentMethodDistribution) ? r.paymentMethodDistribution : [];
  const planRevenue = Array.isArray(r.planRevenueDistribution) ? r.planRevenueDistribution : [];
  const orderTypeDist = Array.isArray(r.orderTypeDistribution) ? r.orderTypeDistribution : [];
  const hourlyDist = Array.isArray(r.hourlyDistribution) ? r.hourlyDistribution : [];
  const weekdayDist = Array.isArray(r.weekdayDistribution) ? r.weekdayDistribution : [];
  const topPayers = Array.isArray(r.topPayers) ? r.topPayers : [];
  const planDist = Array.isArray(s.planDistribution) ? s.planDistribution : [];
  const planMrr = Array.isArray(s.planMrr) ? s.planMrr : [];

  /* ── 어제 대비 오늘 변동 — 간단한 추이 인디케이터 ── */
  const dayDelta = (Number(r.todayRevenue ?? 0)) - (Number(r.yesterdayRevenue ?? 0));
  const dayDeltaLabel =
    r.yesterdayRevenue
      ? `어제 대비 ${dayDelta >= 0 ? '+' : ''}${fmtAmount(Math.abs(dayDelta))}`
      : '어제 매출 없음';

  /** 핵심 KPI 카드 */
  const headlineCards = [
    {
      key: 'todayRevenue',
      icon: <MdToday size={18} />,
      title: '오늘 매출',
      value: revenueLoading ? '...' : fmtAmount(r.todayRevenue),
      subtitle: revenueLoading ? '' : dayDeltaLabel,
      status: dayDelta >= 0 ? 'success' : 'warning',
    },
    {
      key: 'yesterdayRevenue',
      icon: <MdHistoryToggleOff size={18} />,
      title: '어제 매출',
      value: revenueLoading ? '...' : fmtAmount(r.yesterdayRevenue),
      subtitle: '전일 매출',
      status: 'info',
    },
    {
      key: 'weekRevenue',
      icon: <MdCalendarViewWeek size={18} />,
      title: '이번주 매출',
      value: revenueLoading ? '...' : fmtAmount(r.weekRevenue),
      subtitle: '월요일부터 오늘까지',
      status: 'info',
    },
    {
      key: 'monthlyRevenue',
      icon: <MdAttachMoney size={18} />,
      title: '월 매출',
      value: revenueLoading ? '...' : fmtAmount(r.monthlyRevenue),
      subtitle: '이번 달 누적',
      status: 'success',
    },
    {
      key: 'mrr',
      icon: <MdTrendingUp size={18} />,
      title: 'MRR',
      value: revenueLoading ? '...' : fmtAmount(r.mrr),
      subtitle: '활성 구독 월환산',
      status: 'success',
    },
    {
      key: 'netRevenue',
      icon: <MdAccountBalance size={18} />,
      title: '순 매출',
      value: revenueLoading ? '...' : fmtAmount(r.netRevenue),
      subtitle: '월 매출 - 환불',
      status: 'info',
    },
    {
      key: 'avgOrderValue',
      icon: <MdShoppingCart size={18} />,
      title: '객단가',
      value: revenueLoading ? '...' : fmtAmount(r.avgOrderValue),
      subtitle: `최근 ${period} 평균 결제액`,
      status: 'info',
    },
    {
      key: 'arpu',
      icon: <MdPerson size={18} />,
      title: 'ARPU',
      value: revenueLoading ? '...' : fmtAmount(r.arpu),
      subtitle: '결제 사용자 1인당 평균',
      status: 'info',
    },
    {
      key: 'totalRevenue',
      icon: <MdEmojiEvents size={18} />,
      title: '누적 매출',
      value: revenueLoading ? '...' : fmtAmount(r.totalRevenue),
      subtitle: '서비스 시작 이후 합계',
      status: 'info',
    },
  ];

  /** 환불·결제 현황 카드 */
  const refundCards = [
    {
      key: 'refundAmount',
      icon: <MdAssignmentReturn size={18} />,
      title: '이번달 환불액',
      value: revenueLoading ? '...' : fmtAmount(r.refundAmount),
      subtitle: '환불 금액 합계',
      status: (r.refundAmount ?? 0) > 0 ? 'warning' : 'success',
    },
    {
      key: 'refundCount',
      icon: <MdReceiptLong size={18} />,
      title: '환불 건수',
      value: revenueLoading ? '...' : fmt(r.refundCount),
      subtitle: '이번 달 환불 처리',
      status: (r.refundCount ?? 0) > 0 ? 'warning' : 'success',
    },
    {
      key: 'refundRate',
      icon: <MdTrendingUp size={18} />,
      title: '환불률',
      value: revenueLoading ? '...' : fmtPct(r.refundRate),
      subtitle: '환불액 / 월 매출',
      status: (r.refundRate ?? 0) > 0.05 ? 'warning' : 'success',
    },
    {
      key: 'totalOrders',
      icon: <MdShoppingCart size={18} />,
      title: '결제 건수',
      value: revenueLoading ? '...' : fmt(r.totalOrders),
      subtitle: `최근 ${period} 완료 결제`,
      status: 'info',
    },
    {
      key: 'todayOrders',
      icon: <MdToday size={18} />,
      title: '오늘 결제 건수',
      value: revenueLoading ? '...' : fmt(r.todayOrders),
      subtitle: '오늘 완료 결제',
      status: 'info',
    },
    {
      key: 'payingUsers',
      icon: <MdGroups size={18} />,
      title: '결제 유저',
      value: revenueLoading ? '...' : fmt(r.payingUsers),
      subtitle: `최근 ${period} 결제 고유 유저`,
      status: 'info',
    },
  ];

  /** 구독 KPI 카드 */
  const subCards = [
    {
      key: 'activeSubs',
      icon: <MdSubscriptions size={18} />,
      title: '활성 구독',
      value: subLoading ? '...' : fmt(s.activeSubscriptions),
      subtitle: '현재 구독 중',
      status: 'success',
    },
    {
      key: 'newThisMonth',
      icon: <MdTrendingUp size={18} />,
      title: '이번달 신규',
      value: subLoading ? '...' : fmt(s.newThisMonth),
      subtitle: '이번 달 신규 구독',
      status: 'success',
    },
    {
      key: 'cancelledThisMonth',
      icon: <MdExitToApp size={18} />,
      title: '이번달 취소',
      value: subLoading ? '...' : fmt(s.cancelledThisMonth),
      subtitle: '이번 달 구독 취소',
      status: (s.cancelledThisMonth ?? 0) > (s.newThisMonth ?? 0) ? 'warning' : 'info',
    },
    {
      key: 'churnRate',
      icon: <MdExitToApp size={18} />,
      title: '이탈률',
      value: subLoading ? '...' : fmtPct(s.churnRate),
      subtitle: '누적 이탈 비율',
      status: subLoading
        ? 'info'
        : (s.churnRate ?? 0) > 0.05
          ? 'warning'
          : 'success',
    },
    {
      key: 'avgRev',
      icon: <MdPerson size={18} />,
      title: '구독자당 매출',
      value: subLoading ? '...' : fmtAmount(s.avgRevenuePerSubscriber),
      subtitle: '활성 구독 1인당 월 평균',
      status: 'info',
    },
  ];

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
              onClick={() => handlePeriodChange(opt.value)}
            >
              {opt.label}
            </PeriodButton>
          ))}
        </PeriodGroup>
      </FilterRow>

      {/* ── Row 1: 핵심 KPI ── */}
      <SectionLabel>핵심 매출 지표</SectionLabel>
      {revenueError && <ErrorMsg>{revenueError}</ErrorMsg>}
      <KpiGrid>
        {headlineCards.map((card) => (
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

      {/* ── Row 2: 환불·결제 현황 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>환불 / 결제 현황</SectionLabel>
      <KpiGrid>
        {refundCards.map((card) => (
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

      {/* ── Row 3: 일별 매출 + 결제 건수 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>일별 매출 추이 ({period})</SectionLabel>
      <ChartCard>
        <ChartTitle>일별 매출 / 결제 건수</ChartTitle>
        <ChartBody>
          {revenueLoading ? (
            <LoadingMsg>차트 데이터를 불러오는 중...</LoadingMsg>
          ) : dailyRevenue.length === 0 ? (
            <LoadingMsg>표시할 매출 데이터가 없습니다.</LoadingMsg>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart
                data={dailyRevenue}
                margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtAxis}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}건`}
                />
                <Tooltip content={<MoneyTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar
                  yAxisId="left"
                  dataKey="amount"
                  name="매출"
                  fill="#6366f1"
                  radius={[3, 3, 0, 0]}
                  barSize={period === '7d' ? 32 : period === '30d' ? 14 : 8}
                />
                <Line
                  yAxisId="right"
                  dataKey="count"
                  name="결제 건수"
                  type="monotone"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartBody>
      </ChartCard>

      {/* ── Row 4: 월별 12개월 추이 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>월별 매출 추이 (최근 12개월)</SectionLabel>
      <ChartCard>
        <ChartTitle>월별 매출</ChartTitle>
        <ChartBody>
          {revenueLoading ? (
            <LoadingMsg>차트 데이터를 불러오는 중...</LoadingMsg>
          ) : monthlyTrend.length === 0 ? (
            <LoadingMsg>표시할 월별 데이터가 없습니다.</LoadingMsg>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={monthlyTrend}
                margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtAxis}
                />
                <Tooltip content={<MoneyTooltip />} />
                <Line
                  dataKey="amount"
                  name="월 매출"
                  type="monotone"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartBody>
      </ChartCard>

      {/* ── Row 5: 결제 수단 + 주문 유형 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>결제 수단 / 주문 유형</SectionLabel>
      <ChartGrid2>
        <ChartCard>
          <ChartTitle>결제 수단별 매출</ChartTitle>
          <ChartBody>
            {revenueLoading ? (
              <LoadingMsg>로딩 중...</LoadingMsg>
            ) : methodDist.length === 0 ? (
              <LoadingMsg>결제 수단 데이터가 없습니다.</LoadingMsg>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={methodDist}
                    dataKey="amount"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(props) =>
                      PieLabel({ ...props, ratio: props.payload?.ratio })
                    }
                  >
                    {methodDist.map((_, idx) => (
                      <Cell key={`m-${idx}`} fill={PALETTE[idx % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [fmtAmount(value), name]}
                    contentStyle={tooltipStyle}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartBody>
        </ChartCard>

        <ChartCard>
          <ChartTitle>주문 유형별 매출</ChartTitle>
          <ChartBody>
            {revenueLoading ? (
              <LoadingMsg>로딩 중...</LoadingMsg>
            ) : orderTypeDist.length === 0 ? (
              <LoadingMsg>주문 유형 데이터가 없습니다.</LoadingMsg>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={orderTypeDist}
                    dataKey="amount"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(props) =>
                      PieLabel({ ...props, ratio: props.payload?.ratio })
                    }
                  >
                    {orderTypeDist.map((_, idx) => (
                      <Cell key={`o-${idx}`} fill={PALETTE[(idx + 2) % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [fmtAmount(value), name]}
                    contentStyle={tooltipStyle}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartBody>
        </ChartCard>
      </ChartGrid2>

      {/* ── Row 6: 플랜별 매출 BarChart ── */}
      <SectionLabel style={{ marginTop: '32px' }}>구독 플랜별 매출 ({period})</SectionLabel>
      <ChartCard>
        <ChartTitle>플랜별 결제 매출</ChartTitle>
        <ChartBody>
          {revenueLoading ? (
            <LoadingMsg>로딩 중...</LoadingMsg>
          ) : planRevenue.length === 0 ? (
            <LoadingMsg>플랜별 매출 데이터가 없습니다.</LoadingMsg>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={planRevenue}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 64, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtAxis}
                />
                <YAxis
                  type="category"
                  dataKey="planName"
                  tick={{ fontSize: 12, fill: '#475569' }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  formatter={(value) => [fmtAmount(value), '매출']}
                  contentStyle={tooltipStyle}
                />
                <Bar
                  dataKey="amount"
                  fill="#8b5cf6"
                  radius={[0, 4, 4, 0]}
                  barSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartBody>
      </ChartCard>

      {/* ── Row 7: 시간대 분포 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>시간대별 결제 분포 ({period})</SectionLabel>
      <ChartCard>
        <ChartTitle>0시 ~ 23시 결제 매출</ChartTitle>
        <ChartBody>
          {revenueLoading ? (
            <LoadingMsg>로딩 중...</LoadingMsg>
          ) : hourlyDist.length === 0 ? (
            <LoadingMsg>데이터가 없습니다.</LoadingMsg>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={hourlyDist}
                margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}시`}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtAxis}
                />
                <Tooltip
                  formatter={(value) => [fmtAmount(value), '매출']}
                  labelFormatter={(label) => `${label}시`}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="amount" fill="#06b6d4" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartBody>
      </ChartCard>

      {/* ── Row 8: 요일 분포 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>요일별 결제 분포 ({period})</SectionLabel>
      <ChartCard>
        <ChartTitle>월~일 결제 매출</ChartTitle>
        <ChartBody>
          {revenueLoading ? (
            <LoadingMsg>로딩 중...</LoadingMsg>
          ) : weekdayDist.length === 0 ? (
            <LoadingMsg>데이터가 없습니다.</LoadingMsg>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={weekdayDist}
                margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="weekdayName"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtAxis}
                />
                <Tooltip
                  formatter={(value) => [fmtAmount(value), '매출']}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="amount" fill="#ec4899" radius={[3, 3, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartBody>
      </ChartCard>

      {/* ── Row 9: 구독 현황 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>구독 현황</SectionLabel>
      {subError && <ErrorMsg>{subError}</ErrorMsg>}
      <KpiGrid>
        {subCards.map((card) => (
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

      <ChartGrid2 style={{ marginTop: '16px' }}>
        <ChartCard>
          <ChartTitle>플랜별 활성 구독</ChartTitle>
          <ChartBody>
            {subLoading ? (
              <LoadingMsg>로딩 중...</LoadingMsg>
            ) : planDist.length === 0 ? (
              <LoadingMsg>구독 분포 데이터가 없습니다.</LoadingMsg>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={planDist}
                    dataKey="count"
                    nameKey="plan"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    label={(props) =>
                      PieLabel({ ...props, ratio: props.payload?.ratio })
                    }
                    labelLine={true}
                  >
                    {planDist.map((_, idx) => (
                      <Cell key={`p-${idx}`} fill={PALETTE[idx % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${fmt(value)}명`, name]}
                    contentStyle={tooltipStyle}
                  />
                  <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartBody>
        </ChartCard>

        <ChartCard>
          <ChartTitle>플랜별 MRR 기여도</ChartTitle>
          <ChartBody>
            {subLoading ? (
              <LoadingMsg>로딩 중...</LoadingMsg>
            ) : planMrr.length === 0 ? (
              <LoadingMsg>MRR 데이터가 없습니다.</LoadingMsg>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={planMrr}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 64, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickFormatter={fmtAxis}
                  />
                  <YAxis
                    type="category"
                    dataKey="plan"
                    tick={{ fontSize: 12, fill: '#475569' }}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value) => [fmtAmount(value), 'MRR']}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="mrr" fill="#10b981" radius={[0, 4, 4, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartBody>
        </ChartCard>
      </ChartGrid2>

      {/* ── Row 10: Top 결제 사용자 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>Top 결제 사용자 ({period})</SectionLabel>
      <ChartCard>
        <ChartTitle>최근 {period} 결제액 상위 10명</ChartTitle>
        {revenueLoading ? (
          <LoadingMsg>로딩 중...</LoadingMsg>
        ) : topPayers.length === 0 ? (
          <LoadingMsg>결제 데이터가 없습니다.</LoadingMsg>
        ) : (
          <PayerTable>
            <thead>
              <tr>
                <Th style={{ width: '48px' }}>#</Th>
                <Th>닉네임</Th>
                <Th>유저 ID</Th>
                <Th style={{ textAlign: 'right' }}>누적 결제액</Th>
                <Th style={{ textAlign: 'right' }}>결제 건수</Th>
              </tr>
            </thead>
            <tbody>
              {topPayers.map((p, idx) => (
                <tr key={p.userId}>
                  <Td>{idx + 1}</Td>
                  <Td>{p.nickname}</Td>
                  <Td style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '12px' }}>
                    {p.userId.length > 12 ? `${p.userId.slice(0, 12)}...` : p.userId}
                  </Td>
                  <Td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {fmtAmount(p.totalAmount)}
                  </Td>
                  <Td style={{ textAlign: 'right' }}>{fmt(p.orderCount)}건</Td>
                </tr>
              ))}
            </tbody>
          </PayerTable>
        )}
      </ChartCard>
    </Wrapper>
  );
}

/* ── 공통 inline 스타일 ── */
const tooltipStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  fontSize: '13px',
};

/* ── styled-components ── */

const Wrapper = styled.div``;

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

const KpiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
`;

/** 차트 2분할 그리드 */
const ChartGrid2 = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
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

const ChartBody = styled.div`
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LoadingMsg = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
`;

/* ── Top payer 표 ── */
const PayerTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  text-align: left;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Td = styled.td`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  padding: ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight ?? '#f1f5f9'};
`;

/* ── 커스텀 Tooltip ── */
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
