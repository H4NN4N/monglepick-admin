/**
 * 사용자 단계별 진행 분석 탭 컴포넌트.
 *
 * v3.6 (2026-04-28) 재구성:
 * - "전환 퍼널" → "사용자 단계별 진행" 으로 리네이밍 (마케팅 용어 회피)
 * - 6단계 → 5단계 (구독 단계 제거 — 결제 단계와 사실상 중복)
 * - 백엔드 응답 필드 정합 회복: step.conversionFromTop / totalConversionRate 사용
 *   (이전 코드에서는 존재하지 않는 conversionRate 를 읽어 항상 0 으로 표시되던 버그)
 * - 안내 박스 추가 — 어느 단계 비율이 낮은지 → 어디부터 개선해야 하는지 직관적으로 보여줌
 *
 * 구성:
 * 1. 안내 박스 (이 화면이 무엇을 보여주는지)
 * 2. 기간 선택 버튼 그룹 (7d / 30d / 90d)
 * 3. 전체 전환율 하이라이트 카드 (가입 → 결제)
 * 4. 5단계 진행 BarChart (단계별 사용자 수)
 * 5. 단계별 전환율 카드 4개 (각 단계 → 다음 단계)
 *
 * 데이터 패칭: fetchConversionFunnel 1개 API 호출 (period 파라미터)
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
  Cell,
  LabelList,
} from 'recharts';
import {
  MdPersonAdd,
  MdTouchApp,
  MdSmartToy,
  MdRateReview,
  MdPayment,
  MdArrowForward,
  MdInfoOutline,
} from 'react-icons/md';
import StatsCard from '@/shared/components/StatsCard';
import { fetchConversionFunnel } from '../api/statsApi';

/** 기간 선택 옵션 */
const PERIOD_OPTIONS = [
  { value: '7d', label: '최근 7일' },
  { value: '30d', label: '최근 30일' },
  { value: '90d', label: '최근 90일' },
];

/** 단계별 색상 (진한 → 연한 그라데이션, 5단계) */
const STEP_COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c4b5fd', '#d8b4fe'];

/**
 * 5단계 메타 정보 — 백엔드 step 순서와 1:1 매칭.
 * (백엔드 service AdminStatsService#getFunnelConversion)
 */
const STEP_META = [
  { key: 'signup',   icon: <MdPersonAdd size={18} /> },
  { key: 'activity', icon: <MdTouchApp size={18} /> },
  { key: 'aiUsed',   icon: <MdSmartToy size={18} /> },
  { key: 'review',   icon: <MdRateReview size={18} /> },
  { key: 'payment',  icon: <MdPayment size={18} /> },
];

/** 숫자 포맷 (천 단위 콤마) */
function fmt(val) {
  if (val === null || val === undefined) return '-';
  return Number(val).toLocaleString();
}

