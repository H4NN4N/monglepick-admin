/**
 * 결제 내역 테이블 컴포넌트.
 *
 * 관리자가 전체 결제 주문을 조회하고 환불 처리할 수 있다.
 * - 상태 필터 (전체/COMPLETED/PENDING/FAILED/REFUNDED)
 * - 유저 검색 (이메일/닉네임) — UserSearchPicker
 * - `orderTypeFilter` prop — 상위 탭(전체/개별 결제/포인트 단독 결제)에서 지정하는 주문 유형 고정 필터
 * - 페이징 (page, size)
 * - 환불 버튼 클릭 시 RefundModal 오픈
 * - 보상 실패 건 별도 섹션으로 표시 및 수동 보상 처리 (ConfirmModal)
 *
 * 2026-04-14 변경:
 *  - 백엔드 DTO(PaymentOrderSummary) 필드 정합화
 *      orderType / pgProvider / failedReason / completedAt (기존 type/paymentMethod/failReason)
 *  - window.confirm / alert / prompt 제거 → ConfirmModal 로 교체
 *  - 닉네임/이메일 검색 및 표시 지원
 *  - `orderTypeFilter` prop 신설 — PaymentPage 에서 "개별 결제"(SUBSCRIPTION), "포인트 단독 결제"(POINT_PACK) 탭 추가 지원
 *
 * @module PaymentOrderTable
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdErrorOutline, MdBuild, MdClose } from 'react-icons/md';
import {
  fetchPaymentOrders,
  fetchFailedOrders,
  compensateOrder,
} from '../api/paymentApi';
import StatusBadge from '@/shared/components/StatusBadge';
import ConfirmModal from '@/shared/components/ConfirmModal';
import UserSearchPicker from '@/shared/components/UserSearchPicker';
import RefundModal from './RefundModal';

/** 결제 상태 → StatusBadge status 매핑 */
const STATUS_MAP = {
  COMPLETED: { status: 'success', label: '완료' },
  PENDING:   { status: 'warning', label: '대기' },
  FAILED:    { status: 'error',   label: '실패' },
  REFUNDED:  { status: 'info',    label: '환불' },
  COMPENSATION_FAILED: { status: 'error', label: '보상실패' },
};

/** 주문 유형 한국어 (백엔드 orderType = SUBSCRIPTION | POINT_PACK) */
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
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 결제 주문 테이블.
 *
 * @param {Object} props
 * @param {string} [props.orderTypeFilter] - 주문 유형 고정 필터 (SUBSCRIPTION|POINT_PACK). 미지정 시 전체.
 * @param {string} [props.title]           - 상단 섹션 타이틀 (기본 "결제 내역")
 * @param {boolean} [props.showFailedSection=true] - 보상 실패 건 섹션 노출 여부 (전체 탭에서만)
 */
