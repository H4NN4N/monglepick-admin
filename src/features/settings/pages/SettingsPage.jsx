/**
 * 설정 탭 메인 페이지.
 *
 * 2026-04-08 개편:
 *  - 감사 로그 서브탭 제거 → 시스템 탭으로 이관 (조회 전용 성격 통합)
 *  - 설정 탭은 순수 CRUD 전용 3개 서브탭으로 정리
 *
 * 3개 서브탭:
 *  - 약관/정책: 약관 CRUD + 버전 관리
 *  - 배너: 마케팅 배너 CRUD
 *  - 관리자 계정: 관리자 역할 부여/박탈
 */

import { useState } from 'react';
import styled from 'styled-components';
import TermsTab from '../components/TermsTab';
import BannerTab from '../components/BannerTab';
import AdminAccountTab from '../components/AdminAccountTab';

const TABS = [
  { key: 'terms',   label: '약관/정책' },
  { key: 'banners', label: '배너' },
  { key: 'admins',  label: '관리자 계정' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('terms');

  return (
    <Wrapper>
      <PageHeader>
        <PageTitle>설정</PageTitle>
        <PageDesc>약관/정책, 배너, 관리자 계정을 관리합니다.</PageDesc>
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
        {activeTab === 'terms'   && <TermsTab />}
        {activeTab === 'banners' && <BannerTab />}
        {activeTab === 'admins'  && <AdminAccountTab />}
      </TabContent>
    </Wrapper>
  );
}

const Wrapper = styled.div``;
const PageHeader = styled.div`margin-bottom:${({theme})=>theme.spacing.xl};`;
const PageTitle = styled.h2`font-size:${({theme})=>theme.fontSizes.xxl};font-weight:${({theme})=>theme.fontWeights.bold};margin-bottom:${({theme})=>theme.spacing.xs};`;
const PageDesc = styled.p`font-size:${({theme})=>theme.fontSizes.md};color:${({theme})=>theme.colors.textMuted};`;
const TabBar = styled.div`display:flex;gap:${({theme})=>theme.spacing.sm};margin-bottom:${({theme})=>theme.spacing.xl};border-bottom:1px solid ${({theme})=>theme.colors.border};padding-bottom:${({theme})=>theme.spacing.sm};`;
const TabButton = styled.button`padding:${({theme})=>theme.spacing.sm} ${({theme})=>theme.spacing.md};border:none;background:${({$active,theme})=>$active?theme.colors.primary:'transparent'};color:${({$active})=>$active?'#fff':'inherit'};border-radius:${({theme})=>theme.layout.cardRadius};cursor:pointer;font-size:${({theme})=>theme.fontSizes.sm};font-weight:${({$active,theme})=>$active?theme.fontWeights.semibold:theme.fontWeights.normal};transition:all 0.2s;&:hover{background:${({$active,theme})=>$active?theme.colors.primary:theme.colors.bgHover};}`;
const TabContent = styled.div``;
