/**
 * 이탈 위험 분석 탭 컴포넌트.
 *
 * v3.6 (2026-04-28) 정비:
 * - 백엔드 응답 필드 정합 회복 (이전: safeCount/lowCount/noLogin7Days/noSubscriptionUsers — 모두 undefined)
 *   → noRisk/lowRisk/mediumRisk/highRisk · inactive7days/14days/30days · zeroPointUsers/noAiUsageOver14days
 * - "구독 미보유" 신호 제거 (무료 사용자 다수, 변별력 부족)
 * - "AI 채팅 미사용 (가입 14일+)" 신호 추가 — 점수 산정 기준과 화면 정합 회복
 * - 점수 만점 95 → 75 점, 구간 재조정 (안전 0~14 / 낮음 15~29 / 중간 30~49 / 높음 50~75)
 * - 안내 박스 추가 — 이 탭이 무엇을 보여주는지 한눈에
 *
 * 구성:
 * 1. 안내 박스
 * 2. 위험 등급 분포 PieChart + KPI 카드 4개 (안전/낮음/중간/높음)
 * 3. 이탈 위험 신호 카드 5개 (7/14/30일 미로그인 · 포인트 0 · AI 미사용)
 * 4. 위험 신호 비교 BarChart
 * 5. 점수 산정 기준 안내
 *
 * 데이터 패칭: Promise.allSettled 로 2개 API 병렬 호출
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
} from 'recharts';
import {
  MdShield,
  MdWarning,
  MdError,
  MdCheckCircle,
  MdLogin,
  MdAccountBalanceWallet,
  MdSmartToy,
  MdInfoOutline,
} from 'react-icons/md';
import StatsCard from '@/shared/components/StatsCard';
import {
  fetchChurnRiskOverview,
  fetchChurnRiskSignals,
} from '../api/statsApi';

/** 위험 등급별 색상 */
const RISK_COLORS = {
  safe: '#10b981',
  low: '#f59e0b',
  medium: '#f97316',
  high: '#ef4444',
};

/** 숫자 포맷 (천 단위 콤마) */
function fmt(val) {
  if (val === null || val === undefined) return '-';
  return Number(val).toLocaleString();
}

