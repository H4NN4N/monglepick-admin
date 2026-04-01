/**
 * 포인트 수동 관리 컴포넌트.
 *
 * 두 영역으로 구성된다:
 * 1. 수동 지급/차감 폼 — 관리자가 특정 사용자에게 포인트를 직접 지급하거나 차감
 * 2. 사용자 포인트 이력 조회 — userId 입력 후 변동 이력 테이블 표시 (페이징 포함)
 *
 * @module PointManagement
 */

import { useState, useCallback } from 'react';
import styled from 'styled-components';
import { MdSearch } from 'react-icons/md';
import { manualPointTransfer, fetchPointHistory } from '../api/paymentApi';
import StatusBadge from '@/shared/components/StatusBadge';

/** 포인트 변동 유형 → StatusBadge 매핑 */
const POINT_TYPE_MAP = {
  EARN:        { status: 'success', label: '지급' },
  DEDUCT:      { status: 'error',   label: '차감' },
  ATTENDANCE:  { status: 'info',    label: '출석' },
  PURCHASE:    { status: 'warning', label: '구매' },
  REFUND:      { status: 'default', label: '환불' },
  EXPIRATION:  { status: 'default', label: '만료' },
};

/** 날짜 포맷 (YYYY.MM.DD HH:MM) */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 포인트 부호 표시 (+/-) */
function formatPointDelta(type, amount) {
  const isDeduct = type === 'DEDUCT' || type === 'PURCHASE' || type === 'EXPIRATION';
  return isDeduct ? `-${amount?.toLocaleString()}` : `+${amount?.toLocaleString()}`;
}

