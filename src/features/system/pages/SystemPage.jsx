/**
 * 시스템 탭 메인 페이지.
 *
 * 2026-04-08 개편:
 *  - 구 "설정 > 감사 로그"를 본 탭으로 이동 (조회 전용 성격 통합)
 *  - 단일 세로 스택 → 서브탭 구조로 전환 (5개 섹션을 탭으로 분리)
 *
 * 5개 서브탭 (모두 조회 전용):
 *  - 서비스 상태: 서비스 헬스체크
 *  - DB 상태: 5개 DB 커넥션/쿼리 상태
 *  - Ollama: 로컬 LLM 상태
 *  - 설정 조회: 현재 런타임 설정값
 *  - 감사 로그: 관리자 활동 감사 로그 (구 설정 탭에서 이관)
 */

import { useState } from 'react';
import styled from 'styled-components';
import ServiceStatus from '../components/ServiceStatus';
import DbStatus from '../components/DbStatus';
import OllamaStatus from '../components/OllamaStatus';
import ConfigViewer from '../components/ConfigViewer';
import AuditLogTab from '../components/AuditLogTab';

/** 서브탭 정의 */
const TABS = [
  { key: 'service', label: '서비스 상태' },
  { key: 'db',      label: 'DB 상태' },
  { key: 'ollama',  label: 'Ollama' },
  { key: 'config',  label: '설정 조회' },
  { key: 'audit',   label: '감사 로그' },
];

export default function SystemPage() {
  const [activeTab, setActiveTab] = useState('service');

  return (
    <Wrapper>
      <PageHeader>
        <PageTitle>시스템</PageTitle>
        <PageDesc>
          서비스 헬스체크, DB/LLM 상태, 현재 설정값, 관리자 감사 로그를 확인합니다.
          (모두 조회 전용)
        </PageDesc>
      </PageHeader>

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

      <TabContent>
        {activeTab === 'service' && <ServiceStatus />}
        {activeTab === 'db'      && <DbStatus />}
        {activeTab === 'ollama'  && <OllamaStatus />}
        {activeTab === 'config'  && <ConfigViewer />}
        {activeTab === 'audit'   && <AuditLogTab />}
      </TabContent>
    </Wrapper>
  );
}

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

const TabBar = styled.div`
  display: flex;
  gap: 2px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  border-bottom: 2px solid ${({ $active, theme }) =>
    $active ? theme.colors.primary : 'transparent'};
  transition: all ${({ theme }) => theme.transitions.fast};
  margin-bottom: -1px;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const TabContent = styled.div``;
