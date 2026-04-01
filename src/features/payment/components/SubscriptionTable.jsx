/**
 * 구독 관리 테이블 컴포넌트.
 *
 * 전체 구독 목록을 조회하고 취소/연장 액션을 처리한다.
 * - 상태 필터 (전체/ACTIVE/CANCELLED/EXPIRED)
 * - 플랜 필터 (전체/BASIC/PREMIUM/ENTERPRISE)
 * - 페이징 (page, size)
 * - 취소: ACTIVE 구독만 가능, 확인 다이얼로그 후 처리
 * - 연장: ACTIVE/EXPIRED 구독 가능, 1개월 연장
 *
 * @module SubscriptionTable
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MdRefresh } from 'react-icons/md';
import { fetchSubscriptions, cancelSubscription, extendSubscription } from '../api/paymentApi';
import StatusBadge from '@/shared/components/StatusBadge';

/** 구독 상태 → StatusBadge 매핑 */
const STATUS_MAP = {
  ACTIVE:    { status: 'success', label: '활성' },
  CANCELLED: { status: 'error',   label: '취소' },
  EXPIRED:   { status: 'default', label: '만료' },
  PAUSED:    { status: 'warning', label: '일시정지' },
};

/** 플랜명 한국어 */
const PLAN_LABEL = {
  BASIC:      '베이직',
  PREMIUM:    '프리미엄',
  ENTERPRISE: '엔터프라이즈',
};

/** 상태 필터 옵션 */
const STATUS_FILTERS = [
  { value: '', label: '전체' },
  { value: 'ACTIVE',    label: '활성' },
  { value: 'CANCELLED', label: '취소' },
  { value: 'EXPIRED',   label: '만료' },
];

/** 플랜 필터 옵션 */
const PLAN_FILTERS = [
  { value: '', label: '전체 플랜' },
  { value: 'BASIC',      label: '베이직' },
  { value: 'PREMIUM',    label: '프리미엄' },
  { value: 'ENTERPRISE', label: '엔터프라이즈' },
];

