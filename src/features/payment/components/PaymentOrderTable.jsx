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

import { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdErrorOutline, MdBuild, MdClose } from 'react-icons/md';
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

  /*
   * 대량 보상 선택 상태 — 2026-04-09 P0-② 확장.
   * 기존에는 개별 "수동 보상" 버튼만 있어 여러 건 처리 시 반복 작업이 필요했다.
   * 체크박스 선택 + 일괄 처리로 운영 효율을 높인다.
   */
  const [selectedFailedIds, setSelectedFailedIds] = useState(() => new Set());
  /** 일괄 보상 진행 중 플래그 — 버튼/체크박스를 한꺼번에 disabled 처리 */
  const [bulkCompensating, setBulkCompensating] = useState(false);

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
      /* 목록 재조회 시 선택 상태도 초기화 — 사라진 항목에 대한 잔존 선택 방지 */
      setSelectedFailedIds(new Set());
    } catch {
      /* 보상 실패 조회 오류는 무시 (메인 목록에 영향 없음) */
      setFailedOrders([]);
      setSelectedFailedIds(new Set());
    } finally {
      setFailedLoading(false);
    }
  }, []);

  // ──────────────────────────────────────────────────────────
  // 대량 보상 선택/실행 (2026-04-09 P0-② 확장)
  // ──────────────────────────────────────────────────────────

  /** 개별 행 체크박스 토글 */
  function toggleSelectFailed(orderId) {
    setSelectedFailedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  /** 헤더 체크박스 — 모든 실패 주문 선택/해제 */
  function toggleSelectAllFailed() {
    setSelectedFailedIds((prev) => {
      const allIds = failedOrders.map((o) => o.orderId);
      if (allIds.length === 0) return prev;
      const allSelected = allIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(allIds);
    });
  }

  /** 선택 전체 해제 */
  function clearFailedSelection() {
    setSelectedFailedIds(new Set());
  }

  /**
   * 일괄 수동 보상 처리.
   *
   * 공통 adminNote 를 한 번만 입력받아 선택된 모든 주문에 동일하게 적용한다.
   * Promise.allSettled 로 병렬 호출하며, 한 건 실패가 전체를 중단시키지 않는다.
   * 처리 결과(성공/실패 건수)를 집계하여 안내한 뒤 목록을 재조회한다.
   */
  async function runBulkCompensate() {
    const ids = Array.from(selectedFailedIds);
    if (ids.length === 0) return;

    // 공통 관리자 메모 입력 — 모든 선택 건에 동일 메모가 기록된다
    // eslint-disable-next-line no-alert
    const note = window.prompt(
      `선택된 ${ids.length}건에 동일하게 적용될 관리자 메모를 입력해주세요.\n\n` +
      '감사 로그(admin_audit_logs)에 개별 건마다 기록됩니다.\n' +
      '(예: Toss 콘솔에서 포인트 일괄 지급 완료)',
      '',
    );
    if (note === null) return;
    if (!note.trim()) {
      // eslint-disable-next-line no-alert
      alert('관리자 메모는 필수입니다.');
      return;
    }

    setBulkCompensating(true);
    try {
      const results = await Promise.allSettled(
        ids.map((orderId) => compensateOrder(orderId, { adminNote: note.trim() })),
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed    = results.length - succeeded;
      const firstError = results.find((r) => r.status === 'rejected');

      let message = `일괄 보상 완료\n성공: ${succeeded}건, 실패: ${failed}건`;
      if (firstError) {
        message += `\n\n첫 실패 사유: ${firstError.reason?.message ?? '알 수 없음'}`;
      }
      // eslint-disable-next-line no-alert
      alert(message);
    } catch (err) {
      // Promise.allSettled 는 reject 하지 않지만 예기치 못한 예외 대비
      // eslint-disable-next-line no-alert
      alert(`일괄 보상 중 오류 발생: ${err?.message ?? '알 수 없음'}`);
    } finally {
      setBulkCompensating(false);
      /* 성공/실패 무관하게 목록 재조회 — 일부 성공한 건도 상태가 바뀌었을 수 있음 */
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

  /** 환불 모달 오픈 */
  function openRefund(order) {
    setRefundTarget(order);
    setRefundModalOpen(true);
  }

  /** 환불 성공 후 목록 갱신 */
  function handleRefundSuccess() {
    loadOrders();
  }

  /**
   * 수동 보상 처리.
   *
   * 백엔드 `AdminCompensateRequest` 는 `adminNote`를 필수로 요구하므로
   * prompt 로 관리자 메모를 받아 함께 전송한다. 공백만 입력한 경우 취소된다.
   */
  async function handleCompensate(orderId) {
    const note = window.prompt(
      `주문 ${orderId}을(를) 수동 보상 처리합니다.\n\n` +
      '감사 로그에 남길 관리자 메모를 입력해주세요.\n' +
      '(예: Toss 콘솔에서 포인트 수동 지급 완료)',
      '',
    );
    /* null = 취소, 빈 문자열 = 필수 필드 누락으로 차단 */
    if (note === null) return;
    if (!note.trim()) {
      alert('관리자 메모는 필수입니다.');
      return;
    }

    try {
      setCompensating(orderId);
      await compensateOrder(orderId, { adminNote: note.trim() });
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

          {/*
            대량 보상 선택 바 — 2026-04-09 P0-② 확장.
            하나 이상 선택된 경우에만 표시하며, 공통 adminNote 로 Promise.allSettled 병렬 처리.
          */}
          {selectedFailedIds.size > 0 && (
            <BulkBar>
              <BulkInfo>
                선택 <strong>{selectedFailedIds.size}</strong>건
              </BulkInfo>
              <BulkActions>
                <BulkRunButton
                  type="button"
                  onClick={runBulkCompensate}
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
                    {/* 헤더 체크박스 — 전체 선택/해제 (indeterminate 포함) */}
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
                        {/* 행 체크박스 — 독립 셀이므로 stopPropagation 불필요 */}
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
                        <Td>{order.userId ?? '-'}</Td>
                        <Td>{TYPE_LABEL[order.type] ?? order.type ?? '-'}</Td>
                        <Td mono>{order.amount?.toLocaleString()}원</Td>
                        <Td muted>{order.failReason ?? '-'}</Td>
                        <Td mono>{formatDate(order.createdAt)}</Td>
                        <Td>
                          <ActionButton
                            $variant="warning"
                            disabled={compensating === order.orderId || bulkCompensating}
                            onClick={() => handleCompensate(order.orderId)}
                          >
                            {compensating === order.orderId ? '처리 중' : '수동 보상'}
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

/**
 * 실패 주문 테이블 헤더 체크박스 — indeterminate(일부 선택) 상태 제어용 소형 컴포넌트.
 *
 * React 는 input 의 {@code indeterminate} 속성을 props 로 직접 세팅할 수 없어 ref 로
 * DOM 에 부여해야 한다. 본체 컴포넌트에 섞으면 가독성이 떨어지므로 별도 함수 컴포넌트로
 * 분리한다. 2026-04-09 P0-② 추가.
 *
 * @param {Object}   props
 * @param {Array}    props.orders      현재 표시 중인 실패 주문 목록
 * @param {Set}      props.selectedIds 선택된 orderId 집합
 * @param {Function} props.onToggle    토글 콜백
 * @param {boolean}  props.disabled    비활성화 여부
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

// ──────────────────────────────────────────────────────────
// 대량 보상 UI (2026-04-09 P0-② 확장)
// ──────────────────────────────────────────────────────────

/**
 * 대량 보상 선택 바 — 하나 이상 선택된 경우 실패 주문 테이블 상단에 표시.
 * AlertBanner 와 시각적 위계를 구분하기 위해 primary 톤을 사용한다.
 */
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

/**
 * 일괄 보상 실행 버튼 — 운영 사고 복구용이므로 warning 톤(주황) 으로 구분.
 * 상단의 개별 "수동 보상" 버튼과 동일한 $variant="warning" 색상과 맞춘다.
 */
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

/** 선택 해제 — outline 스타일 */
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

/**
 * 행/헤더 공통 체크박스 — 16px 고정, primary accent.
 * UserTable 의 RowCheckbox 와 동일 스펙.
 */
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