export default function ChurnRiskTab() {
  /* 위험 등급 분포 */
  const [riskOverview, setRiskOverview] = useState(null);
  const [ovLoading, setOvLoading] = useState(true);
  const [ovError, setOvError] = useState(null);

  /* 이탈 위험 신호 집계 */
  const [signals, setSignals] = useState(null);
  const [sigLoading, setSigLoading] = useState(true);

  /** 2개 API 병렬 호출 */
  const loadAll = useCallback(async () => {
    setOvLoading(true);
    setSigLoading(true);
    setOvError(null);

    const [ovRes, sigRes] = await Promise.allSettled([
      fetchChurnRiskOverview(),
      fetchChurnRiskSignals(),
    ]);

    if (ovRes.status === 'fulfilled') setRiskOverview(ovRes.value);
    else setOvError(ovRes.reason?.message ?? '이탈 위험 데이터를 불러올 수 없습니다.');
    setOvLoading(false);

    if (sigRes.status === 'fulfilled') setSignals(sigRes.value);
    setSigLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── 안전 접근 (백엔드 필드명과 정합) ── */
  const ov = riskOverview ?? {};
  const sig = signals ?? {};

  /* 위험 등급 분포 PieChart 데이터 (백엔드 필드: noRisk/lowRisk/mediumRisk/highRisk) */
  const riskDistData = [
    { name: '안전 (0~14점)',  value: ov.noRisk ?? 0,     color: RISK_COLORS.safe },
    { name: '낮음 (15~29점)', value: ov.lowRisk ?? 0,    color: RISK_COLORS.low },
    { name: '중간 (30~49점)', value: ov.mediumRisk ?? 0, color: RISK_COLORS.medium },
    { name: '높음 (50~75점)', value: ov.highRisk ?? 0,   color: RISK_COLORS.high },
  ];
  const totalAnalyzed = ov.totalAnalyzed ?? riskDistData.reduce((sum, d) => sum + d.value, 0);

  /* 위험 등급 KPI 카드 4개 */
  const riskCards = [
    {
      key: 'safe',
      icon: <MdCheckCircle size={18} />,
      title: '안전',
      value: ovLoading ? '...' : `${fmt(ov.noRisk)}명`,
      subtitle: '위험 점수 0~14',
      status: 'success',
    },
    {
      key: 'low',
      icon: <MdShield size={18} />,
      title: '낮음',
      value: ovLoading ? '...' : `${fmt(ov.lowRisk)}명`,
      subtitle: '위험 점수 15~29',
      status: 'info',
    },
    {
      key: 'medium',
      icon: <MdWarning size={18} />,
      title: '중간',
      value: ovLoading ? '...' : `${fmt(ov.mediumRisk)}명`,
      subtitle: '위험 점수 30~49',
      status: 'warning',
    },
    {
      key: 'high',
      icon: <MdError size={18} />,
      title: '높음',
      value: ovLoading ? '...' : `${fmt(ov.highRisk)}명`,
      subtitle: '위험 점수 50~75',
      status: 'error',
    },
  ];

  /* 이탈 위험 신호 카드 5개 (백엔드 필드: inactive7days/14days/30days, zeroPointUsers, noAiUsageOver14days) */
  const signalCards = [
    {
      key: 'login7',
      icon: <MdLogin size={18} />,
      title: '7일+ 미로그인',
      value: sigLoading ? '...' : `${fmt(sig.inactive7days)}명`,
      subtitle: '7일 이상 로그인하지 않은 사용자',
      status: 'info',
    },
    {
      key: 'login14',
      icon: <MdLogin size={18} />,
      title: '14일+ 미로그인',
      value: sigLoading ? '...' : `${fmt(sig.inactive14days)}명`,
      subtitle: '14일 이상 미로그인',
      status: 'warning',
    },
    {
      key: 'login30',
      icon: <MdLogin size={18} />,
      title: '30일+ 미로그인',
      value: sigLoading ? '...' : `${fmt(sig.inactive30days)}명`,
      subtitle: '30일 이상 미로그인 (이탈 추정)',
      status: 'error',
    },
    {
      key: 'zeroPoint',
      icon: <MdAccountBalanceWallet size={18} />,
      title: '포인트 0',
      value: sigLoading ? '...' : `${fmt(sig.zeroPointUsers)}명`,
      subtitle: '포인트 잔액이 0인 사용자',
      status: 'warning',
    },
    {
      key: 'noAi',
      icon: <MdSmartToy size={18} />,
      title: 'AI 미사용 (가입 14일+)',
      value: sigLoading ? '...' : `${fmt(sig.noAiUsageOver14days)}명`,
      subtitle: '가입 14일이 지나도록 AI 채팅을 한 번도 쓰지 않음',
      status: 'warning',
    },
  ];

  /* 위험 신호 비교 BarChart 데이터 */
  const signalChartData = [
    { label: '7일+ 미로그인',         count: sig.inactive7days ?? 0,        color: '#64748b' },
    { label: '14일+ 미로그인',        count: sig.inactive14days ?? 0,       color: '#f59e0b' },
    { label: '30일+ 미로그인',        count: sig.inactive30days ?? 0,       color: '#ef4444' },
    { label: '포인트 0',              count: sig.zeroPointUsers ?? 0,       color: '#f97316' },
    { label: 'AI 미사용 (14일+)',     count: sig.noAiUsageOver14days ?? 0,  color: '#8b5cf6' },
  ];

  return (
    <Wrapper>
      {/* ── 안내 박스 ── */}
      <InfoBox>
        <InfoIcon><MdInfoOutline size={20} /></InfoIcon>
        <InfoText>
          <strong>이 탭의 목적</strong> — 이탈할 가능성이 높은 사용자를 사전에 식별합니다.
          <em>로그인 공백, 포인트 잔액, AI 미사용</em> 세 가지 신호를 합산해 0~75점으로 점수화한 뒤
          4 등급(안전/낮음/중간/높음)으로 분류합니다. <em>높음/중간</em> 등급 사용자가 리텐션 캠페인 우선 타깃입니다.
        </InfoText>
      </InfoBox>

      {ovError && <ErrorMsg>{ovError}</ErrorMsg>}

      {/* ── 위험 등급 분포 + KPI (2열) ── */}
      <SectionLabel>이탈 위험 등급별 분포</SectionLabel>
      <TopGrid>
        {/* 파이차트 */}
        <ChartCard>
          <ChartTitle>위험 등급 분포 ({fmt(totalAnalyzed)}명 분석)</ChartTitle>
          <ChartBody style={{ minHeight: '280px' }}>
            {ovLoading ? (
              <LoadingMsg>데이터를 불러오는 중...</LoadingMsg>
            ) : totalAnalyzed === 0 ? (
              <LoadingMsg>분석할 사용자가 없습니다.</LoadingMsg>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={riskDistData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    label={({ value }) => `${value}명`}
                    labelLine={true}
                  >
                    {riskDistData.map((item, idx) => (
                      <Cell key={`risk-${idx}`} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${fmt(value)}명`, name]}
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartBody>
        </ChartCard>

        {/* KPI 카드 4개 */}
        <RiskKpiGrid>
          {riskCards.map((card) => (
            <StatsCard
              key={card.key}
              icon={card.icon}
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              status={card.status}
            />
          ))}
        </RiskKpiGrid>
      </TopGrid>

      {/* ── 이탈 위험 신호 카드 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>이탈 위험 신호</SectionLabel>
      <SignalGrid>
        {signalCards.map((card) => (
          <StatsCard
            key={card.key}
            icon={card.icon}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            status={card.status}
          />
        ))}
      </SignalGrid>

      {/* ── 위험 신호 비교 BarChart ── */}
      <ChartCard style={{ marginTop: '24px' }}>
        <ChartTitle>이탈 위험 신호 비교</ChartTitle>
        <ChartBody>
          {sigLoading ? (
            <LoadingMsg>데이터를 불러오는 중...</LoadingMsg>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={signalChartData} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => [`${fmt(value)}명`]}
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                />
                <Bar dataKey="count" name="사용자 수" radius={[4, 4, 0, 0]} barSize={48}>
                  {signalChartData.map((item, idx) => (
                    <Cell key={`sig-${idx}`} fill={item.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartBody>
      </ChartCard>

      {/* ── 점수 산정 기준 안내 ── */}
      <ScoreInfoBox>
        <InfoTitle>위험 점수 산정 기준 (총점 0~75점)</InfoTitle>
        <InfoList>
          <li><strong>로그인 공백</strong> — 7일+: 10점 / 14일+: 25점 / 30일+: 40점 (가장 높은 구간만 적용)</li>
          <li><strong>포인트 잔액 0</strong> + 가입 7일 이상 — 15점</li>
          <li><strong>AI 채팅 미사용</strong> + 가입 14일 이상 — 20점</li>
        </InfoList>
        <InfoNote>
          * 등급 구간 — 안전: 0~14 / 낮음: 15~29 / 중간: 30~49 / 높음: 50~75
        </InfoNote>
      </ScoreInfoBox>
    </Wrapper>
  );
}

/* ── styled-components ── */
const Wrapper = styled.div``;

/* ── 상단 안내 박스 ── */
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

const TopGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.lg};
  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;
const RiskKpiGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.lg};
  align-content: start;
`;
const SignalGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
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
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
`;
const LoadingMsg = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
`;

/* ── 점수 산정 기준 안내 박스 ── */
const ScoreInfoBox = styled.div`
  margin-top: 32px;
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.xl};
`;
const InfoTitle = styled.h4`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;
const InfoList = styled.ul`
  list-style: disc;
  padding-left: 20px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.8;
  & strong { color: ${({ theme }) => theme.colors.textPrimary}; }
`;
const InfoNote = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: ${({ theme }) => theme.spacing.md};
  font-style: italic;
`;