/** 날짜 포맷 (YYYY.MM.DD) */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** 만료일까지 남은 일수 계산 */
function getDaysLeft(endDateStr) {
  if (!endDateStr) return null;
  const diff = new Date(endDateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function SubscriptionTable() {
  /* 목록 상태 */
  const [subscriptions, setSubscriptions] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* 필터/페이징 상태 */
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  /* 개별 액션 처리 중인 ID */
  const [actionId, setActionId] = useState(null);

  /** 구독 목록 조회 */
  const loadSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, size: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      if (planFilter) params.plan = planFilter;
      const result = await fetchSubscriptions(params);
      setSubscriptions(result?.content ?? []);
      setTotalElements(result?.totalElements ?? 0);
      setTotalPages(result?.totalPages ?? 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, planFilter]);

  /* 초기 로드 및 의존성 변경 시 재조회 */
  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  /* 필터 변경 시 페이지 초기화 */
  function handleStatusFilter(value) {
    setStatusFilter(value);
    setPage(0);
  }

  function handlePlanFilter(e) {
    setPlanFilter(e.target.value);
    setPage(0);
  }

  /** 구독 취소 처리 */
  async function handleCancel(sub) {
    if (!window.confirm(
      `[${PLAN_LABEL[sub.plan] ?? sub.plan}] 구독을 취소하시겠습니까?\n사용자: ${sub.userId ?? sub.id}`
    )) return;

    try {
      setActionId(sub.id);
      await cancelSubscription(sub.id);
      loadSubscriptions();
    } catch (err) {
      alert(`구독 취소 실패: ${err.message}`);
    } finally {
      setActionId(null);
    }
  }

  /** 구독 연장 처리 */
  async function handleExtend(sub) {
    if (!window.confirm(
      `[${PLAN_LABEL[sub.plan] ?? sub.plan}] 구독을 1개월 연장하시겠습니까?\n사용자: ${sub.userId ?? sub.id}`
    )) return;

    try {
      setActionId(sub.id);
      await extendSubscription(sub.id);
      loadSubscriptions();
    } catch (err) {
      alert(`구독 연장 실패: ${err.message}`);
    } finally {
      setActionId(null);
    }
  }

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>구독 관리 ({totalElements.toLocaleString()}건)</SectionTitle>
        <HeaderRight>
          {/* 상태 필터 버튼 그룹 */}
          <FilterGroup>
            {STATUS_FILTERS.map(({ value, label }) => (
              <FilterButton
                key={value}
                $active={statusFilter === value}
                onClick={() => handleStatusFilter(value)}
              >
                {label}
              </FilterButton>
            ))}
          </FilterGroup>

          {/* 플랜 선택 드롭다운 */}
          <Select value={planFilter} onChange={handlePlanFilter}>
            {PLAN_FILTERS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>

          <RefreshButton onClick={loadSubscriptions} disabled={loading}>
            <MdRefresh size={16} />
          </RefreshButton>
        </HeaderRight>
      </SectionHeader>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      <TableWrapper>
        {loading ? (
          <CenterMsg>불러오는 중...</CenterMsg>
        ) : subscriptions.length === 0 ? (
          <CenterMsg>구독 내역이 없습니다.</CenterMsg>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>구독 ID</Th>
                <Th>사용자</Th>
                <Th>플랜</Th>
                <Th>상태</Th>
                <Th>시작일</Th>
                <Th>만료일</Th>
                <Th>자동갱신</Th>
                <Th>액션</Th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => {
                const badge = STATUS_MAP[sub.status] ?? { status: 'default', label: sub.status };
                const daysLeft = getDaysLeft(sub.endDate);
                const isProcessing = actionId === sub.id;
                const canCancel = sub.status === 'ACTIVE';
                const canExtend = sub.status === 'ACTIVE' || sub.status === 'EXPIRED';

                return (
                  <tr key={sub.id}>
                    <Td mono>{sub.id}</Td>
                    <Td>{sub.userId ?? '-'}</Td>
                    <Td>
                      <PlanChip $plan={sub.plan}>
                        {PLAN_LABEL[sub.plan] ?? sub.plan ?? '-'}
                      </PlanChip>
                    </Td>
                    <Td>
                      <StatusBadge status={badge.status} label={badge.label} />
                    </Td>
                    <Td mono>{formatDate(sub.startDate)}</Td>
                    <Td>
                      <DateCell>
                        <span>{formatDate(sub.endDate)}</span>
                        {/* 만료 임박 (7일 이내) 경고 표시 */}
                        {daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && (
                          <DaysLeftBadge $urgent={daysLeft <= 3}>
                            D-{daysLeft}
                          </DaysLeftBadge>
                        )}
                      </DateCell>
                    </Td>
                    <Td>
                      <AutoRenewDot $on={sub.autoRenew}>
                        {sub.autoRenew ? '활성' : '비활성'}
                      </AutoRenewDot>
                    </Td>
                    <Td>
                      <ActionGroup>
                        {canCancel && (
                          <ActionButton
                            $variant="danger"
                            disabled={isProcessing}
                            onClick={() => handleCancel(sub)}
                          >
                            {isProcessing ? '...' : '취소'}
                          </ActionButton>
                        )}
                        {canExtend && (
                          <ActionButton
                            $variant="primary"
                            disabled={isProcessing}
                            onClick={() => handleExtend(sub)}
                          >
                            {isProcessing ? '...' : '연장'}
                          </ActionButton>
                        )}
                      </ActionGroup>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </TableWrapper>

      {/* 페이징 */}
      {totalPages > 1 && (
        <Pagination>
          <PageButton
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            이전
          </PageButton>
          <PageInfo>{page + 1} / {totalPages}</PageInfo>
          <PageButton
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            다음
          </PageButton>
        </Pagination>
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
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.heading};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`;

const FilterGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  overflow: hidden;
`;

const FilterButton = styled.button`
  padding: 5px ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ $active, theme }) =>
    $active ? '#ffffff' : theme.colors.textSecondary};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primary : 'transparent'};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ $active, theme }) =>
      $active ? theme.colors.primaryHover : theme.colors.bgHover};
  }
`;

const Select = styled.select`
  height: 30px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  background: ${({ theme }) => theme.colors.bgCard};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
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
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover { background: ${({ theme }) => theme.colors.bgHover}; }
  &:disabled { opacity: 0.5; }
`;

const TableWrapper = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  overflow-x: auto;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;
`;

const Th = styled.th`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  text-align: left;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textSecondary};
  background: ${({ theme }) => theme.colors.bgHover};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Td = styled.td`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: ${({ mono, theme }) => mono ? theme.fonts.mono : 'inherit'};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
  white-space: nowrap;

  tr:last-child & {
    border-bottom: none;
  }
`;

/** 플랜별 색상 칩 */
const PlanChip = styled.span`
  display: inline-block;
  padding: 2px ${({ theme }) => theme.spacing.sm};
  border-radius: 4px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};

  ${({ $plan, theme }) => {
    switch ($plan) {
      case 'ENTERPRISE':
        return `background: ${theme.colors.primaryBg}; color: ${theme.colors.primary};`;
      case 'PREMIUM':
        return `background: ${theme.colors.warningBg}; color: #b45309;`;
      default: /* BASIC */
        return `background: ${theme.colors.bgHover}; color: ${theme.colors.textSecondary};`;
    }
  }}
`;

const DateCell = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.fonts.mono};
`;

const DaysLeftBadge = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  padding: 1px 6px;
  border-radius: 3px;
  background: ${({ $urgent, theme }) =>
    $urgent ? theme.colors.errorBg : theme.colors.warningBg};
  color: ${({ $urgent, theme }) =>
    $urgent ? theme.colors.error : '#92400e'};
`;

const AutoRenewDot = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ $on, theme }) =>
    $on ? theme.colors.success : theme.colors.textMuted};
`;

const ActionGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const ActionButton = styled.button`
  padding: 3px ${({ theme }) => theme.spacing.md};
  border-radius: 4px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  transition: opacity ${({ theme }) => theme.transitions.fast};
  white-space: nowrap;
  min-width: 42px;

  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'danger':
        return `color: ${theme.colors.error}; border: 1px solid ${theme.colors.error}; background: ${theme.colors.errorBg};`;
      case 'primary':
        return `color: ${theme.colors.primary}; border: 1px solid ${theme.colors.primary}; background: ${theme.colors.primaryBg};`;
      default:
        return `color: ${theme.colors.textSecondary}; border: 1px solid ${theme.colors.border}; background: transparent;`;
    }
  }}

  &:hover:not(:disabled) { opacity: 0.75; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const ErrorMsg = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const CenterMsg = styled.p`
  padding: ${({ theme }) => theme.spacing.xxl};
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.md};
`;

const Pagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
`;

const PageButton = styled.button`
  height: 32px;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) { background: ${({ theme }) => theme.colors.bgHover}; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const PageInfo = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  min-width: 64px;
  text-align: center;
`;
