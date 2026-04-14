/**
 * AI 운영 탭 메인 페이지.
 * 4개 서브탭: AI 트리거 | 생성 이력 | 챗봇 로그 | 리뷰 인증.
 *
 * 2026-04-14: '리뷰 인증' 서브탭 추가 — 도장깨기 리뷰를 AI 가 "영화 줄거리 ↔ 리뷰 유사도" 로
 * 판정한 시청 인증 기록을 관리자가 모니터링/오버라이드한다. 에이전트 자체는 추후 개발 예정.
 */

import { useState } from 'react';
import styled from 'styled-components';
import AiTriggerPanel from '../components/AiTriggerPanel';
import GenerationHistory from '../components/GenerationHistory';
import ChatLogViewer from '../components/ChatLogViewer';
import ReviewVerificationTab from '../components/ReviewVerificationTab';

/** 서브탭 목록 */
const TABS = [
  { key: 'trigger',     label: 'AI 트리거' },
  { key: 'history',     label: '생성 이력' },
  { key: 'chatlog',     label: '챗봇 로그' },
  { key: 'review-verify', label: '리뷰 인증' },
];

export default function AiOpsPage() {
  const [activeTab, setActiveTab] = useState('trigger');

  return (
    <Wrapper>
      <PageHeader>
        <PageTitle>AI 운영</PageTitle>
        <PageDesc>퀴즈/리뷰 생성 트리거, 챗봇 대화 로그, 도장깨기 리뷰 인증을 관리합니다.</PageDesc>
      </PageHeader>

      {/* 서브탭 네비게이션 */}
      <TabBar>
        {TABS.map((tab) => (
          <TabButton
            key={tab.key}
            $active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </TabButton>
        ))}
      </TabBar>

      {/* 탭 내용 */}
      <TabContent>
        {activeTab === 'trigger' && <AiTriggerPanel />}
        {activeTab === 'history' && <GenerationHistory />}
        {activeTab === 'chatlog' && <ChatLogViewer />}
        {activeTab === 'review-verify' && <ReviewVerificationTab />}
      </TabContent>
    </Wrapper>
  );
}

const Wrapper = styled.div``;

const PageHeader = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xl};
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

const TabBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  padding-bottom: ${({ theme }) => theme.spacing.sm};
`;

const TabButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: none;
  background: ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  color: ${({ $active, theme }) => ($active ? '#fff' : theme.colors.textPrimary)};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ $active, theme }) => ($active ? theme.fontWeights.semibold : theme.fontWeights.normal)};
  transition: all 0.2s;

  &:hover {
    background: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.bgHover)};
  }
`;

const TabContent = styled.div``;
