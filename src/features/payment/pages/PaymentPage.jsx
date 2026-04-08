/**
 * 결제 / 포인트 관리 탭 메인 페이지.
 *
 * 2026-04-08 개편:
 *  - "포인트팩" / "리워드 정책" 서브탭 흡수 (구 운영 도구 → 포인트 경제 도메인 통합)
 *
 * 6개 서브탭:
 * - 결제 내역: 전체 결제 주문 조회/환불, 보상 실패 건 수동 처리
 * - 구독 관리: 구독 목록 조회, 수동 취소/연장
 * - 포인트 관리: 수동 지급/차감, 사용자 이력 조회
 * - 포인트 아이템: 교환 아이템 목록 조회 및 인라인 수정
 * - 포인트팩: 결제 포인트 팩 CRUD (가격/지급량) — 신규 흡수
 * - 리워드 정책: 55종 활동 리워드 정책 CRUD — 신규 흡수
 *
 * 탭 상태는 URL 쿼리 파라미터(tab)로 동기화하지 않고
 * 단순 useState로 관리한다 (페이지 새로고침 시 첫 탭으로 초기화).
 *
 * @module PaymentPage
 */

import { useState } from 'react';
import styled from 'styled-components';
import PaymentOrderTable from '../components/PaymentOrderTable';
import SubscriptionTable from '../components/SubscriptionTable';
import PointManagement from '../components/PointManagement';
import PointItemTable from '../components/PointItemTable';
import PointPackTab from '../components/PointPackTab';
import RewardPolicyTab from '../components/RewardPolicyTab';

/** 서브탭 정의 */
const TABS = [
  { id: 'orders',        label: '결제 내역' },
  { id: 'subscription',  label: '구독 관리' },
  { id: 'point',         label: '포인트 관리' },
  { id: 'items',         label: '포인트 아이템' },
  { id: 'point_pack',    label: '포인트팩' },
  { id: 'reward_policy', label: '리워드 정책' },
];

export default function PaymentPage() {
  /* 현재 활성 탭 ID */
  const [activeTab, setActiveTab] = useState('orders');

  return (
    <Wrapper>
      {/* 페이지 헤더 */}
      <PageHeader>
        <PageTitle>결제 / 포인트 관리</PageTitle>
        <PageDesc>
          결제 내역 조회 및 환불 처리, 구독 관리, 포인트 수동 지급/차감,
          포인트 아이템·포인트팩·리워드 정책 CRUD를 담당합니다.
        </PageDesc>
      </PageHeader>

      {/* 서브탭 네비게이션 */}
      <TabNav>
        {TABS.map(({ id, label }) => (
          <TabButton
            key={id}
            $active={activeTab === id}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </TabButton>
        ))}
      </TabNav>

      {/* 탭 콘텐츠 영역 */}
      <TabContent>
        {activeTab === 'orders'        && <PaymentOrderTable />}
        {activeTab === 'subscription'  && <SubscriptionTable />}
        {activeTab === 'point'         && <PointManagement />}
        {activeTab === 'items'         && <PointItemTable />}
        {activeTab === 'point_pack'    && <PointPackTab />}
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
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const PageDesc = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TabNav = styled.div`
  display: flex;
  gap: 0;
  border-bottom: 2px solid ${({ theme }) => theme.colors.border};
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  position: relative;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ $active, theme }) =>
    $active ? theme.fontWeights.semibold : theme.fontWeights.normal};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  background: transparent;
  transition: color ${({ theme }) => theme.transitions.fast};

  /* 활성 탭 하단 인디케이터 */
  &::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    right: 0;
    height: 2px;
    background: ${({ $active, theme }) =>
      $active ? theme.colors.primary : 'transparent'};
    transition: background ${({ theme }) => theme.transitions.fast};
  }

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const TabContent = styled.div``;
