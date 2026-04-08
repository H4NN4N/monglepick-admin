/**
 * 콘텐츠·이벤트 관리 페이지.
 *
 * 2026-04-08 신설:
 *  - 구 "운영 도구" 탭을 해체하면서, 사용자 참여형 게이미피케이션 콘텐츠만 모아
 *    별도 탭으로 분리. 도메인·기능별 명확한 목적을 가진 탭으로 정리함.
 *
 * 4개 서브탭:
 * - 도장깨기 템플릿: 로드맵 코스 CRUD (15편 코스)
 * - 퀴즈: 코스 퀴즈 CRUD
 * - 월드컵 후보: 이상형 월드컵 후보 영화 풀 관리
 * - OCR 이벤트: 영수증 OCR 이벤트 CRUD
 *
 * 이관된 서브탭 (다른 탭으로 흡수):
 *  업적 마스터 → 사용자 관리
 *  카테고리 → 게시판 관리
 *  영화/장르 마스터 → 영화 데이터
 *  포인트팩/리워드 정책 → 결제/포인트
 *  인기 검색어 → 통계/분석(검색)
 *  앱 공지 → 고객센터(공지사항 통합)
 */

import { useState } from 'react';
import styled from 'styled-components';
import RoadmapCourseTab from '../components/RoadmapCourseTab';
import QuizManagementTab from '../components/QuizManagementTab';
import WorldcupCandidateTab from '../components/WorldcupCandidateTab';
import OcrEventTab from '../components/OcrEventTab';

/** 서브탭 정의 */
const SUB_TABS = [
  { key: 'roadmap_course',     label: '도장깨기 템플릿' },
  { key: 'quiz',               label: '퀴즈' },
  { key: 'worldcup_candidate', label: '월드컵 후보' },
  { key: 'ocr_event',          label: 'OCR 이벤트' },
];

export default function ContentEventsPage() {
  const [activeTab, setActiveTab] = useState('roadmap_course');

  return (
    <Wrapper>
      {/* 페이지 헤더 */}
      <PageHeader>
        <PageTitle>콘텐츠·이벤트</PageTitle>
        <PageDesc>
          도장깨기 코스, 퀴즈, 이상형 월드컵 후보, 영수증 OCR 이벤트 등
          사용자 참여형 콘텐츠를 관리합니다.
        </PageDesc>
      </PageHeader>

      {/* 서브탭 네비게이션 */}
      <TabNav>
        {SUB_TABS.map((tab) => (
          <TabButton
            key={tab.key}
            $active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </TabButton>
        ))}
      </TabNav>

      {/* 서브탭 콘텐츠 */}
      <TabContent>
        {activeTab === 'roadmap_course' && <RoadmapCourseTab />}
        {activeTab === 'quiz' && <QuizManagementTab />}
        {activeTab === 'worldcup_candidate' && <WorldcupCandidateTab />}
        {activeTab === 'ocr_event' && <OcrEventTab />}
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
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  border-bottom: 2px solid ${({ $active, theme }) =>
    $active ? theme.colors.primary : 'transparent'};
  transition: all ${({ theme }) => theme.transitions.fast};
  margin-bottom: -1px;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const TabContent = styled.div``;
