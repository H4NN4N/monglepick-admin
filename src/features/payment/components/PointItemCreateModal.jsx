/**
 * 포인트 아이템 신규 등록 모달 — 2026-04-09 P1-⑪ 신규.
 *
 * Backend `POST /api/v1/admin/point/items` 엔드포인트와 `AdminPaymentService.createPointItem()`
 * 서비스는 이미 구현되어 있었으나, Frontend 에서 호출하는 UI 가 없어서 관리자가 신규
 * 포인트 아이템을 추가할 수 없는 공백 상태였다. 본 모달이 해당 공백을 메운다.
 *
 * ## 설계 결정
 * - **Backend DTO 필드명 그대로 사용** — `PointItemCreateRequest` (AdminPaymentDto.java) 는
 *   `itemName/itemDescription/itemPrice/itemCategory/isActive` 로 필드를 받으므로, 혼선
 *   없이 Backend DTO 스펙과 완전히 일치하는 key 로 전송한다. 기존 `PointItemTable` 이
 *   내부적으로 `item.name/price/...` 로 접근하는 것과는 별도의 "전송 레이어" 문제이며,
 *   등록 성공 후에는 {@link PointItemTable} 의 {@code loadItems()} 를 재호출하여 목록을
 *   재조회하므로 응답 형식 매핑에 의존하지 않는다.
 * - **유효성 검사**: 상품명 필수 / 가격 0 이상 / 카테고리 50자 이하. Backend 의 Bean
 *   Validation 과 동일한 기준을 클라이언트에서도 선검증하여 네트워크 비용을 절약한다.
 * - **카테고리 선택**: Backend 는 nullable 허용 + 기본 "general" 로 fallback 하므로, UI 에서는
 *   비워두는 것이 합법이다. 다만 운영 혼선을 줄이기 위해 기존 `PointItemTable` 이 사용하는
 *   카테고리 코드 5개(`SUBSCRIPTION_DISCOUNT`/`EXTRA_QUOTA`/`PROFILE_ITEM`/`GIFT`/`ETC`) 를
 *   드롭다운으로 제공하고, "기타/수동 입력" 옵션도 둔다.
 *
 * ## Props
 * @param {Object}   props
 * @param {boolean}  props.isOpen    - 모달 열림 여부
 * @param {Function} props.onClose   - 닫기 콜백
 * @param {Function} props.onCreated - 등록 성공 시 콜백 (목록 재조회용)
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { MdClose } from 'react-icons/md';
import { createPointItem } from '../api/paymentApi';

/**
 * 카테고리 드롭다운 옵션 — 2026-04-09 기준.
 * 기존 {@link PointItemTable} 의 {@code CATEGORY_LABEL} 과 동일한 5개 + 빈 값(미지정) 옵션.
 * "미지정"을 선택하면 Backend 가 기본 "general" 로 저장한다.
 */
const CATEGORY_OPTIONS = [
  { value: '',                      label: '미지정 (general)' },
  { value: 'SUBSCRIPTION_DISCOUNT', label: '구독 할인' },
  { value: 'EXTRA_QUOTA',           label: '추가 쿼터' },
  { value: 'PROFILE_ITEM',          label: '프로필 아이템' },
  { value: 'GIFT',                  label: '선물' },
  { value: 'ETC',                   label: '기타' },
];

/** 폼 초기값 — 모달 재오픈 시에도 동일한 값으로 리셋 */
const INITIAL_FORM = {
  itemName: '',
  itemDescription: '',
  itemPrice: '',
  itemCategory: '',
  isActive: true,
};

