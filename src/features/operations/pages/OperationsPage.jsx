/**
 * 운영 도구 탭 메인 페이지.
 *
 * 마스터 데이터 + 운영 도구 통합 페이지로, 향후 13개 추가 기능의 서브탭을 모은다.
 * 1단계 (Phase 1-3) — "업적 마스터" 서브탭 추가
 * 2단계 (Phase 2-1) — "도장깨기 템플릿"
 * 2단계 (Phase 2-2) — "퀴즈"
 * 3단계 (Phase 3-2) — "장르 마스터"
 * 3단계 (Phase 3-3) — "OCR 이벤트"
 * 4단계 (Phase 4-1) — "인기 검색어"
 * 4단계 (Phase 4-2) — "월드컵 후보"
 * 5단계 (Phase 5-1) — "포인트팩"
 * 5단계 (Phase 5-2) — "카테고리"
 * 5단계 (Phase 5-3) — "리워드 정책"
 *
 * 현재 활성화된 서브탭은 추후 phase에서 점진적으로 추가된다.
 */

import { useState } from 'react';
import styled from 'styled-components';
import AchievementMasterTab from '../components/AchievementMasterTab';
import RoadmapCourseTab from '../components/RoadmapCourseTab';
import QuizManagementTab from '../components/QuizManagementTab';
import MovieMasterTab from '../components/MovieMasterTab';
import GenreMasterTab from '../components/GenreMasterTab';
import OcrEventTab from '../components/OcrEventTab';
import PopularSearchTab from '../components/PopularSearchTab';
import WorldcupCandidateTab from '../components/WorldcupCandidateTab';
import PointPackTab from '../components/PointPackTab';
import CategoryTab from '../components/CategoryTab';
import RewardPolicyTab from '../components/RewardPolicyTab';

/**
 * 서브탭 정의.
 *
 * disabled=true 인 항목은 향후 phase에서 활성화되며,
 * 클릭 시 "준비 중" 안내가 표시된다.
 */
const SUB_TABS = [
  { key: 'achievement', label: '업적 마스터', disabled: false },
  { key: 'roadmap_course', label: '도장깨기 템플릿', disabled: false },
  { key: 'quiz', label: '퀴즈', disabled: false },
  { key: 'movie', label: '영화 마스터', disabled: false },
  { key: 'genre', label: '장르 마스터', disabled: false },
  { key: 'ocr_event', label: 'OCR 이벤트', disabled: false },
  { key: 'popular_search', label: '인기 검색어', disabled: false },
  { key: 'worldcup_candidate', label: '월드컵 후보', disabled: false },
  { key: 'point_pack', label: '포인트팩', disabled: false },
  { key: 'category', label: '카테고리', disabled: false },
  { key: 'reward_policy', label: '리워드 정책', disabled: false },
];

export default function OperationsPage() {
  const [activeTab, setActiveTab] = useState('achievement');

  return (
    <Wrapper>
      {/* 페이지 헤더 */}
      <PageHeader>
        <PageTitle>운영 도구</PageTitle>
        <PageDesc>
          업적·도장깨기·퀴즈·장르·카테고리·리워드 정책 등 마스터 데이터와
          운영 도구(인기 검색어/월드컵 후보/OCR 이벤트)를 통합 관리합니다.
        </PageDesc>
      </PageHeader>

      {/* 서브탭 네비게이션 */}
      <TabNav>
        {SUB_TABS.map((tab) => (
          <TabButton
            key={tab.key}
            $active={activeTab === tab.key}
            $disabled={tab.disabled}
            onClick={() => !tab.disabled && setActiveTab(tab.key)}
            title={tab.disabled ? '준비 중 — 향후 단계에서 활성화됩니다' : tab.label}
          >
            {tab.label}
            {tab.disabled && <Badge>준비중</Badge>}
          </TabButton>
        ))}
      </TabNav>

      {/* 서브탭 콘텐츠 */}
      <TabContent>
        {activeTab === 'achievement' && <AchievementMasterTab />}
        {activeTab === 'roadmap_course' && <RoadmapCourseTab />}
        {activeTab === 'quiz' && <QuizManagementTab />}
        {activeTab === 'movie' && <MovieMasterTab />}
        {activeTab === 'genre' && <GenreMasterTab />}
        {activeTab === 'ocr_event' && <OcrEventTab />}
        {activeTab === 'popular_search' && <PopularSearchTab />}
        {activeTab === 'worldcup_candidate' && <WorldcupCandidateTab />}
        {activeTab === 'point_pack' && <PointPackTab />}
        {activeTab === 'category' && <CategoryTab />}
        {activeTab === 'reward_policy' && <RewardPolicyTab />}
      </TabContent>
    </Wrapper>
  );
}

/* ── styled-components ── */

const Wrapper = styled.div``;

const PageHeader = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
`;

const PageTitle = styled.h2`
  font-size: ${({ theme }) => theme.fontSizes.xxl};
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const PageDesc = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TabNav = styled.div`
  display: flex;
  gap: 2px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ $active, $disabled, theme }) => {
    if ($disabled) return theme.colors.textMuted;
    return $active ? theme.colors.primary : theme.colors.textSecondary;
  }};
  border-bottom: 2px solid ${({ $active, theme }) =>
    $active ? theme.colors.primary : 'transparent'};
  transition: all ${({ theme }) => theme.transitions.fast};
  margin-bottom: -1px;
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};

  &:hover {
    color: ${({ $disabled, theme }) =>
      $disabled ? theme.colors.textMuted : theme.colors.primary};
  }
`;

const Badge = styled.span`
  font-size: 10px;
  padding: 1px 6px;
  background: ${({ theme }) => theme.colors.bgHover};
  border-radius: 8px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TabContent = styled.div``;
