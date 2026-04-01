/**
 * 결제 내역 테이블 컴포넌트.
 *
 * 관리자가 전체 결제 주문을 조회하고 환불 처리할 수 있다.
 * - 상태 필터 (전체/COMPLETED/PENDING/FAILED/REFUNDED)
 * - 페이징 (page, size)
 * - 환불 버튼 클릭 시 RefundModal 오픈
 * - 보상 실패 건 별도 섹션으로 표시 및 수동 보상 처리
 *
 * @module PaymentOrderTable
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdErrorOutline } from 'react-icons/md';
import {
  fetchPaymentOrders,
  fetchFailedOrders,
  compensateOrder,
} from '../api/paymentApi';
import StatusBadge from '@/shared/components/StatusBadge';
import RefundModal from './RefundModal';

/** 결제 상태 → StatusBadge status 매핑 */
const STATUS_MAP = {
  COMPLETED: { status: 'success', label: '완료' },
  PENDING:   { status: 'warning', label: '대기' },
  FAILED:    { status: 'error',   label: '실패' },
  REFUNDED:  { status: 'info',    label: '환불' },
};

/** 결제 유형 한국어 */
const TYPE_LABEL = {
  SUBSCRIPTION: '구독',
  POINT_PACK:   '포인트 팩',
  ITEM:         '아이템',
};

/** 필터 옵션 */
const STATUS_FILTERS = [
  { value: '', label: '전체' },
  { value: 'COMPLETED', label: '완료' },
  { value: 'PENDING',   label: '대기' },
  { value: 'FAILED',    label: '실패' },
  { value: 'REFUNDED',  label: '환불' },
];

