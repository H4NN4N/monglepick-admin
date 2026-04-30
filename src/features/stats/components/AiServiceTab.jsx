/**
 * AI 서비스 분석 탭 — 전면 재설계 (2026-04-29).
 *
 * 8개 섹션으로 구성된 운영자 AI 모니터링 대시보드.
 *
 * 1) 오늘 한눈에 — 4개 핵심 KPI 카드 (오늘 호출/평균 응답시간/추천 CTR/고객센터 자동화율)
 * 2) 에이전트 호출량 추이 — 4개 에이전트 멀티 라인 차트 (7d/30d/90d 토글)
 * 3) 에이전트별 건강도 — 4개 KPI 카드 (챗·추천·고객센터·퀴즈 각각 4지표)
 * 4) 추천 펀넬 — 5단계 가로 BarChart (recommendation_impact 기반)
 * 5) 응답 시간 분포 — 일별 p50/p95 라인 차트 + p99 카드
 * 6) 의도 분포 — 챗 / 고객센터 2개 PieChart 좌우 배치
 * 7) 모델 버전별 비교 — 테이블 (호출수/평균점수/응답시간/CTR)
 * 8) 쿼터 소진 현황 — 등급별 stacked bar + 5 KPI 카드
 *
 * 데이터 패칭:
 * - 마운트 시 9개 EP 를 Promise.allSettled 로 병렬 호출
 * - 한 EP 실패해도 다른 섹션 정상 노출 (각 섹션 독립 로딩/에러 상태)
 * - 기간 변경 시 시계열 EP 만 재호출 (agent-trends, latency, recommendation-funnel, support-automation)
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  MdSmartToy,
  MdSpeed,
  MdMouse,
  MdSupportAgent,
  MdChatBubble,
  MdRecommend,
  MdQuiz,
  MdPeople,
  MdToken,
  MdWarning,
  MdLayers,
  MdTrendingUp,
} from 'react-icons/md';
import StatsCard from '@/shared/components/StatsCard';
import {
  fetchAiSummary,
  fetchAgentTrends,
  fetchAgentSummary,
  fetchAiLatency,
  fetchAiModelComparison,
  fetchAiRecommendationFunnel,
  fetchAiSupportAutomation,
  fetchAiIntentDistributionV2,
  fetchAiQuotaStatsV2,
} from '../api/statsApi';

/** 기간 선택 옵션 (시계열 EP 4종 공통) */
const PERIOD_OPTIONS = [
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: '90d', label: '90일' },
];

/** 4 에이전트 라인 색상 (추이 차트 + KPI 카드 IconWrapper status 와 직접 연결되지는 않음) */
const AGENT_COLORS = {
  chat: '#6366f1',       // 보라 — 챗 에이전트
  recommend: '#10b981',  // 초록 — 추천 엔진
  support: '#f59e0b',    // 주황 — 고객센터
  quiz: '#ec4899',       // 핑크 — 퀴즈
};

/** 의도 분포 PieChart 색상 풀 */
const INTENT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

/** 펀넬 5단계 색상 (점진적 어둡게 — 단계별 감소 시각화) */
const FUNNEL_COLORS = ['#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81'];

/** 등급별 색상 (NORMAL → DIAMOND, 알갱이 → 몽아일체 팝콘 테마) */
const GRADE_COLORS = {
  NORMAL: '#94a3b8',
  BRONZE: '#cd7f32',
  SILVER: '#c0c0c0',
  GOLD: '#fbbf24',
  PLATINUM: '#a855f7',
  DIAMOND: '#06b6d4',
};

/** 숫자 포맷 — null/undefined 안전 처리 */
function fmt(val) {
  if (val === null || val === undefined) return '-';
  return Number(val).toLocaleString();
}

/** 소수점 1자리 포맷 — 비율/평균값 */
function fmt1(val) {
  if (val === null || val === undefined) return '-';
  return Number(val).toFixed(1);
}

/** 전일 대비 % 부호 처리 */
function signed(val) {
  if (val === null || val === undefined || Number.isNaN(val)) return '0%';
  const sign = val > 0 ? '+' : '';
  return `${sign}${fmt1(val)}%`;
}

