/**
 * 환불 처리 모달 컴포넌트.
 *
 * 전액/부분 환불 선택 후 사유를 입력하고 refundOrder API를 호출한다.
 * 부분 환불 시 금액 입력 필드가 활성화되며 최대값은 원래 결제 금액으로 제한된다.
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen    - 모달 열림 여부
 * @param {Object}   props.order     - 환불할 주문 정보 { orderId, amount, userId, ... }
 * @param {Function} props.onClose   - 닫기 콜백
 * @param {Function} props.onSuccess - 환불 성공 후 콜백 (목록 새로고침용)
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { MdClose } from 'react-icons/md';
import { refundOrder } from '../api/paymentApi';

/** 환불 유형 옵션 */
const REFUND_TYPES = [
  { value: 'full', label: '전액 환불' },
  { value: 'partial', label: '부분 환불' },
];

export default function RefundModal({ isOpen, order, onClose, onSuccess }) {
  const [refundType, setRefundType] = useState('full');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* 모달 열릴 때마다 폼 초기화 */
  useEffect(() => {
    if (isOpen) {
      setRefundType('full');
      setAmount('');
      setReason('');
      setError(null);
    }
  }, [isOpen]);

  /* 모달 닫혀있으면 렌더링 생략 */
  if (!isOpen || !order) return null;

  /** 환불 금액 유효성 검사 */
  function getAmountError() {
    if (refundType !== 'partial') return null;
    const num = Number(amount);
    if (!amount || isNaN(num) || num <= 0) return '환불 금액을 입력해주세요.';
    if (num > order.amount) return `최대 ${order.amount.toLocaleString()}원까지 가능합니다.`;
    return null;
  }

  /** 환불 처리 제출 */
  async function handleSubmit(e) {
    e.preventDefault();

    const amountError = getAmountError();
    if (amountError) {
      setError(amountError);
      return;
    }
    if (!reason.trim()) {
      setError('환불 사유를 입력해주세요.');
      return;
    }

    const payload = {
      reason: reason.trim(),
      ...(refundType === 'partial' && { amount: Number(amount) }),
    };

    try {
      setLoading(true);
      setError(null);
      await refundOrder(order.orderId, payload);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || '환불 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Overlay onClick={onClose}>
      {/* 내부 클릭 시 닫힘 방지 */}
      <ModalBox onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <ModalHeader>
          <ModalTitle>환불 처리</ModalTitle>
          <CloseButton onClick={onClose} aria-label="닫기">
            <MdClose size={20} />
          </CloseButton>
        </ModalHeader>

        {/* 주문 정보 요약 */}
        <OrderSummary>
          <SummaryRow>
            <SummaryLabel>주문 ID</SummaryLabel>
            <SummaryValue>{order.orderId}</SummaryValue>
          </SummaryRow>
          <SummaryRow>
            <SummaryLabel>결제 금액</SummaryLabel>
            <SummaryValue highlight>{order.amount?.toLocaleString()}원</SummaryValue>
          </SummaryRow>
          {order.userId && (
            <SummaryRow>
              <SummaryLabel>사용자</SummaryLabel>
              <SummaryValue>{order.userId}</SummaryValue>
            </SummaryRow>
          )}
        </OrderSummary>

        {/* 환불 폼 */}
        <form onSubmit={handleSubmit}>
          {/* 환불 유형 선택 */}
          <FormGroup>
            <FormLabel>환불 유형</FormLabel>
            <RadioGroup>
              {REFUND_TYPES.map(({ value, label }) => (
                <RadioLabel key={value}>
                  <input
                    type="radio"
                    name="refundType"
                    value={value}
                    checked={refundType === value}
                    onChange={() => {
                      setRefundType(value);
                      setAmount('');
                      setError(null);
                    }}
                  />
                  {label}
                </RadioLabel>
              ))}
            </RadioGroup>
          </FormGroup>

          {/* 부분 환불 금액 입력 */}
          {refundType === 'partial' && (
            <FormGroup>
              <FormLabel>
                환불 금액
                <MaxHint>최대 {order.amount?.toLocaleString()}원</MaxHint>
              </FormLabel>
              <Input
                type="number"
                min={1}
                max={order.amount}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                placeholder="환불할 금액 입력"
              />
            </FormGroup>
          )}

          {/* 환불 사유 */}
          <FormGroup>
            <FormLabel>환불 사유 <RequiredMark>*</RequiredMark></FormLabel>
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
              placeholder="환불 사유를 상세히 입력해주세요."
              maxLength={500}
            />
            <CharCount>{reason.length} / 500</CharCount>
          </FormGroup>

          {/* 에러 메시지 */}
          {error && <ErrorMsg>{error}</ErrorMsg>}

          {/* 액션 버튼 */}
          <ButtonRow>
            <CancelButton type="button" onClick={onClose} disabled={loading}>
              취소
            </CancelButton>
            <ConfirmButton type="submit" disabled={loading}>
              {loading ? '처리 중...' : '환불 확인'}
            </ConfirmButton>
          </ButtonRow>
        </form>
      </ModalBox>
    </Overlay>
  );
}

/* ── styled-components ── */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalBox = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  width: 100%;
  max-width: 480px;
  padding: ${({ theme }) => theme.spacing.xxl};
  max-height: 90vh;
  overflow-y: auto;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const ModalTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.heading};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`;

const OrderSummary = styled.div`
  background: ${({ theme }) => theme.colors.bgHover};
  border-radius: 6px;
  padding: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const SummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.xs} 0;

  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
  }
`;

const SummaryLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const SummaryValue = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ $highlight, theme }) =>
    $highlight ? theme.colors.error : theme.colors.textPrimary};
  font-family: ${({ theme }) => theme.fonts.mono};
`;

const FormGroup = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const FormLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const MaxHint = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  font-weight: ${({ theme }) => theme.fontWeights.normal};
  margin-left: auto;
`;

const RequiredMark = styled.span`
  color: ${({ theme }) => theme.colors.error};
`;

const RadioGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xl};
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textPrimary};
  cursor: pointer;

  input[type='radio'] {
    accent-color: ${({ theme }) => theme.colors.primary};
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
`;

const Input = styled.input`
  width: 100%;
  height: 36px;
  padding: 0 ${({ theme }) => theme.spacing.md};
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

const Textarea = styled.textarea`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textPrimary};
  background: ${({ theme }) => theme.colors.bgCard};
  resize: vertical;
  font-family: ${({ theme }) => theme.fonts.base};
  transition: border-color ${({ theme }) => theme.transitions.fast};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const CharCount = styled.div`
  text-align: right;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

const ErrorMsg = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.error};
  background: ${({ theme }) => theme.colors.errorBg};
  border: 1px solid #fecaca;
  border-radius: 4px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.md};
`;

const CancelButton = styled.button`
  height: 36px;
  padding: 0 ${({ theme }) => theme.spacing.xl};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
  background: ${({ theme }) => theme.colors.bgCard};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.bgHover};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ConfirmButton = styled.button`
  height: 36px;
  padding: 0 ${({ theme }) => theme.spacing.xl};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: #ffffff;
  background: ${({ theme }) => theme.colors.error};
  transition: opacity ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
