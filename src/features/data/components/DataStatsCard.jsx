/**
 * 데이터 현황 카드 컴포넌트.
 * 5DB 전체 건수, 소스별 분포, 품질 점수 3개를 StatsCard 형태로 표시.
 * fetchDataStats + fetchDataHealth + fetchDataQuality 병렬 호출.
 *
 * @param {Object} props - 없음 (자체 데이터 fetch)
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdStorage, MdVerified, MdSpeed } from 'react-icons/md';
import StatsCard from '@/shared/components/StatsCard';
import StatusBadge from '@/shared/components/StatusBadge';
import { fetchDataStats, fetchDataHealth, fetchDataQuality } from '../api/dataApi';

/** 소스 한국어 라벨 매핑 */
const SOURCE_LABELS = {
  tmdb: 'TMDB',
  kobis: 'KOBIS',
  kmdb: 'KMDb',
  kaggle: 'Kaggle',
  manual: '수동 등록',
};

/** 품질 점수 색상 기준 */
function getQualityStatus(score) {
  if (score >= 90) return 'success';
  if (score >= 70) return 'warning';
  return 'error';
}

export default function DataStatsCard() {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [quality, setQuality] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /** 3개 API 병렬 조회 */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, healthRes, qualityRes] = await Promise.allSettled([
        fetchDataStats(),
        fetchDataHealth(),
        fetchDataQuality(),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value);
      if (qualityRes.status === 'fulfilled') setQuality(qualityRes.value);

      // 모두 실패한 경우만 에러 표시
      if (
        statsRes.status === 'rejected' &&
        healthRes.status === 'rejected' &&
        qualityRes.status === 'rejected'
      ) {
        setError('데이터를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /** 전체 영화 건수 포맷 */
  const totalMovies = stats?.totalMovies != null
    ? stats.totalMovies.toLocaleString() + '건'
    : '-';

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>데이터 현황</SectionTitle>
        <RefreshButton onClick={loadAll} disabled={loading} title="새로고침">
          <MdRefresh size={16} />
        </RefreshButton>
      </SectionHeader>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      {/* 상단: 요약 StatsCard 3개 */}
      <StatsRow>
        <StatsCard
          icon={<MdStorage />}
          title="전체 영화 수"
          value={totalMovies}
          subtitle={stats?.lastUpdated ? `최종 갱신: ${new Date(stats.lastUpdated).toLocaleDateString('ko-KR')}` : ''}
          status="info"
        />
        <StatsCard
          icon={<MdVerified />}
          title="5DB 동기화 상태"
          value={health?.syncRate != null ? `${health.syncRate}%` : '-'}
          subtitle={health?.status === 'ok' ? '정상 동기화' : (health?.status ?? '확인 중')}
          status={health?.status === 'ok' ? 'success' : 'warning'}
        />
        <StatsCard
          icon={<MdSpeed />}
          title="평균 데이터 품질"
          value={quality?.average != null ? `${quality.average}점` : '-'}
          subtitle="정확도·완결성·일관성 평균"
          status={quality?.average != null ? getQualityStatus(quality.average) : 'default'}
        />
      </StatsRow>

      {/* 중단: 소스별 분포 */}
      {stats?.bySource && (
        <SubSection>
          <SubTitle>소스별 분포</SubTitle>
          <SourceGrid>
            {Object.entries(stats.bySource).map(([key, count]) => (
              <SourceCard key={key}>
                <SourceLabel>{SOURCE_LABELS[key] || key}</SourceLabel>
                <SourceCount>{count.toLocaleString()}</SourceCount>
                <SourceBar
                  $ratio={stats.totalMovies > 0 ? count / stats.totalMovies : 0}
                />
              </SourceCard>
            ))}
          </SourceGrid>
        </SubSection>
      )}

      {/* 하단: 품질 점수 상세 */}
      {quality && (
        <SubSection>
          <SubTitle>품질 점수 상세</SubTitle>
          <QualityRow>
            {[
              { key: 'accuracy', label: '정확도' },
              { key: 'completeness', label: '완결성' },
              { key: 'consistency', label: '일관성' },
            ].map(({ key, label }) => {
              const score = quality[key];
              return (
                <QualityItem key={key}>
                  <QualityLabel>{label}</QualityLabel>
                  <QualityScore $status={score != null ? getQualityStatus(score) : 'default'}>
                    {score != null ? score : '-'}
                  </QualityScore>
                  <StatusBadge
                    status={score != null ? getQualityStatus(score) : 'default'}
                    label={score != null ? (score >= 90 ? '우수' : score >= 70 ? '보통' : '미흡') : '확인 중'}
                  />
                </QualityItem>
              );
            })}
          </QualityRow>
        </SubSection>
      )}
    </Section>
  );
}

/* ── styled-components ── */

const Section = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.heading};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
`;

const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.textSecondary};
  border: 1px solid ${({ theme }) => theme.colors.border};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover { background: ${({ theme }) => theme.colors.bgHover}; }
  &:disabled { opacity: 0.5; }
`;

const ErrorMsg = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const SubSection = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const SubTitle = styled.h4`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const SourceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
`;

const SourceCard = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.lg};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const SourceLabel = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const SourceCount = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xl};
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.fonts.mono};
`;

const SourceBar = styled.div`
  height: 4px;
  border-radius: 2px;
  background: ${({ theme }) => theme.colors.primary};
  width: ${({ $ratio }) => `${Math.round($ratio * 100)}%`};
  min-width: 4px;
  opacity: 0.7;
`;

const QualityRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.spacing.lg};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const QualityItem = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.xl};
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const QualityLabel = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
`;

const QualityScore = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xxl};
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ $status, theme }) =>
    $status === 'success' ? theme.colors.success :
    $status === 'error' ? theme.colors.error :
    $status === 'warning' ? theme.colors.warning :
    theme.colors.textPrimary};
`;