/** 추이 차트 커스텀 Tooltip */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
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
    </TooltipBox>
  );
}

export default function AiServiceTab() {
  /* 시계열 EP 4종에 공통으로 적용되는 기간 */
  const [period, setPeriod] = useState('30d');
  /* 응답시간은 7일 기본 (운영 부하 고려) */
  const [latencyPeriod, setLatencyPeriod] = useState('7d');

  /* 9개 응답 상태 */
  const [summary, setSummary] = useState(null);
  const [agentTrends, setAgentTrends] = useState(null);
  const [agentSummary, setAgentSummary] = useState(null);
  const [latency, setLatency] = useState(null);
  const [modelComparison, setModelComparison] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [supportAutomation, setSupportAutomation] = useState(null);
  const [intents, setIntents] = useState(null);
  const [quota, setQuota] = useState(null);

  /* 섹션 별 로딩 상태 (한 EP 실패해도 다른 섹션 정상 노출) */
  const [loading, setLoading] = useState({
    summary: true, trends: true, agentSummary: true, latency: true,
    modelComparison: true, funnel: true, supportAutomation: true, intents: true, quota: true,
  });

  /** 9개 EP 병렬 호출 */
  const loadAll = useCallback(async (p, lp) => {
    setLoading({
      summary: true, trends: true, agentSummary: true, latency: true,
      modelComparison: true, funnel: true, supportAutomation: true, intents: true, quota: true,
    });

    const [
      summaryRes, trendsRes, agentSummaryRes, latencyRes,
      modelRes, funnelRes, supportRes, intentsRes, quotaRes,
    ] = await Promise.allSettled([
      fetchAiSummary(),
      fetchAgentTrends({ period: p }),
      fetchAgentSummary(),
      fetchAiLatency({ period: lp }),
      fetchAiModelComparison(),
      fetchAiRecommendationFunnel({ period: p }),
      fetchAiSupportAutomation({ period: p }),
      fetchAiIntentDistributionV2(),
      fetchAiQuotaStatsV2(),
    ]);

    if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
    if (trendsRes.status === 'fulfilled') setAgentTrends(trendsRes.value);
    if (agentSummaryRes.status === 'fulfilled') setAgentSummary(agentSummaryRes.value);
    if (latencyRes.status === 'fulfilled') setLatency(latencyRes.value);
    if (modelRes.status === 'fulfilled') setModelComparison(modelRes.value);
    if (funnelRes.status === 'fulfilled') setFunnel(funnelRes.value);
    if (supportRes.status === 'fulfilled') setSupportAutomation(supportRes.value);
    if (intentsRes.status === 'fulfilled') setIntents(intentsRes.value);
    if (quotaRes.status === 'fulfilled') setQuota(quotaRes.value);

    setLoading({
      summary: false, trends: false, agentSummary: false, latency: false,
      modelComparison: false, funnel: false, supportAutomation: false, intents: false, quota: false,
    });
  }, []);

  /** 시계열 EP 만 재호출 (period 변경 시) */
  const reloadTrends = useCallback(async (p) => {
    setLoading((prev) => ({ ...prev, trends: true, funnel: true, supportAutomation: true }));
    const [trendsRes, funnelRes, supportRes] = await Promise.allSettled([
      fetchAgentTrends({ period: p }),
      fetchAiRecommendationFunnel({ period: p }),
      fetchAiSupportAutomation({ period: p }),
    ]);
    if (trendsRes.status === 'fulfilled') setAgentTrends(trendsRes.value);
    if (funnelRes.status === 'fulfilled') setFunnel(funnelRes.value);
    if (supportRes.status === 'fulfilled') setSupportAutomation(supportRes.value);
    setLoading((prev) => ({ ...prev, trends: false, funnel: false, supportAutomation: false }));
  }, []);

  /** 응답시간 EP 만 재호출 */
  const reloadLatency = useCallback(async (lp) => {
    setLoading((prev) => ({ ...prev, latency: true }));
    try {
      const data = await fetchAiLatency({ period: lp });
      setLatency(data);
    } catch {
      // ignore — 섹션 별 로딩 메시지가 처리
    } finally {
      setLoading((prev) => ({ ...prev, latency: false }));
    }
  }, []);

  useEffect(() => {
    loadAll(period, latencyPeriod);
  }, [loadAll]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePeriodChange(p) {
    setPeriod(p);
    reloadTrends(p);
  }

  function handleLatencyPeriodChange(lp) {
    setLatencyPeriod(lp);
    reloadLatency(lp);
  }

  /* 안전 접근 alias */
  const s = summary ?? {};
  const trendItems = agentTrends?.trends ?? [];
  const ag = agentSummary ?? {};
  const chat = ag.chat ?? {};
  const rec = ag.recommend ?? {};
  const sup = ag.support ?? {};
  const qz = ag.quiz ?? {};
  const lat = latency ?? {};
  const latencyDaily = lat.daily ?? [];
  const models = modelComparison?.models ?? [];
  const funnelData = funnel ? buildFunnelChartData(funnel) : [];
  const automationDaily = supportAutomation?.daily ?? [];
  const hopBuckets = supportAutomation?.hopDistribution ?? [];
  const chatIntents = intents?.chat ?? [];
  const supportIntents = intents?.support ?? [];
  const q = quota ?? {};
  const gradeBuckets = q.byGrade ?? [];

  /* 1) 오늘 한눈에 — 4개 KPI */
  const summaryCards = [
    {
      key: 'todayCalls',
      icon: <MdSmartToy size={18} />,
      title: '오늘 AI 호출',
      value: loading.summary ? '...' : `${fmt(s.todayCalls)}회`,
      subtitle: `vs 어제 ${signed(s.dayOverDayPct)}`,
      status: 'info',
    },
    {
      key: 'avgLatency',
      icon: <MdSpeed size={18} />,
      title: '평균 응답시간',
      value: loading.summary ? '...' : `${fmt1(s.avgLatencyMs)}ms`,
      subtitle: '추천 엔진 최근 7일 평균',
      status: 'success',
    },
    {
      key: 'recommendCtr',
      icon: <MdMouse size={18} />,
      title: '추천 클릭률 (CTR)',
      value: loading.summary ? '...' : `${fmt1(s.recommendCtr)}%`,
      subtitle: '최근 30일 추천→클릭 전환',
      status: 'info',
    },
    {
      key: 'supportAuto',
      icon: <MdSupportAgent size={18} />,
      title: '고객센터 자동화율',
      value: loading.summary ? '...' : `${fmt1(s.supportAutomationRate)}%`,
      subtitle: `최근 30일 (1:1 유도 ${fmt1(100 - (s.supportAutomationRate ?? 0))}%)`,
      status: (s.supportAutomationRate ?? 100) >= 80 ? 'success' : 'warning',
    },
  ];

  /* 3) 에이전트별 건강도 — 4개 KPI 카드 */
  const agentHealthCards = [
    {
      key: 'chat',
      icon: <MdChatBubble size={18} />,
      title: '챗 에이전트',
      value: loading.agentSummary ? '...' : `${fmt(chat.totalSessions)}세션`,
      subtitle: `평균 ${fmt1(chat.avgTurns)}턴 · 오늘 ${fmt(chat.todaySessions)} · 의도 ${chat.topIntent ?? '-'}`,
      status: 'info',
    },
    {
      key: 'recommend',
      icon: <MdRecommend size={18} />,
      title: '추천 엔진',
      value: loading.agentSummary ? '...' : `${fmt(rec.totalRecommends)}건`,
      subtitle: `CTR ${fmt1(rec.ctr)}% · 외부검색 ${fmt1(rec.externalRatio)}% · 평점 ${fmt1(rec.avgScore)}`,
      status: 'success',
    },
    {
      key: 'support',
      icon: <MdSupportAgent size={18} />,
      title: '고객센터 챗봇',
      value: loading.agentSummary ? '...' : `${fmt(sup.totalLogs)}질의`,
      subtitle: `1:1 유도 ${fmt1(sup.escalationRate)}% · 평균 ${fmt1(sup.avgHopCount)}hop · 의도 ${sup.topIntent ?? '-'}`,
      status: (sup.escalationRate ?? 0) > 30 ? 'warning' : 'success',
    },
    {
      key: 'quiz',
      icon: <MdQuiz size={18} />,
      title: '퀴즈 에이전트',
      value: loading.agentSummary ? '...' : `${fmt(qz.totalAttempts)}응시`,
      subtitle: `정답률 ${fmt1(qz.correctRate)}% · 오늘 ${fmt(qz.todayAttempts)}`,
      status: 'info',
    },
  ];

  /* 8) 쿼터 — KPI 5개 */
  const quotaCards = [
    {
      key: 'users',
      icon: <MdPeople size={18} />,
      title: '쿼터 보유 사용자',
      value: loading.quota ? '...' : `${fmt(q.totalQuotaUsers)}명`,
      subtitle: 'AI 쿼터 레코드 보유자',
      status: 'info',
    },
    {
      key: 'avgDaily',
      icon: <MdSpeed size={18} />,
      title: '평균 일일 사용',
      value: loading.quota ? '...' : `${fmt1(q.avgDailyUsage)}회`,
      subtitle: '전체 사용자 평균',
      status: 'info',
    },
    {
      key: 'avgMonthly',
      icon: <MdLayers size={18} />,
      title: '평균 월간 쿠폰',
      value: loading.quota ? '...' : `${fmt1(q.avgMonthlyUsage)}회`,
      subtitle: '구매 이용권 월간 사용',
      status: 'info',
    },
    {
      key: 'tokens',
      icon: <MdToken size={18} />,
      title: '구매 이용권 합계',
      value: loading.quota ? '...' : `${fmt(q.totalPurchasedTokens)}개`,
      subtitle: '전체 보유 이용권',
      status: 'success',
    },
    {
      key: 'exhausted',
      icon: <MdWarning size={18} />,
      title: '한도 소진 사용자',
      value: loading.quota ? '...' : `${fmt(q.exhaustedUsers)}명`,
      subtitle: '등급별 daily_ai_limit 도달',
      status: (q.exhaustedUsers ?? 0) > 0 ? 'warning' : 'success',
    },
  ];

  return (
    <Wrapper>
      {/* ── 기간 선택 ── */}
      <FilterRow>
        <FilterLabel>추이/펀넬/자동화 기간</FilterLabel>
        <PeriodGroup>
          {PERIOD_OPTIONS.map((opt) => (
            <PeriodButton key={opt.value} $active={period === opt.value} onClick={() => handlePeriodChange(opt.value)}>
              {opt.label}
            </PeriodButton>
          ))}
        </PeriodGroup>
      </FilterRow>

      {/* ── 1) 오늘 한눈에 ── */}
      <SectionLabel>1. 오늘 한눈에</SectionLabel>
      <SectionDesc>4개 에이전트 합산 호출량과 핵심 운영 지표를 한 줄에 요약합니다.</SectionDesc>
      <KpiGrid4>
        {summaryCards.map((c) => (
          <StatsCard key={c.key} icon={c.icon} title={c.title} value={c.value} subtitle={c.subtitle} status={c.status} />
        ))}
      </KpiGrid4>

      {/* ── 2) 에이전트 호출량 추이 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>2. 에이전트별 호출량 추이</SectionLabel>
      <SectionDesc>챗·추천·고객센터·퀴즈 각각의 일별 호출량 추이를 비교합니다.</SectionDesc>
      <ChartCard>
        <ChartBody>
          {loading.trends ? (
            <LoadingMsg>차트 데이터를 불러오는 중...</LoadingMsg>
          ) : trendItems.length === 0 ? (
            <LoadingMsg>표시할 추이 데이터가 없습니다. (운영 환경에서 발생량 ≥ 1 이후 표시됩니다)</LoadingMsg>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendItems} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="chatTurns" name="챗 (턴)" stroke={AGENT_COLORS.chat} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="recommendCount" name="추천" stroke={AGENT_COLORS.recommend} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="supportSessions" name="고객센터" stroke={AGENT_COLORS.support} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="quizAttempts" name="퀴즈" stroke={AGENT_COLORS.quiz} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartBody>
      </ChartCard>

      {/* ── 3) 에이전트별 건강도 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>3. 에이전트별 건강도</SectionLabel>
      <SectionDesc>각 에이전트별 누적 호출량과 핵심 KPI 입니다.</SectionDesc>
      <KpiGrid4>
        {agentHealthCards.map((c) => (
          <StatsCard key={c.key} icon={c.icon} title={c.title} value={c.value} subtitle={c.subtitle} status={c.status} />
        ))}
      </KpiGrid4>

      {/* ── 4) 추천 펀넬 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>4. 추천 펀넬</SectionLabel>
      <SectionDesc>추천 → 클릭 → 상세 → 찜 → 시청 → 평점 5단계 사용자 전환을 측정합니다.</SectionDesc>
      <ChartCard>
        <ChartBody>
          {loading.funnel ? (
            <LoadingMsg>펀넬 데이터를 불러오는 중...</LoadingMsg>
          ) : !funnel || funnel.recommended === 0 ? (
            <LoadingMsg>표시할 펀넬 데이터가 없습니다.</LoadingMsg>
          ) : (
            <FunnelLayout>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={funnelData} layout="vertical" margin={{ top: 8, right: 32, left: 64, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} width={80} />
                  <Tooltip formatter={(value) => `${fmt(value)}건`} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {funnelData.map((_, idx) => (
                      <Cell key={`cell-${idx}`} fill={FUNNEL_COLORS[idx % FUNNEL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <FunnelMetric>
                <MetricBox>
                  <MetricLabel>1단계 CTR (추천→클릭)</MetricLabel>
                  <MetricValue>{fmt1(funnel.ctr)}%</MetricValue>
                </MetricBox>
                <MetricBox>
                  <MetricLabel>4단계 시청 전환율</MetricLabel>
                  <MetricValue>{fmt1(funnel.watchRate)}%</MetricValue>
                </MetricBox>
              </FunnelMetric>
            </FunnelLayout>
          )}
        </ChartBody>
      </ChartCard>

      {/* ── 5) 응답 시간 분포 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>5. 응답 시간 분포 (추천 엔진)</SectionLabel>
      <SectionDesc>p50/p95/p99 백분위와 일별 추이입니다. (p95 ≤ 1.5s 권장)</SectionDesc>
      <FilterRow style={{ marginBottom: '12px' }}>
        <FilterLabel>응답시간 기간</FilterLabel>
        <PeriodGroup>
          {PERIOD_OPTIONS.map((opt) => (
            <PeriodButton
              key={opt.value}
              $active={latencyPeriod === opt.value}
              onClick={() => handleLatencyPeriodChange(opt.value)}
            >
              {opt.label}
            </PeriodButton>
          ))}
        </PeriodGroup>
      </FilterRow>
      <KpiGrid3>
        <StatsCard
          icon={<MdSpeed size={18} />}
          title="p50 (중앙값)"
          value={loading.latency ? '...' : `${fmt(lat.p50)}ms`}
          subtitle="절반 이상이 이보다 빠름"
          status="success"
        />
        <StatsCard
          icon={<MdSpeed size={18} />}
          title="p95"
          value={loading.latency ? '...' : `${fmt(lat.p95)}ms`}
          subtitle="95% 사용자 기준 응답 한도"
          status={(lat.p95 ?? 0) > 1500 ? 'warning' : 'success'}
        />
        <StatsCard
          icon={<MdTrendingUp size={18} />}
          title="p99 (최악 1%)"
          value={loading.latency ? '...' : `${fmt(lat.p99)}ms`}
          subtitle="응답 지연 모니터링용"
          status={(lat.p99 ?? 0) > 3000 ? 'warning' : 'info'}
        />
      </KpiGrid3>
      <ChartCard>
        <ChartBody>
          {loading.latency ? (
            <LoadingMsg>응답시간 차트를 불러오는 중...</LoadingMsg>
          ) : latencyDaily.length === 0 ? (
            <LoadingMsg>응답시간 데이터가 없습니다.</LoadingMsg>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={latencyDaily} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} unit="ms" />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="p50" name="p50" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p95" name="p95" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartBody>
      </ChartCard>

      {/* ── 6) 의도 분포 (챗 / 고객센터 분리) ── */}
      <SectionLabel style={{ marginTop: '32px' }}>6. 사용자 의도 분포</SectionLabel>
      <SectionDesc>챗 에이전트와 고객센터 챗봇을 분리해 의도(intent)별 비율을 봅니다.</SectionDesc>
      <DualChartGrid>
        <ChartCard>
          <ChartTitle>챗 에이전트</ChartTitle>
          <ChartBody>
            {loading.intents ? (
              <LoadingMsg>의도 데이터를 불러오는 중...</LoadingMsg>
            ) : chatIntents.length === 0 ? (
              <LoadingMsg>챗 의도 데이터가 없습니다.</LoadingMsg>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={chatIntents}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percentage }) => `${name} ${fmt1(percentage)}%`}
                    labelLine={true}
                  >
                    {chatIntents.map((_, idx) => (
                      <Cell key={`chat-${idx}`} fill={INTENT_COLORS[idx % INTENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${fmt(v)}건`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartBody>
        </ChartCard>
        <ChartCard>
          <ChartTitle>고객센터 챗봇</ChartTitle>
          <ChartBody>
            {loading.intents ? (
              <LoadingMsg>의도 데이터를 불러오는 중...</LoadingMsg>
            ) : supportIntents.length === 0 ? (
              <LoadingMsg>고객센터 의도 데이터가 없습니다.</LoadingMsg>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={supportIntents}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percentage }) => `${name} ${fmt1(percentage)}%`}
                    labelLine={true}
                  >
                    {supportIntents.map((_, idx) => (
                      <Cell key={`sup-${idx}`} fill={INTENT_COLORS[idx % INTENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${fmt(v)}건`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartBody>
        </ChartCard>
      </DualChartGrid>

      {/* ── 7) 모델 버전별 비교 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>7. 모델 버전별 비교</SectionLabel>
      <SectionDesc>recommendation_log.model_version 별 성능 비교 — 어떤 모델이 가장 효율적인지 확인합니다.</SectionDesc>
      <ChartCard>
        {loading.modelComparison ? (
          <LoadingMsg>모델 데이터를 불러오는 중...</LoadingMsg>
        ) : models.length === 0 ? (
          <LoadingMsg>모델 비교 데이터가 없습니다.</LoadingMsg>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>모델 버전</Th>
                <Th>호출 수</Th>
                <Th>평균 점수</Th>
                <Th>평균 응답시간</Th>
                <Th>CTR</Th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.modelVersion ?? 'unknown'}>
                  <Td><strong>{m.modelVersion ?? 'unknown'}</strong></Td>
                  <Td>{fmt(m.count)}</Td>
                  <Td>{fmt1(m.avgScore)}</Td>
                  <Td>{fmt1(m.avgLatency)}ms</Td>
                  <Td>{fmt1(m.ctr)}%</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </ChartCard>

      {/* ── 8) 쿼터 소진 현황 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>8. AI 쿼터 소진 현황</SectionLabel>
      <SectionDesc>6 등급(알갱이~몽아일체) 차등 한도 기준으로 소진 사용자를 산정합니다.</SectionDesc>
      <KpiGrid5>
        {quotaCards.map((c) => (
          <StatsCard key={c.key} icon={c.icon} title={c.title} value={c.value} subtitle={c.subtitle} status={c.status} />
        ))}
      </KpiGrid5>
      <ChartCard>
        <ChartTitle>등급별 사용자 분포</ChartTitle>
        <ChartBody>
          {loading.quota ? (
            <LoadingMsg>등급 데이터를 불러오는 중...</LoadingMsg>
          ) : gradeBuckets.length === 0 ? (
            <LoadingMsg>등급별 데이터가 없습니다.</LoadingMsg>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={gradeBuckets} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="gradeName" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === '소진') return [`${fmt(value)}명`, name];
                    if (name === '평균 사용') return [`${fmt1(value)}회`, name];
                    return [fmt(value), name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="totalUsers" name="전체" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="exhausted" name="소진" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgDailyUsed" name="평균 사용" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartBody>
      </ChartCard>

      {/* ── 추가: 고객센터 자동화 추이 + hop ── */}
      <SectionLabel style={{ marginTop: '32px' }}>9. 고객센터 자동화 추이</SectionLabel>
      <SectionDesc>일별 자동 해결 / 1:1 유도 비율과 ReAct hop 분포입니다.</SectionDesc>
      <DualChartGrid>
        <ChartCard>
          <ChartTitle>일별 자동화율</ChartTitle>
          <ChartBody>
            {loading.supportAutomation ? (
              <LoadingMsg>자동화 데이터를 불러오는 중...</LoadingMsg>
            ) : automationDaily.length === 0 ? (
              <LoadingMsg>자동화 데이터가 없습니다.</LoadingMsg>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={automationDaily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" domain={[0, 100]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="rate" name="자동화율(%)" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartBody>
        </ChartCard>
        <ChartCard>
          <ChartTitle>ReAct hop 분포</ChartTitle>
          <ChartBody>
            {loading.supportAutomation ? (
              <LoadingMsg>hop 데이터를 불러오는 중...</LoadingMsg>
            ) : hopBuckets.length === 0 ? (
              <LoadingMsg>hop 데이터가 없습니다.</LoadingMsg>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={hopBuckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="hops" tick={{ fontSize: 12, fill: '#475569' }} label={{ value: 'hop', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip formatter={(v) => `${fmt(v)}건`} />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartBody>
        </ChartCard>
      </DualChartGrid>
    </Wrapper>
  );
}

/**
 * 펀넬 응답을 BarChart 데이터로 변환.
 * 백엔드 응답: { recommended, clicked, viewedDetail, addedToWishlist, watched, rated, ctr, watchRate }
 * 출력: [{name: '추천', count: N}, ...]
 */
function buildFunnelChartData(funnel) {
  return [
    { name: '추천', count: funnel.recommended ?? 0 },
    { name: '클릭', count: funnel.clicked ?? 0 },
    { name: '상세조회', count: funnel.viewedDetail ?? 0 },
    { name: '위시리스트', count: funnel.addedToWishlist ?? 0 },
    { name: '시청', count: funnel.watched ?? 0 },
    { name: '평점', count: funnel.rated ?? 0 },
  ];
}

/* ────────── styled-components ────────── */

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
  color: ${({ $active, theme }) => ($active ? '#ffffff' : theme.colors.textSecondary)};
  background: ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  transition: all ${({ theme }) => theme.transitions.fast};
  white-space: nowrap;
  & + & { border-left: 1px solid ${({ theme }) => theme.colors.border}; }
  &:hover { background: ${({ $active, theme }) => ($active ? theme.colors.primaryHover : theme.colors.bgHover)}; }
`;

const SectionLabel = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: 4px;
`;

const SectionDesc = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const ChartTitle = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const KpiGrid3 = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(180px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const KpiGrid4 = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  @media (max-width: 1080px) { grid-template-columns: repeat(2, 1fr); }
`;

const KpiGrid5 = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(160px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  @media (max-width: 1280px) { grid-template-columns: repeat(3, 1fr); }
`;

const ChartCard = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.xl};
  box-shadow: ${({ theme }) => theme.shadows.card};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const ChartBody = styled.div`
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const DualChartGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing.lg};
  @media (max-width: 1080px) { grid-template-columns: 1fr; }
`;

const FunnelLayout = styled.div`
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${({ theme }) => theme.spacing.xl};
  align-items: center;
  @media (max-width: 1080px) { grid-template-columns: 1fr; }
`;

const FunnelMetric = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const MetricBox = styled.div`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.bgHover};
  border-radius: 6px;
  min-width: 180px;
`;

const MetricLabel = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: 4px;
`;

const MetricValue = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xl};
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.primary};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  th, td {
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
    text-align: left;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }
`;

const Th = styled.th`
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textSecondary};
  background: ${({ theme }) => theme.colors.bgHover};
`;

const Td = styled.td`
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const LoadingMsg = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xxl};
`;

/* ── 차트 Tooltip 스타일 ── */
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