export default function PointManagement() {
  /* ── 수동 지급/차감 폼 상태 ── */
  const [transferForm, setTransferForm] = useState({
    userId: '',
    amount: '',
    reason: '',
    type: 'EARN', // EARN | DEDUCT
  });
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState(null);
  const [transferSuccess, setTransferSuccess] = useState(null);

  /* ── 이력 조회 상태 ── */
  const [historyUserId, setHistoryUserId] = useState('');
  const [historyInput, setHistoryInput] = useState(''); // 입력 중인 값
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPages, setHistoryPages] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const HISTORY_PAGE_SIZE = 20;

  /* ── 수동 지급/차감 폼 핸들러 ── */

  function handleTransferChange(field, value) {
    setTransferForm((prev) => ({ ...prev, [field]: value }));
    setTransferError(null);
    setTransferSuccess(null);
  }

  /** 수동 지급/차감 제출 */
  async function handleTransferSubmit(e) {
    e.preventDefault();

    const { userId, amount, reason, type } = transferForm;

    if (!userId.trim()) {
      setTransferError('사용자 ID를 입력해주세요.');
      return;
    }
    const amountNum = Number(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setTransferError('포인트 금액을 올바르게 입력해주세요.');
      return;
    }
    if (!reason.trim()) {
      setTransferError('처리 사유를 입력해주세요.');
      return;
    }

    try {
      setTransferLoading(true);
      setTransferError(null);
      const result = await manualPointTransfer({
        userId: userId.trim(),
        amount: amountNum,
        reason: reason.trim(),
        type,
      });

      const actionLabel = type === 'EARN' ? '지급' : '차감';
      const balanceMsg = result?.balance != null
        ? ` (현재 잔액: ${result.balance.toLocaleString()}P)`
        : '';
      setTransferSuccess(
        `${amountNum.toLocaleString()}P ${actionLabel} 완료${balanceMsg}`
      );

      /* 폼 초기화 (userId 유지, 이력 자동 갱신) */
      setTransferForm((prev) => ({ ...prev, amount: '', reason: '' }));

      /* 이력이 해당 사용자 조회 중이면 자동 갱신 */
      if (historyUserId === userId.trim()) {
        loadHistory(userId.trim(), 0);
      }
    } catch (err) {
      setTransferError(err.message || '처리 중 오류가 발생했습니다.');
    } finally {
      setTransferLoading(false);
    }
  }

  /* ── 이력 조회 ── */

  /** 이력 API 호출 */
  const loadHistory = useCallback(async (uid, pg = 0) => {
    if (!uid) return;
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const result = await fetchPointHistory(uid, { page: pg, size: HISTORY_PAGE_SIZE });
      setHistory(result?.content ?? []);
      setHistoryTotal(result?.totalElements ?? 0);
      setHistoryPages(result?.totalPages ?? 0);
      setHistoryPage(pg);
    } catch (err) {
      setHistoryError(err.message);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  /** 이력 조회 폼 제출 */
  function handleHistorySearch(e) {
    e.preventDefault();
    const uid = historyInput.trim();
    if (!uid) return;
    setHistoryUserId(uid);
    loadHistory(uid, 0);
  }

  return (
    <Wrapper>
      {/* ── 수동 지급/차감 폼 ── */}
      <Section>
        <SectionTitle>포인트 수동 지급 / 차감</SectionTitle>

        <FormCard>
          <form onSubmit={handleTransferSubmit}>
            <FormGrid>
              {/* 유형 선택 */}
              <FormGroup>
                <FormLabel>처리 유형 <RequiredMark>*</RequiredMark></FormLabel>
                <TypeToggle>
                  <TypeButton
                    type="button"
                    $active={transferForm.type === 'EARN'}
                    $color="success"
                    onClick={() => handleTransferChange('type', 'EARN')}
                  >
                    + 지급
                  </TypeButton>
                  <TypeButton
                    type="button"
                    $active={transferForm.type === 'DEDUCT'}
                    $color="danger"
                    onClick={() => handleTransferChange('type', 'DEDUCT')}
                  >
                    - 차감
                  </TypeButton>
                </TypeToggle>
              </FormGroup>

              {/* 사용자 ID */}
              <FormGroup>
                <FormLabel>사용자 ID <RequiredMark>*</RequiredMark></FormLabel>
                <Input
                  type="text"
                  value={transferForm.userId}
                  onChange={(e) => handleTransferChange('userId', e.target.value)}
                  placeholder="user_xxxxxxxx"
                />
              </FormGroup>

              {/* 포인트 금액 */}
              <FormGroup>
                <FormLabel>포인트 금액 <RequiredMark>*</RequiredMark></FormLabel>
                <InputWithUnit>
                  <Input
                    type="number"
                    min={1}
                    value={transferForm.amount}
                    onChange={(e) => handleTransferChange('amount', e.target.value)}
                    placeholder="0"
                    $hasUnit
                  />
                  <Unit>P</Unit>
                </InputWithUnit>
              </FormGroup>

              {/* 처리 사유 */}
              <FormGroup $full>
                <FormLabel>처리 사유 <RequiredMark>*</RequiredMark></FormLabel>
                <Input
                  type="text"
                  value={transferForm.reason}
                  onChange={(e) => handleTransferChange('reason', e.target.value)}
                  placeholder="예: 이벤트 보상, 서비스 장애 보상, 어뷰징 차감..."
                  maxLength={200}
                />
              </FormGroup>
            </FormGrid>

            {/* 에러 / 성공 메시지 */}
            {transferError && <AlertMsg $type="error">{transferError}</AlertMsg>}
            {transferSuccess && <AlertMsg $type="success">{transferSuccess}</AlertMsg>}

            <SubmitRow>
              <SubmitButton
                type="submit"
                disabled={transferLoading}
                $type={transferForm.type}
              >
                {transferLoading
                  ? '처리 중...'
                  : transferForm.type === 'EARN'
                    ? '포인트 지급'
                    : '포인트 차감'}
              </SubmitButton>
            </SubmitRow>
          </form>
        </FormCard>
      </Section>

      {/* ── 사용자 포인트 이력 조회 ── */}
      <Section>
        <SectionTitle>포인트 변동 이력 조회</SectionTitle>

        {/* 검색 폼 */}
        <SearchForm onSubmit={handleHistorySearch}>
          <SearchInput
            type="text"
            value={historyInput}
            onChange={(e) => setHistoryInput(e.target.value)}
            placeholder="사용자 ID 입력 후 Enter 또는 조회 버튼"
          />
          <SearchButton type="submit" disabled={historyLoading || !historyInput.trim()}>
            <MdSearch size={16} />
            조회
          </SearchButton>
        </SearchForm>

        {/* 이력 테이블 */}
        {historyUserId && (
          <>
            <HistoryHeader>
              <HistoryUserId>
                사용자: <strong>{historyUserId}</strong>
              </HistoryUserId>
              {!historyLoading && (
                <HistoryCount>{historyTotal.toLocaleString()}건</HistoryCount>
              )}
            </HistoryHeader>

            {historyError && <AlertMsg $type="error">{historyError}</AlertMsg>}

            <TableWrapper>
              {historyLoading ? (
                <CenterMsg>불러오는 중...</CenterMsg>
              ) : history.length === 0 ? (
                <CenterMsg>이력이 없습니다.</CenterMsg>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>유형</Th>
                      <Th>변동량</Th>
                      <Th>잔액</Th>
                      <Th>사유</Th>
                      <Th>처리자</Th>
                      <Th>일시</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => {
                      const badge = POINT_TYPE_MAP[item.type] ?? {
                        status: 'default',
                        label: item.type ?? '-',
                      };
                      const delta = formatPointDelta(item.type, item.amount);
                      const isDelta = item.type === 'EARN' || item.type === 'ATTENDANCE';

                      return (
                        <tr key={item.id}>
                          <Td>
                            <StatusBadge status={badge.status} label={badge.label} />
                          </Td>
                          <Td>
                            <DeltaValue $positive={isDelta}>{delta}P</DeltaValue>
                          </Td>
                          <Td mono>{item.balance?.toLocaleString() ?? '-'}P</Td>
                          <Td muted>{item.reason ?? '-'}</Td>
                          <Td muted>{item.adminId ?? '시스템'}</Td>
                          <Td mono>{formatDate(item.createdAt)}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </TableWrapper>

            {/* 페이징 */}
            {historyPages > 1 && (
              <Pagination>
                <PageButton
                  onClick={() => loadHistory(historyUserId, historyPage - 1)}
                  disabled={historyPage === 0 || historyLoading}
                >
                  이전
                </PageButton>
                <PageInfo>{historyPage + 1} / {historyPages}</PageInfo>
                <PageButton
                  onClick={() => loadHistory(historyUserId, historyPage + 1)}
                  disabled={historyPage >= historyPages - 1 || historyLoading}
                >
                  다음
                </PageButton>
              </Pagination>
            )}
          </>
        )}
      </Section>
    </Wrapper>
  );
}

/* ── styled-components ── */

const Wrapper = styled.div``;

const Section = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.heading};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

/* ── 지급/차감 폼 ── */

const FormCard = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.xxl};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: ${({ theme }) => theme.spacing.xl};
`;

const FormGroup = styled.div`
  ${({ $full }) => $full && 'grid-column: 1 / -1;'}
`;

const FormLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const RequiredMark = styled.span`
  color: ${({ theme }) => theme.colors.error};
`;

const TypeToggle = styled.div`
  display: flex;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  overflow: hidden;
  height: 36px;
`;

const TypeButton = styled.button`
  flex: 1;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  transition: all ${({ theme }) => theme.transitions.fast};

  ${({ $active, $color, theme }) => {
    if (!$active) {
      return `color: ${theme.colors.textSecondary}; background: transparent;`;
    }
    return $color === 'success'
      ? `color: #ffffff; background: ${theme.colors.success};`
      : `color: #ffffff; background: ${theme.colors.error};`;
  }}

  &:hover:not([data-active='true']) {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`;

const InputWithUnit = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const Input = styled.input`
  width: 100%;
  height: 36px;
  padding: 0 ${({ $hasUnit, theme }) => $hasUnit ? '32px' : theme.spacing.md} 0 ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textPrimary};
  background: ${({ theme }) => theme.colors.bgCard};
  transition: border-color ${({ theme }) => theme.transitions.fast};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  /* 숫자 스피너 제거 */
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
`;

const Unit = styled.span`
  position: absolute;
  right: ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textSecondary};
  pointer-events: none;
`;

const AlertMsg = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: 4px;
  margin-top: ${({ theme }) => theme.spacing.lg};

  ${({ $type, theme }) =>
    $type === 'error'
      ? `color: ${theme.colors.error}; background: ${theme.colors.errorBg}; border: 1px solid #fecaca;`
      : `color: #065f46; background: ${theme.colors.successBg}; border: 1px solid #a7f3d0;`}
`;

const SubmitRow = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: ${({ theme }) => theme.spacing.xl};
`;

const SubmitButton = styled.button`
  height: 36px;
  padding: 0 ${({ theme }) => theme.spacing.xxl};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: #ffffff;
  transition: opacity ${({ theme }) => theme.transitions.fast};

  background: ${({ $type, theme }) =>
    $type === 'EARN' ? theme.colors.success : theme.colors.error};

  &:hover:not(:disabled) { opacity: 0.85; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

/* ── 이력 조회 ── */

const SearchForm = styled.form`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const SearchInput = styled.input`
  flex: 1;
  max-width: 360px;
  height: 36px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textPrimary};
  background: ${({ theme }) => theme.colors.bgCard};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const SearchButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  height: 36px;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: #ffffff;
  background: ${({ theme }) => theme.colors.primary};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) { background: ${({ theme }) => theme.colors.primaryHover}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const HistoryHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const HistoryUserId = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};

  strong {
    color: ${({ theme }) => theme.colors.textPrimary};
    font-family: ${({ theme }) => theme.fonts.mono};
  }
`;

const HistoryCount = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
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
  min-width: 600px;
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

  tr:last-child & { border-bottom: none; }
`;

const DeltaValue = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ $positive, theme }) =>
    $positive ? theme.colors.success : theme.colors.error};
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