export default function PaymentOrderTable({
  orderTypeFilter,
  title,
  showFailedSection = true,
}) {
  /* 결제 목록 상태 */
  const [orders, setOrders] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* 필터/페이징 상태 */
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  /* 보상 실패 목록 상태 */
  const [failedOrders, setFailedOrders] = useState([]);
  const [failedLoading, setFailedLoading] = useState(false);
  /* 개별 보상 모달 대상 */
  const [compensateTarget, setCompensateTarget] = useState(null);
  const [compensateLoading, setCompensateLoading] = useState(false);
  const [compensateError, setCompensateError] = useState(null);

  /* 대량 보상 선택 상태 */
  const [selectedFailedIds, setSelectedFailedIds] = useState(() => new Set());
  const [bulkCompensateOpen, setBulkCompensateOpen] = useState(false);
  const [bulkCompensating, setBulkCompensating] = useState(false);
  const [bulkError, setBulkError] = useState(null);

  /* 결과 안내 모달 (alert 대체) */
  const [resultAlert, setResultAlert] = useState(null); // { title, description }

  /* 환불 모달 상태 */
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  /** 결제 목록 조회 */
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, size: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      if (orderTypeFilter) params.orderType = orderTypeFilter;
      if (selectedUser?.userId) params.userId = selectedUser.userId;
      const result = await fetchPaymentOrders(params);

      /* 백엔드가 orderType/userId 필터를 미지원하더라도 최소한의 UX 보장을 위한 클라이언트 필터 fallback */
      let rows = result?.content ?? [];
      if (orderTypeFilter) {
        rows = rows.filter((r) => r.orderType === orderTypeFilter);
      }
      if (selectedUser?.userId) {
        rows = rows.filter((r) => r.userId === selectedUser.userId);
      }

      setOrders(rows);
      setTotalElements(result?.totalElements ?? rows.length);
      setTotalPages(result?.totalPages ?? 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, orderTypeFilter, selectedUser]);

  /** 보상 실패 목록 조회 */
  const loadFailedOrders = useCallback(async () => {
    if (!showFailedSection) return;
    try {
      setFailedLoading(true);
      const result = await fetchFailedOrders();
      setFailedOrders(Array.isArray(result) ? result : []);
      setSelectedFailedIds(new Set());
    } catch {
      setFailedOrders([]);
      setSelectedFailedIds(new Set());
    } finally {
      setFailedLoading(false);
    }
  }, [showFailedSection]);

  // ──────────────────────────────────────────────────────────
  // 대량 보상 선택/실행
  // ──────────────────────────────────────────────────────────

  function toggleSelectFailed(orderId) {
    setSelectedFailedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function toggleSelectAllFailed() {
    setSelectedFailedIds((prev) => {
      const allIds = failedOrders.map((o) => o.orderId);
      if (allIds.length === 0) return prev;
      const allSelected = allIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(allIds);
    });
  }

  function clearFailedSelection() {
    setSelectedFailedIds(new Set());
  }

  /** 일괄 보상 모달 열기 */
  function openBulkCompensate() {
    if (selectedFailedIds.size === 0) return;
    setBulkError(null);
    setBulkCompensateOpen(true);
  }

  /** 일괄 보상 모달 확인 */
  async function runBulkCompensate(note) {
    const ids = Array.from(selectedFailedIds);
    if (ids.length === 0) return;

    setBulkCompensating(true);
    setBulkError(null);
    try {
      const results = await Promise.allSettled(
        ids.map((orderId) => compensateOrder(orderId, { adminNote: note })),
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      const firstError = results.find((r) => r.status === 'rejected');

      let description = `성공: ${succeeded}건, 실패: ${failed}건`;
      if (firstError) {
        description += `\n첫 실패 사유: ${firstError.reason?.message ?? '알 수 없음'}`;
      }
      setBulkCompensateOpen(false);
      setResultAlert({ title: '일괄 보상 결과', description });
    } catch (err) {
      setBulkError(err?.message ?? '일괄 보상 중 오류 발생');
    } finally {
      setBulkCompensating(false);
      loadFailedOrders();
      loadOrders();
    }
  }

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

  function handleUserChange(user) {
    setSelectedUser(user);
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

  /** 개별 보상 모달 열기 */
  function openCompensate(order) {
    setCompensateError(null);
    setCompensateTarget(order);
  }

  /** 개별 보상 모달 확인 */
  async function runCompensate(note) {
    if (!compensateTarget) return;
    setCompensateLoading(true);
    setCompensateError(null);
    try {
      await compensateOrder(compensateTarget.orderId, { adminNote: note });
      setCompensateTarget(null);
      loadFailedOrders();
      loadOrders();
    } catch (err) {
      setCompensateError(err?.message ?? '보상 처리 실패');
    } finally {
      setCompensateLoading(false);
    }
  }

  /** 유저 표시 우선순위: nickname > email > userId */
  function userLabel(order) {
    return order.nickname ?? order.email ?? order.userId ?? '-';
  }

  return (
    <>
      {/* ── 보상 실패 섹션 ── */}
      {showFailedSection && (failedOrders.length > 0 || failedLoading) && (
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

          {/* 대량 보상 바 */}
          {selectedFailedIds.size > 0 && (
            <BulkBar>
              <BulkInfo>
                선택 <strong>{selectedFailedIds.size}</strong>건
              </BulkInfo>
              <BulkActions>
                <BulkRunButton
                  type="button"
                  onClick={openBulkCompensate}
                  disabled={bulkCompensating}
                  title="선택한 실패 주문 일괄 수동 보상"
                >
                  <MdBuild size={16} />
                  일괄 보상 처리
                </BulkRunButton>
                <BulkCancelButton
                  type="button"
                  onClick={clearFailedSelection}
                  disabled={bulkCompensating}
                >
                  <MdClose size={16} />
                  선택 해제
                </BulkCancelButton>
                {bulkCompensating && <BulkStatus>처리 중...</BulkStatus>}
              </BulkActions>
            </BulkBar>
          )}

          {failedOrders.length > 0 && (
            <TableWrapper>
              <Table>
                <thead>
                  <tr>
                    <Th style={{ width: '36px' }}>
                      <FailedHeaderCheckbox
                        orders={failedOrders}
                        selectedIds={selectedFailedIds}
                        onToggle={toggleSelectAllFailed}
                        disabled={failedLoading || bulkCompensating}
                      />
                    </Th>
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
                  {failedOrders.map((order) => {
                    const isChecked = selectedFailedIds.has(order.orderId);
                    return (
                      <tr key={order.orderId}>
                        <Td>
                          <RowCheckbox
                            type="checkbox"
                            checked={isChecked}
                            disabled={bulkCompensating}
                            onChange={() => toggleSelectFailed(order.orderId)}
                            aria-label={`주문 ${order.orderId} 선택`}
                          />
                        </Td>
                        <Td mono>{order.orderId}</Td>
                        <Td>
                          <UserCell>
                            <UserMain>{userLabel(order)}</UserMain>
                            {(order.nickname || order.email) && order.userId && (
                              <UserSub title={order.userId}>{order.userId}</UserSub>
                            )}
                          </UserCell>
                        </Td>
                        <Td>{TYPE_LABEL[order.orderType] ?? order.orderType ?? '-'}</Td>
                        <Td mono>{order.amount?.toLocaleString()}원</Td>
                        <Td muted>{order.failedReason ?? '-'}</Td>
                        <Td mono>{formatDate(order.createdAt)}</Td>
                        <Td>
                          <ActionButton
                            $variant="warning"
                            disabled={bulkCompensating || compensateLoading}
                            onClick={() => openCompensate(order)}
                          >
                            수동 보상
                          </ActionButton>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrapper>
          )}
        </Section>
      )}

      {/* ── 결제 내역 목록 ── */}
      <Section>
        <SectionHeader>
          <SectionTitle>
            {title ?? '결제 내역'} ({totalElements.toLocaleString()}건)
          </SectionTitle>
          <HeaderRight>
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

        {/* 유저 검색 */}
        <UserSearchRow>
          <UserSearchLabel>사용자 검색</UserSearchLabel>
          <UserSearchPicker
            selectedUser={selectedUser}
            onChange={handleUserChange}
            placeholder="이메일 또는 닉네임으로 검색"
          />
        </UserSearchRow>

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
                  <Th>지급 포인트</Th>
                  <Th>PG</Th>
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
                      <Td>
                        <UserCell>
                          <UserMain>{userLabel(order)}</UserMain>
                          {(order.nickname || order.email) && order.userId && (
                            <UserSub title={order.userId}>{order.userId}</UserSub>
                          )}
                        </UserCell>
                      </Td>
                      <Td>{TYPE_LABEL[order.orderType] ?? order.orderType ?? '-'}</Td>
                      <Td mono>{order.amount?.toLocaleString()}원</Td>
                      <Td mono>
                        {order.pointsAmount != null
                          ? `${order.pointsAmount.toLocaleString()}P`
                          : '-'}
                      </Td>
                      <Td>{order.pgProvider ?? '-'}</Td>
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

      {/* 환불 모달 (기존 유지) */}
      <RefundModal
        isOpen={refundModalOpen}
        order={refundTarget}
        onClose={() => {
          setRefundModalOpen(false);
          setRefundTarget(null);
        }}
        onSuccess={handleRefundSuccess}
      />

      {/* 개별 보상 모달 */}
      <ConfirmModal
        isOpen={!!compensateTarget}
        title="수동 보상 처리"
        description={
          compensateTarget
            ? `주문 ${compensateTarget.orderId} 을(를) COMPENSATION_FAILED → COMPLETED 로 복구합니다.\n감사 로그에 남길 관리자 메모를 입력해주세요.`
            : null
        }
        confirmText="보상 처리"
        cancelText="취소"
        variant="warning"
        withReason
        reasonLabel="관리자 메모"
        reasonPlaceholder="예: Toss 콘솔에서 포인트 수동 지급 완료"
        reasonRequired
        loading={compensateLoading}
        error={compensateError}
        onConfirm={runCompensate}
        onClose={() => {
          if (!compensateLoading) setCompensateTarget(null);
        }}
      />

      {/* 일괄 보상 모달 */}
      <ConfirmModal
        isOpen={bulkCompensateOpen}
        title="일괄 보상 처리"
        description={`선택된 ${selectedFailedIds.size}건에 동일하게 적용될 관리자 메모를 입력해주세요.\n감사 로그(admin_audit_logs)에 개별 건마다 기록됩니다.`}
        confirmText="일괄 보상"
        cancelText="취소"
        variant="warning"
        withReason
        reasonLabel="공통 관리자 메모"
        reasonPlaceholder="예: Toss 콘솔에서 포인트 일괄 지급 완료"
        reasonRequired
        loading={bulkCompensating}
        error={bulkError}
        onConfirm={runBulkCompensate}
        onClose={() => {
          if (!bulkCompensating) setBulkCompensateOpen(false);
        }}
      />

      {/* 결과 안내 모달 */}
      <ConfirmModal
        isOpen={!!resultAlert}
        title={resultAlert?.title ?? ''}
        description={resultAlert?.description ?? ''}
        confirmText="확인"
        hideCancel
        variant="primary"
        onConfirm={() => setResultAlert(null)}
        onClose={() => setResultAlert(null)}
      />
    </>
  );
}

/**
 * 실패 주문 테이블 헤더 체크박스 — indeterminate 상태 제어용.
 */
function FailedHeaderCheckbox({ orders, selectedIds, onToggle, disabled }) {
  const ref = useRef(null);

  const ids = orders.map((o) => o.orderId);
  const checkedCount = ids.filter((id) => selectedIds.has(id)).length;
  const allChecked  = ids.length > 0 && checkedCount === ids.length;
  const someChecked = checkedCount > 0 && !allChecked;

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  return (
    <RowCheckbox
      type="checkbox"
      ref={ref}
      checked={allChecked}
      disabled={disabled}
      onChange={onToggle}
      aria-label="실패 주문 전체 선택/해제"
    />
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

const UserSearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;
`;

const UserSearchLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
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
  color: ${({ muted, theme }) =>
    muted ? theme.colors.textMuted : theme.colors.textPrimary};
  font-family: ${({ mono, theme }) => mono ? theme.fonts.mono : 'inherit'};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
  white-space: nowrap;

  tr:last-child & {
    border-bottom: none;
  }
`;

const UserCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const UserMain = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const UserSub = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  font-family: ${({ theme }) => theme.fonts.mono};
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
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
      : `color: ${theme.colors.warning ?? '#92400e'}; border: 1px solid ${theme.colors.warning ?? '#f59e0b'}; background: ${theme.colors.warningBg};`}

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

const BulkBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.primaryLight};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: 6px;
`;

const BulkInfo = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.primary};

  strong {
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: ${({ theme }) => theme.fontWeights.bold};
    margin: 0 ${({ theme }) => theme.spacing.xs};
  }
`;

const BulkActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const BulkRunButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: 6px ${({ theme }) => theme.spacing.lg};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: #ffffff;
  background: ${({ theme }) => theme.colors.warning ?? '#f59e0b'};
  border-radius: 4px;
  transition: opacity ${({ theme }) => theme.transitions.fast};
  white-space: nowrap;

  &:hover:not(:disabled) {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const BulkCancelButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: 6px ${({ theme }) => theme.spacing.lg};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  transition: all ${({ theme }) => theme.transitions.fast};
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.bgHover};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const BulkStatus = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.primary};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  margin-left: ${({ theme }) => theme.spacing.sm};
`;

const RowCheckbox = styled.input`
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: ${({ theme }) => theme.colors.primary};

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
`;