export default function PointItemCreateModal({ isOpen, onClose, onCreated }) {
  /* ── 폼 상태 ── */
  const [form, setForm]       = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  /* 모달이 열릴 때마다 폼 초기화 — 이전 입력 잔존 방지 */
  useEffect(() => {
    if (isOpen) {
      setForm(INITIAL_FORM);
      setError(null);
    }
  }, [isOpen]);

  /* 모달이 닫혀있으면 렌더링 생략 (키 다운 이벤트 등 비용 절약) */
  if (!isOpen) return null;

  /** 폼 필드 변경 헬퍼 — 입력 중 에러 메시지 자동 소거 */
  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  /**
   * 등록 제출.
   *
   * 1. 클라이언트 측 유효성 검사 — 필수 필드, 가격 범위
   * 2. Backend DTO 형식으로 변환 (itemPrice 를 Number 로 캐스트)
   * 3. createPointItem() 호출
   * 4. 성공 시 onCreated 콜백으로 상위 컴포넌트에 알림 + 모달 닫기
   * 5. 실패 시 에러 메시지 표시
   */
  async function handleSubmit(e) {
    e.preventDefault();

    /* ── 유효성 검사 ── */
    const itemName = form.itemName.trim();
    if (!itemName) {
      setError('상품명을 입력해주세요.');
      return;
    }
    if (itemName.length > 200) {
      setError('상품명은 최대 200자까지 입력 가능합니다.');
      return;
    }

    const priceStr = String(form.itemPrice).trim();
    if (!priceStr) {
      setError('필요 포인트를 입력해주세요.');
      return;
    }
    const priceNum = Number(priceStr);
    if (!Number.isFinite(priceNum) || !Number.isInteger(priceNum) || priceNum < 0) {
      setError('필요 포인트는 0 이상의 정수여야 합니다.');
      return;
    }

    /* ── Backend DTO 형식으로 payload 구성 ──
     * Backend `PointItemCreateRequest` 의 필드명과 1:1 매핑.
     * 빈 문자열은 null 로 정규화하여 "입력 안 함"을 명확히 한다. */
    const payload = {
      itemName,
      itemDescription: form.itemDescription.trim() || null,
      itemPrice: priceNum,
      itemCategory: form.itemCategory || null,
      isActive: !!form.isActive,
    };

    try {
      setLoading(true);
      setError(null);
      await createPointItem(payload);

      /* 등록 성공 — 상위에 알림 후 모달 닫기.
       * onCreated 는 loadItems() 재호출이 일반적. 응답 객체를 쓰지 않는 이유는
       * 기존 PointItemTable 이 내부적으로 사용하는 필드명(item.name 등)과 응답 DTO
       * 필드명(itemName 등)이 불일치하기 때문이다. 재조회로 일관성을 유지한다. */
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err?.message ?? '등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Overlay onClick={onClose}>
      {/* 내부 클릭이 오버레이까지 전파되지 않도록 stopPropagation */}
      <ModalBox onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <ModalHeader>
          <ModalTitle>포인트 아이템 신규 등록</ModalTitle>
          <CloseButton onClick={onClose} aria-label="닫기" type="button">
            <MdClose size={20} />
          </CloseButton>
        </ModalHeader>

        {/* 안내 문구 */}
        <Notice>
          사용자가 <strong>포인트로 교환</strong>할 수 있는 신규 상품을 등록합니다.
          <br />
          등록 직후 "활성" 상태이면 포인트 상점 화면에 즉시 노출됩니다.
        </Notice>

        {/* 입력 폼 */}
        <form onSubmit={handleSubmit}>
          {/* 상품명 */}
          <FormGroup>
            <FormLabel>
              상품명 <RequiredMark>*</RequiredMark>
            </FormLabel>
            <TextInput
              type="text"
              value={form.itemName}
              onChange={(e) => handleChange('itemName', e.target.value)}
              placeholder="예: 프리미엄 프로필 테두리"
              maxLength={200}
              autoFocus
            />
          </FormGroup>

          {/* 설명 */}
          <FormGroup>
            <FormLabel>설명</FormLabel>
            <Textarea
              rows={3}
              value={form.itemDescription}
              onChange={(e) => handleChange('itemDescription', e.target.value)}
              placeholder="상품 설명 (선택)"
              maxLength={500}
            />
          </FormGroup>

          {/* 가격 + 카테고리 가로 배치 */}
          <FormRow>
            <FormGroup style={{ flex: 1 }}>
              <FormLabel>
                필요 포인트 <RequiredMark>*</RequiredMark>
              </FormLabel>
              <TextInput
                type="number"
                min={0}
                step={1}
                value={form.itemPrice}
                onChange={(e) => handleChange('itemPrice', e.target.value)}
                placeholder="0"
              />
            </FormGroup>

            <FormGroup style={{ flex: 1 }}>
              <FormLabel>카테고리</FormLabel>
              <Select
                value={form.itemCategory}
                onChange={(e) => handleChange('itemCategory', e.target.value)}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </FormGroup>
          </FormRow>

          {/* 활성 여부 */}
          <CheckboxRow>
            <input
              id="createPointItem-isActive"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
            />
            <label htmlFor="createPointItem-isActive">
              등록 직후 활성화 (체크 해제 시 숨김 상태로 저장)
            </label>
          </CheckboxRow>

          {/* 에러 메시지 */}
          {error && <ErrorMsg>{error}</ErrorMsg>}

          {/* 액션 버튼 */}
          <ButtonRow>
            <CancelButton type="button" onClick={onClose} disabled={loading}>
              취소
            </CancelButton>
            <SubmitButton type="submit" disabled={loading}>
              {loading ? '등록 중...' : '등록'}
            </SubmitButton>
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
  max-width: 520px;
  padding: ${({ theme }) => theme.spacing.xxl};
  max-height: 90vh;
  overflow-y: auto;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
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

  &:hover { background: ${({ theme }) => theme.colors.bgHover}; }
`;

/** 상단 안내 박스 */
const Notice = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textSecondary};
  background: ${({ theme }) => theme.colors.bgHover};
  border-left: 3px solid ${({ theme }) => theme.colors.primary};
  border-radius: 4px;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};

  strong {
    color: ${({ theme }) => theme.colors.primary};
    font-weight: ${({ theme }) => theme.fontWeights.semibold};
  }
`;

const FormGroup = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

/** 가격 + 카테고리 가로 배치용 래퍼 */
const FormRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const FormLabel = styled.label`
  display: block;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const RequiredMark = styled.span`
  color: ${({ theme }) => theme.colors.error};
  margin-left: 2px;
`;

const TextInput = styled.input`
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

const Select = styled.select`
  width: 100%;
  height: 36px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textPrimary};
  background: ${({ theme }) => theme.colors.bgCard};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

/** 활성 체크박스 행 */
const CheckboxRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  input[type='checkbox'] {
    width: 16px;
    height: 16px;
    accent-color: ${({ theme }) => theme.colors.primary};
    cursor: pointer;
  }

  label {
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    cursor: pointer;
  }
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

const SubmitButton = styled.button`
  height: 36px;
  padding: 0 ${({ theme }) => theme.spacing.xl};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: #ffffff;
  background: ${({ theme }) => theme.colors.primary};
  transition: opacity ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