/** 날짜 포맷 (YYYY.MM.DD HH:MM) */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PaymentOrderTable() {
  /* 결제 목록 상태 */
  const [orders, setOrders] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* 필터/페이징 상태 */
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  /* 보상 실패 목록 상태 */
  const [failedOrders, setFailedOrders] = useState([]);
  const [failedLoading, setFailedLoading] = useState(false);
  const [compensating, setCompensating] = useState(null); // 처리 중인 orderId

  /* 환불 모달 상태 */
  const [refundTarget, setRefundTarget] = useState(null); // 선택된 주문
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  /** 결제 목록 조회 */
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, size: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      const result = await fetchPaymentOrders(params);
      setOrders(result?.content ?? []);
      setTotalElements(result?.totalElements ?? 0);
      setTotalPages(result?.totalPages ?? 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  /** 보상 실패 목록 조회 */
  const loadFailedOrders = useCallback(async () => {
    try {
      setFailedLoading(true);
      const result = await fetchFailedOrders();
      setFailedOrders(Array.isArray(result) ? result : []);
    } catch {
      /* 보상 실패 조회 오류는 무시 (메인 목록에 영향 없음) */
      setFailedOrders([]);
    } finally {
      setFailedLoading(false);
    }
  }, []);

  /* 초기 로드 */
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    loadFailedOrders();
  }, [loadFailedOrders]);

  /* 필터 변경 시 페이지 초기화 */
  function handleStatusFilter(value) {
    setStatusFilter(value);
    setPage(0);
  }

  /** 환불 모달 오픈 */
  function openRefund(order) {
    setRefundTarget(order);
    setRefundModalOpen(true);
  }

  /** 환불 성공 후 목록 갱신 */
  function handleRefundSuccess() {
    loadOrders();
  }

  /** 수동 보상 처리 */
  async function handleCompensate(orderId) {
    if (!window.confirm('해당 주문을 수동으로 보상 처리하시겠습니까?')) return;
    try {
      setCompensating(orderId);
      await compensateOrder(orderId);
      loadFailedOrders();
      loadOrders();
    } catch (err) {
      alert(`보상 처리 실패: ${err.message}`);
    } finally {
      setCompensating(null);
    }
  }

  return (
    <>
      {/* ── 보상 실패 섹션 ── */}
      {(failedOrders.length > 0 || failedLoading) && (
        <Section>
          <SectionHeader>
            <SectionTitle>
              <MdErrorOutline size={18} style={{ color: '#ef4444' }} />
              보상 실패 건 ({failedLoading ? '...' : failedOrders.length})
            </SectionTitle>
            <RefreshButton onClick={loadFailedOrders} disabled={failedLoading}>
              <MdRefresh size={16} />
            </RefreshButton>
          </SectionHeader>
          <AlertBanner>
            결제는 완료됐으나 포인트/구독 지급에 실패한 건입니다. 수동 보상 처리가 필요합니다.
          </AlertBanner>
          {failedOrders.length > 0 && (
            <TableWrapper>
              <Table>
                <thead>
                  <tr>
                    <Th>주문 ID</Th>
                    <Th>사용자</Th>
                    <Th>유형</Th>
                    <Th>금액</Th>
                    <Th>실패 사유</Th>
                    <Th>일시</Th>
                    <Th>액션</Th>
                  </tr>
                </thead>
                <tbody>
                  {failedOrders.map((order) => (
                    <tr key={order.orderId}>
                      <Td mono>{order.orderId}</Td>
                      <Td>{order.userId ?? '-'}</Td>
                      <Td>{TYPE_LABEL[order.type] ?? order.type ?? '-'}</Td>
                      <Td mono>{order.amount?.toLocaleString()}원</Td>
                      <Td muted>{order.failReason ?? '-'}</Td>
                      <Td mono>{formatDate(order.createdAt)}</Td>
                      <Td>
                        <ActionButton
                          $variant="warning"
                          disabled={compensating === order.orderId}
                          onClick={() => handleCompensate(order.orderId)}
                        >
                          {compensating === order.orderId ? '처리 중' : '수동 보상'}
                        </ActionButton>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          )}
        </Section>
      )}

      {/* ── 결제 내역 목록 ── */}
      <Section>
        <SectionHeader>
          <SectionTitle>결제 내역 ({totalElements.toLocaleString()}건)</SectionTitle>
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
            <RefreshButton onClick={loadOrders} disabled={loading}>
              <MdRefresh size={16} />
            </RefreshButton>
          </HeaderRight>
        </SectionHeader>

        {error && <ErrorMsg>{error}</ErrorMsg>}

        <TableWrapper>
          {loading ? (
            <LoadingMsg>불러오는 중...</LoadingMsg>
          ) : orders.length === 0 ? (
            <EmptyMsg>결제 내역이 없습니다.</EmptyMsg>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>주문 ID</Th>
                  <Th>사용자</Th>
                  <Th>유형</Th>
                  <Th>금액</Th>
                  <Th>결제 수단</Th>
                  <Th>상태</Th>
                  <Th>일시</Th>
                  <Th>액션</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const badge = STATUS_MAP[order.status] ?? { status: 'default', label: order.status };
                  const canRefund = order.status === 'COMPLETED';

                  return (
                    <tr key={order.orderId}>
                      <Td mono>{order.orderId}</Td>
                      <Td>{order.userId ?? '-'}</Td>
                      <Td>{TYPE_LABEL[order.type] ?? order.type ?? '-'}</Td>
                      <Td mono>{order.amount?.toLocaleString()}원</Td>
                      <Td>{order.paymentMethod ?? '-'}</Td>
                      <Td>
                        <StatusBadge status={badge.status} label={badge.label} />
                      </Td>
                      <Td mono>{formatDate(order.createdAt)}</Td>
                      <Td>
                        {canRefund && (
                          <ActionButton
                            $variant="danger"
                            onClick={() => openRefund(order)}
                          >
                            환불
                          </ActionButton>
                        )}
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
            <PageInfo>
              {page + 1} / {totalPages}
            </PageInfo>
            <PageButton
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              다음
            </PageButton>
          </Pagination>
        )}
      </Section>

      {/* 환불 모달 */}
      <RefundModal
        isOpen={refundModalOpen}
        order={refundTarget}
        onClose={() => {
          setRefundModalOpen(false);
          setRefundTarget(null);
        }}
        onSuccess={handleRefundSuccess}
      />
    </>
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
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
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

const AlertBanner = styled.div`
  background: ${({ theme }) => theme.colors.warningBg};
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: #92400e;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
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
  min-width: 800px;
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
  color: ${({ muted, theme }) =>
    muted ? theme.colors.textMuted : theme.colors.textPrimary};
  font-family: ${({ mono, theme }) => mono ? theme.fonts.mono : 'inherit'};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
  white-space: nowrap;

  tr:last-child & {
    border-bottom: none;
  }
`;

const ActionButton = styled.button`
  padding: 3px ${({ theme }) => theme.spacing.md};
  border-radius: 4px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  transition: opacity ${({ theme }) => theme.transitions.fast};
  white-space: nowrap;

  ${({ $variant, theme }) =>
    $variant === 'danger'
      ? `color: ${theme.colors.error}; border: 1px solid ${theme.colors.error}; background: ${theme.colors.errorBg};`
      : `color: ${theme.colors.warning}; border: 1px solid ${theme.colors.warning}; background: ${theme.colors.warningBg};`}

  &:hover:not(:disabled) { opacity: 0.75; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const ErrorMsg = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const LoadingMsg = styled.p`
  padding: ${({ theme }) => theme.spacing.xxl};
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.md};
`;

const EmptyMsg = styled.p`
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

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.bgHover};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const PageInfo = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  min-width: 64px;
  text-align: center;
`;
