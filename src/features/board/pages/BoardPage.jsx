/**
 * 게시판 관리 메인 페이지.
 *
 * 2026-04-08 개편:
 *  - 구 "콘텐츠 관리" → "게시판 관리"로 이름 변경
 *  - 카테고리 탭 흡수 (운영 도구에서 이관 — 게시글 카테고리는 게시판 도메인)
 *
 * 5개 서브탭:
 * - 신고 관리: 신고 목록 + 블라인드/삭제/무시 조치
 * - 혐오표현: 독성 로그 + 복원/삭제/경고 조치
 * - 게시글: 게시글 수정/삭제 + 키워드/카테고리 필터
 * - 리뷰: 리뷰 삭제 + 영화ID/평점 필터
 * - 카테고리: 게시글 상위/하위 카테고리 CRUD
 *
 * 탭 전환 시 각 컴포넌트의 로컬 상태(필터, 페이지)를 보존하기 위해
 * $visible prop 기반 display:none 방식으로 처리합니다.
 */

import { useState } from 'react';
import styled from 'styled-components';
import ReportTab from '../components/ReportTab';
import ToxicityTab from '../components/ToxicityTab';
import PostTab from '../components/PostTab';
import ReviewTab from '../components/ReviewTab';
import CategoryTab from '../components/CategoryTab';

/** 서브탭 정의 */
const TABS = [
  { key: 'reports',    label: '신고 관리' },
  { key: 'toxicity',   label: '혐오표현' },
  { key: 'posts',      label: '게시글' },
  { key: 'reviews',    label: '리뷰' },
  { key: 'categories', label: '카테고리' },
];

export default function BoardPage() {
  /** 현재 활성 탭 키 (기본: 신고 관리) */
  const [activeTab, setActiveTab] = useState('reports');

  /** 방문한 탭 Set — 처음 방문 시에만 마운트 */
  const [visited, setVisited] = useState(() => new Set(['reports']));

  function handleTabClick(key) {
    setActiveTab(key);
    setVisited((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }

  return (
    <Wrapper>
      {/* ── 페이지 헤더 ── */}
      <PageHeader>
        <PageTitle>게시판 관리</PageTitle>
        <PageDesc>
          신고 처리, 혐오표현 로그, 게시글·리뷰 관리, 게시글 카테고리 마스터를 담당합니다.
        </PageDesc>
      </PageHeader>

      {/* ── 서브탭 네비게이션 ── */}
      <TabNav>
        {TABS.map((tab) => (
          <TabButton
            key={tab.key}
            $active={activeTab === tab.key}
            onClick={() => handleTabClick(tab.key)}
          >
            {tab.label}
          </TabButton>
        ))}
      </TabNav>

      {/* ── 탭 콘텐츠 영역 ── */}
      <TabPanel>
        <TabContent $visible={activeTab === 'reports'}>
          {visited.has('reports') && <ReportTab />}
        </TabContent>
        <TabContent $visible={activeTab === 'toxicity'}>
          {visited.has('toxicity') && <ToxicityTab />}
        </TabContent>
        <TabContent $visible={activeTab === 'posts'}>
          {visited.has('posts') && <PostTab />}
        </TabContent>
        <TabContent $visible={activeTab === 'reviews'}>
          {visited.has('reviews') && <ReviewTab />}
        </TabContent>
        <TabContent $visible={activeTab === 'categories'}>
          {visited.has('categories') && <CategoryTab />}
        </TabContent>
      </TabPanel>
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
`;

const PageDesc = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TabNav = styled.nav`
  display: flex;
  border-bottom: 2px solid ${({ theme }) => theme.colors.border};
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
  gap: 0;
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  padding: 10px 20px;
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ $active, theme }) =>
    $active ? theme.fontWeights.semibold : theme.fontWeights.normal};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  border-bottom: 2px solid ${({ $active, theme }) =>
    $active ? theme.colors.primary : 'transparent'};
  margin-bottom: -2px; /* border-bottom 겹침 보정 */
  transition: all ${({ theme }) => theme.transitions.fast};
  white-space: nowrap;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const TabPanel = styled.div``;

/**
 * 탭 콘텐츠 래퍼.
 * $visible=false 일 때 display:none으로 숨김 — 컴포넌트 마운트 상태 유지.
 */
const TabContent = styled.div`
  display: ${({ $visible }) => ($visible ? 'block' : 'none')};
`;
