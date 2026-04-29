/**
 * 학습·도전 활동 분석 탭 컴포넌트.
 *
 * v3.6 (2026-04-28) 재구성:
 * - 탭 라벨: "콘텐츠 성과" → "학습·도전 활동" (이름이 모호하던 문제 해결)
 *   콘텐츠가 무엇을 의미하는지 불분명했음 — 실제 내용은 도장깨기 코스 + 업적 + 영화 퀴즈
 * - 리뷰 품질 섹션 제거 — 학습·도전 활동과 무관, 별도 탭(커뮤니티)으로 이관 예정
 *   백엔드 /content-performance/review-quality API 자체는 유지 (다른 화면에서 재사용 가능)
 * - 안내 박스 추가
 * - 차트 제목·툴팁·라벨 평이한 한국어로 정리
 *
 * 구성:
 * 1. 안내 박스
 * 2. KPI 카드 5개 (코스 진행/완주/업적 달성/퀴즈 시도/퀴즈 정답률)
 * 3. 코스별 시작자 vs 완주자 비교 BarChart (가로형)
 *
 * 데이터 패칭:
 * - Promise.allSettled 로 2개 API 병렬 호출 (overview, course-completion)
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
import {
  MdSchool,
  MdCheckCircle,
  MdEmojiEvents,
  MdQuiz,
  MdPercent,
  MdInfoOutline,
} from 'react-icons/md';
import StatsCard from '@/shared/components/StatsCard';
import {
  fetchContentPerformanceOverview,
  fetchCourseCompletion,
} from '../api/statsApi';

/** 숫자 포맷 (천 단위 콤마) */
function fmt(val) {
  if (val === null || val === undefined) return '-';
  return Number(val).toLocaleString();
}

export default function ContentPerformanceTab() {
  /* 개요 KPI */
  const [overview, setOverview] = useState(null);
  const [ovLoading, setOvLoading] = useState(true);
  const [ovError, setOvError] = useState(null);

  /* 코스 완주율 */
  const [courses, setCourses] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);

  /** 최초 마운트: 2개 API 병렬 호출 (review-quality 는 v3.6 부터 호출하지 않음) */
  const loadAll = useCallback(async () => {
    setOvLoading(true);
    setCourseLoading(true);
    setOvError(null);

    const [ovRes, courseRes] = await Promise.allSettled([
      fetchContentPerformanceOverview(),
      fetchCourseCompletion(),
    ]);

    if (ovRes.status === 'fulfilled') setOverview(ovRes.value);
    else setOvError(ovRes.reason?.message ?? '학습·도전 개요를 불러올 수 없습니다.');
    setOvLoading(false);

    if (courseRes.status === 'fulfilled') setCourses(courseRes.value);
    setCourseLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* 안전 접근 */
  const ov = overview ?? {};
  const courseItems = courses?.courses ?? [];

  /** KPI 카드 정의 */
  const kpiCards = [
    {
      key: 'courseProgress',
      icon: <MdSchool size={18} />,
      title: '코스 진행',
      value: ovLoading ? '...' : `${fmt(ov.totalCourseProgress)}건`,
      subtitle: '도장깨기 코스를 시작한 누적 건수',
      status: 'info',
    },
    {
      key: 'courseCompleted',
      icon: <MdCheckCircle size={18} />,
      title: '코스 완주',
      value: ovLoading ? '...' : `${fmt(ov.completedCourses)}건`,
      subtitle: '코스를 끝까지 완료한 누적 건수',
      status: 'success',
    },
    {
      key: 'achievements',
      icon: <MdEmojiEvents size={18} />,
      title: '업적 달성',
      value: ovLoading ? '...' : `${fmt(ov.totalAchievements)}건`,
      subtitle: '사용자가 획득한 누적 업적 수',
      status: 'success',
    },
    {
      key: 'quizAttempts',
      icon: <MdQuiz size={18} />,
      title: '퀴즈 시도',
      value: ovLoading ? '...' : `${fmt(ov.totalQuizAttempts)}회`,
      subtitle: '영화 퀴즈를 푼 누적 횟수',
      status: 'info',
    },
    {
      key: 'quizCorrectRate',
      icon: <MdPercent size={18} />,
      title: '퀴즈 정답률',
      value: ovLoading ? '...' : `${ov.quizCorrectRate ?? 0}%`,
      subtitle: '전체 시도 대비 정답 비율',
      status: (ov.quizCorrectRate ?? 0) >= 60 ? 'success' : 'warning',
    },
  ];

  return (
    <Wrapper>
      {/* ── 안내 박스 ── */}
      <InfoBox>
        <InfoIcon><MdInfoOutline size={20} /></InfoIcon>
        <InfoText>
          <strong>이 탭의 목적</strong> — 사용자가 <em>도장깨기 코스 · 업적 · 영화 퀴즈</em> 같은
          학습·도전 콘텐츠에 얼마나 참여하고, 끝까지 완주하는지 확인합니다.
          코스별 시작자 대비 완주자 차이가 큰 코스는 난이도·동기부여 점검 대상입니다.
        </InfoText>
      </InfoBox>

      {/* ── KPI 카드 ── */}
      <SectionLabel>학습·도전 활동 지표</SectionLabel>
      {ovError && <ErrorMsg>{ovError}</ErrorMsg>}
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

      {/* ── 코스별 시작자 vs 완주자 비교 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>코스별 시작자 / 완주자</SectionLabel>
      <ChartCard>
        <ChartTitle>도장깨기 코스 — 시작한 사람 vs 끝까지 완주한 사람</ChartTitle>
        <ChartBody>
          {courseLoading ? (
            <LoadingMsg>데이터를 불러오는 중...</LoadingMsg>
          ) : courseItems.length === 0 ? (
            <LoadingMsg>표시할 코스 데이터가 없습니다.</LoadingMsg>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, courseItems.length * 50)}>
              <BarChart
                data={courseItems}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 100, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="courseId"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'started')   return [`${fmt(value)}명`, '시작한 사람'];
                    if (name === 'completed') return [`${fmt(value)}명`, '완주한 사람'];
                    return [`${fmt(value)}명`, name];
                  }}
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                />
                <Bar dataKey="totalStarters"  name="started"   fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={16} />
                <Bar dataKey="completedCount" name="completed" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartBody>
      </ChartCard>
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
const KpiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
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
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
`;
const LoadingMsg = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
`;