export default function ConversionFunnelTab() {
  /** 분석 기간 (7d/30d/90d) */
  const [period, setPeriod] = useState('30d');
  /** 백엔드 응답 — { period, steps[], totalConversionRate } */
  const [funnel, setFunnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /** API 호출 — 기간 변경 시마다 재호출 */
  const loadFunnel = useCallback(async (p) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConversionFunnel({ period: p });
      setFunnel(data);
    } catch (err) {
      setError(err?.message ?? '단계별 진행 데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFunnel(period); }, [loadFunnel]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 기간 버튼 클릭 핸들러 */
  function handlePeriodChange(p) {
    setPeriod(p);
    loadFunnel(p);
  }

  /* ── 안전 접근 ── */
  const f = funnel ?? {};
  const steps = f.steps ?? [];

  /* 차트 데이터 — 백엔드 step.label 그대로 사용 (한국어로 이미 옴) */
  const chartData = steps.map((step) => ({
    label: step.label ?? '단계',
    count: step.count ?? 0,
  }));

  /*
   * 단계별 전환율 카드 (1→2, 2→3, 3→4, 4→5).
   * 백엔드 응답: step.conversionFromPrev — 전 단계 대비 % (단계 1 은 100.0).
   * 단계 i+1 의 conversionFromPrev 이 곧 i→i+1 전환율.
   */
  const conversionCards = [];
  for (let i = 0; i < steps.length - 1; i++) {
    const from = steps[i]?.label ?? `단계${i + 1}`;
    const to = steps[i + 1]?.label ?? `단계${i + 2}`;
    const rate = steps[i + 1]?.conversionFromPrev ?? 0;
    /* 색상 임계: 30% 이상=초록 / 10~30%=중립 / 10% 미만=경고 */
    const status = rate >= 30 ? 'success' : rate >= 10 ? 'info' : 'warning';
    conversionCards.push({
      key: `conv-${i}`,
      icon: <MdArrowForward size={18} />,
      title: `${from} → ${to}`,
      value: loading ? '...' : `${rate}%`,
      subtitle: `${fmt(steps[i]?.count)}명 → ${fmt(steps[i + 1]?.count)}명`,
      status,
    });
  }

  /* 전체 전환율(가입 → 결제) — 백엔드가 직접 계산해서 줌 */
  const totalConv = f.totalConversionRate ?? 0;
  const firstCount = steps[0]?.count ?? 0;
  const lastCount = steps[steps.length - 1]?.count ?? 0;

  return (
    <Wrapper>
      {/* ── 안내 박스 ── */}
      <InfoBox>
        <InfoIcon><MdInfoOutline size={20} /></InfoIcon>
        <InfoText>
          <strong>이 탭의 목적</strong> — 신규 가입자가 어느 단계에서 이탈하는지 보여줍니다.
          가입 → 첫 활동 → AI 채팅 → 리뷰 작성 → 결제 5단계로 진행하면서{' '}
          <em>비율이 급격히 떨어지는 구간</em>이 개선 우선순위입니다.
        </InfoText>
      </InfoBox>

      {/* ── 기간 선택 ── */}
      <FilterRow>
        <FilterLabel>분석 기간</FilterLabel>
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

      {error && <ErrorMsg>{error}</ErrorMsg>}

      {/* ── 전체 전환율 하이라이트 ── */}
      <SectionLabel>가입 → 결제 전체 전환율</SectionLabel>
      <HighlightCard>
        <HighlightIcon $status={totalConv >= 5 ? 'success' : 'warning'}>
          <MdPayment size={28} />
        </HighlightIcon>
        <HighlightContent>
          <HighlightValue>{loading ? '...' : `${totalConv}%`}</HighlightValue>
          <HighlightLabel>
            {loading
              ? '데이터 로딩 중...'
              : `가입 ${fmt(firstCount)}명 중 ${fmt(lastCount)}명이 결제까지 도달했습니다.`}
          </HighlightLabel>
        </HighlightContent>
      </HighlightCard>

      {/* ── 5단계 진행 BarChart ── */}
      <SectionLabel style={{ marginTop: '32px' }}>단계별 사용자 수 (5단계)</SectionLabel>
      <ChartCard>
        <ChartBody>
          {loading ? (
            <LoadingMsg>데이터를 불러오는 중...</LoadingMsg>
          ) : chartData.length === 0 ? (
            <LoadingMsg>표시할 데이터가 없습니다.</LoadingMsg>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={chartData} margin={{ top: 20, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 13, fill: '#334155', fontWeight: 500 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => [`${fmt(value)}명`, '사용자 수']}
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                />
                <Bar dataKey="count" name="사용자 수" radius={[6, 6, 0, 0]} barSize={64}>
                  <LabelList
                    dataKey="count"
                    position="top"
                    formatter={(v) => fmt(v)}
                    style={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                  />
                  {chartData.map((_, idx) => (
                    <Cell key={`step-${idx}`} fill={STEP_COLORS[idx % STEP_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartBody>
      </ChartCard>

      {/* ── 단계별 전환율 카드 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>단계 사이의 전환율</SectionLabel>
      <ConvGrid>
        {conversionCards.map((card) => (
          <StatsCard
            key={card.key}
            icon={card.icon}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            status={card.status}
          />
        ))}
      </ConvGrid>
    </Wrapper>
  );
}

/* ── styled-components ── */
const Wrapper = styled.div``;

/* ── 안내 박스 ── */
const InfoBox = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.primaryBg};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
`;
const InfoIcon = styled.div`
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: flex-start;
  padding-top: 2px;
`;
const InfoText = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.6;
  margin: 0;
  & strong { color: ${({ theme }) => theme.colors.textPrimary}; font-weight: ${({ theme }) => theme.fontWeights.semibold}; }
  & em { font-style: normal; color: ${({ theme }) => theme.colors.primary}; font-weight: ${({ theme }) => theme.fontWeights.semibold}; }
`;

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
  color: ${({ $active, theme }) => ($active ? '#ffffff' : theme.colors.textSecondary)};
  background: ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  transition: all ${({ theme }) => theme.transitions.fast};
  & + & { border-left: 1px solid ${({ theme }) => theme.colors.border}; }
  &:hover {
    background: ${({ $active, theme }) => ($active ? theme.colors.primaryHover : theme.colors.bgHover)};
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

/* ── 전체 전환율 하이라이트 카드 ── */
const HighlightCard = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xl};
  background: ${({ theme }) => theme.colors.bgCard};
  border: 2px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xxl};
  box-shadow: ${({ theme }) => theme.shadows.card};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;
const HighlightIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  flex-shrink: 0;
  background: ${({ $status, theme }) => $status === 'success' ? theme.colors.successBg : theme.colors.warningBg};
  color: ${({ $status, theme }) => $status === 'success' ? theme.colors.success : theme.colors.warning};
`;
const HighlightContent = styled.div``;
const HighlightValue = styled.div`
  font-size: 32px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textPrimary};
  line-height: 1.2;
`;
const HighlightLabel = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

const ChartCard = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.xl};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;
const ChartBody = styled.div`
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
`;
const LoadingMsg = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
`;
const ConvGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
`;
