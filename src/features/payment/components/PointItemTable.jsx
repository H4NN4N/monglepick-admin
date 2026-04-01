/**
 * 포인트 아이템 관리 컴포넌트.
 *
 * 교환 가능한 포인트 아이템 목록을 조회하고 인라인 수정 기능을 제공한다.
 * - 아이템 목록 테이블 (이름/카테고리/가격/설명/활성여부)
 * - 행 클릭 시 인라인 편집 모드 진입 (수정 중인 행 하이라이트)
 * - 수정 저장 시 updatePointItem API 호출
 * - 활성/비활성 토글 버튼으로 빠른 상태 변경 가능
 *
 * @module PointItemTable
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdEdit, MdCheck, MdClose } from 'react-icons/md';
import { fetchPointItems, updatePointItem } from '../api/paymentApi';
import StatusBadge from '@/shared/components/StatusBadge';

/** 카테고리 한국어 레이블 */
const CATEGORY_LABEL = {
  SUBSCRIPTION_DISCOUNT: '구독 할인',
  EXTRA_QUOTA:           '추가 쿼터',
  PROFILE_ITEM:          '프로필 아이템',
  GIFT:                  '선물',
  ETC:                   '기타',
};

/** 편집 가능한 필드 초기값 추출 */
function toEditForm(item) {
  return {
    name:        item.name ?? '',
    price:       String(item.price ?? ''),
    description: item.description ?? '',
    active:      item.active ?? true,
  };
}

export default function PointItemTable() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* 인라인 편집 상태 — 편집 중인 아이템 ID */
  const [editingId, setEditingId] = useState(null);
  /* 편집 폼 값 */
  const [editForm, setEditForm] = useState({});
  /* 저장 중인 아이템 ID */
  const [savingId, setSavingId] = useState(null);
  /* 편집 에러 */
  const [editError, setEditError] = useState(null);

  /** 아이템 목록 조회 */
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchPointItems();
      setItems(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /* 초기 로드 */
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  /** 편집 모드 진입 */
  function startEdit(item) {
    setEditingId(item.id);
    setEditForm(toEditForm(item));
    setEditError(null);
  }

  /** 편집 취소 */
  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
    setEditError(null);
  }

  /** 편집 폼 필드 변경 */
  function handleEditChange(field, value) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
    setEditError(null);
  }

  /** 편집 저장 */
  async function handleSave(itemId) {
    /* 유효성 검사 */
    if (!editForm.name?.trim()) {
      setEditError('아이템 이름을 입력해주세요.');
      return;
    }
    const price = Number(editForm.price);
    if (!editForm.price || isNaN(price) || price < 0) {
      setEditError('가격을 올바르게 입력해주세요.');
      return;
    }

    try {
      setSavingId(itemId);
      setEditError(null);
      const updated = await updatePointItem(itemId, {
        name:        editForm.name.trim(),
        price,
        description: editForm.description.trim(),
        active:      editForm.active,
      });

      /* 로컬 상태 즉시 갱신 (목록 재조회 없이) */
      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, ...updated } : item))
      );
      setEditingId(null);
      setEditForm({});
    } catch (err) {
      setEditError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSavingId(null);
    }
  }

  /**
   * 활성/비활성 빠른 토글.
   * 편집 모드 없이 active 상태만 즉시 변경한다.
   */
  async function handleToggleActive(item) {
    const newActive = !item.active;
    const label = newActive ? '활성화' : '비활성화';
    if (!window.confirm(`"${item.name}"을(를) ${label}하시겠습니까?`)) return;

    try {
      setSavingId(item.id);
      const updated = await updatePointItem(item.id, { ...item, active: newActive });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, ...updated } : i))
      );
    } catch (err) {
      alert(`${label} 실패: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>포인트 아이템 ({items.length}개)</SectionTitle>
        <RefreshButton onClick={loadItems} disabled={loading}>
          <MdRefresh size={16} />
        </RefreshButton>
      </SectionHeader>

      <GuideText>
        행의 수정 버튼을 클릭하면 인라인 편집 모드로 전환됩니다.
        활성 토글로 아이템을 즉시 활성/비활성화할 수 있습니다.
      </GuideText>

      {error && <ErrorMsg>{error}</ErrorMsg>}
      {editError && <AlertMsg $type="error">{editError}</AlertMsg>}

      <TableWrapper>
        {loading ? (
          <CenterMsg>불러오는 중...</CenterMsg>
        ) : items.length === 0 ? (
          <CenterMsg>등록된 아이템이 없습니다.</CenterMsg>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>아이템명</Th>
                <Th>카테고리</Th>
                <Th>가격 (P)</Th>
                <Th>설명</Th>
                <Th>활성</Th>
                <Th>액션</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isEditing = editingId === item.id;
                const isSaving  = savingId === item.id;

                return isEditing ? (
                  /* ── 편집 행 ── */
                  <EditRow key={item.id}>
                    {/* 아이템명 편집 */}
                    <Td>
                      <EditInput
                        type="text"
                        value={editForm.name}
                        onChange={(e) => handleEditChange('name', e.target.value)}
                        placeholder="아이템명"
                        maxLength={100}
                        autoFocus
                      />
                    </Td>

                    {/* 카테고리 — 편집 불가 (읽기 전용 표시) */}
                    <Td muted>
                      {CATEGORY_LABEL[item.category] ?? item.category ?? '-'}
                    </Td>

                    {/* 가격 편집 */}
                    <Td>
                      <EditInput
                        type="number"
                        min={0}
                        value={editForm.price}
                        onChange={(e) => handleEditChange('price', e.target.value)}
                        placeholder="0"
                        style={{ width: '90px' }}
                      />
                    </Td>

                    {/* 설명 편집 */}
                    <Td>
                      <EditInput
                        type="text"
                        value={editForm.description}
                        onChange={(e) => handleEditChange('description', e.target.value)}
                        placeholder="설명 (선택)"
                        maxLength={200}
                        style={{ width: '100%', minWidth: '180px' }}
                      />
                    </Td>

                    {/* 활성 여부 체크박스 */}
                    <Td>
                      <ActiveCheckbox
                        type="checkbox"
                        checked={editForm.active}
                        onChange={(e) => handleEditChange('active', e.target.checked)}
                      />
                    </Td>

                    {/* 저장/취소 버튼 */}
                    <Td>
                      <ActionGroup>
                        <IconButton
                          $variant="success"
                          disabled={isSaving}
                          onClick={() => handleSave(item.id)}
                          title="저장"
                        >
                          {isSaving ? '...' : <MdCheck size={15} />}
                        </IconButton>
                        <IconButton
                          $variant="default"
                          disabled={isSaving}
                          onClick={cancelEdit}
                          title="취소"
                        >
                          <MdClose size={15} />
                        </IconButton>
                      </ActionGroup>
                    </Td>
                  </EditRow>
                ) : (
                  /* ── 일반 행 ── */
                  <tr key={item.id}>
                    <Td bold>{item.name}</Td>
                    <Td muted>
                      {CATEGORY_LABEL[item.category] ?? item.category ?? '-'}
                    </Td>
                    <Td mono>{Number(item.price)?.toLocaleString()}P</Td>
                    <Td muted>{item.description || '-'}</Td>
                    <Td>
                      <ActiveToggle
                        $active={item.active}
                        disabled={isSaving}
                        onClick={() => handleToggleActive(item)}
                        title={item.active ? '클릭하여 비활성화' : '클릭하여 활성화'}
                      >
                        <StatusBadge
                          status={item.active ? 'success' : 'default'}
                          label={item.active ? '활성' : '비활성'}
                        />
                      </ActiveToggle>
                    </Td>
                    <Td>
                      <EditButton
                        onClick={() => startEdit(item)}
                        disabled={editingId !== null || isSaving}
                        title="수정"
                      >
                        <MdEdit size={14} />
                        수정
                      </EditButton>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </TableWrapper>
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
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.heading};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
`;

const GuideText = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
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

const ErrorMsg = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const AlertMsg = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: 4px;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colors.error};
  background: ${({ theme }) => theme.colors.errorBg};
  border: 1px solid #fecaca;
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
  min-width: 700px;
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
  color: ${({ muted, theme }) => muted ? theme.colors.textMuted : theme.colors.textPrimary};
  font-family: ${({ mono, theme }) => mono ? theme.fonts.mono : 'inherit'};
  font-weight: ${({ bold, theme }) => bold ? theme.fontWeights.medium : 'inherit'};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
  white-space: nowrap;

  tr:last-child & { border-bottom: none; }
`;

/** 편집 중인 행 — 배경 하이라이트 */
const EditRow = styled.tr`
  background: ${({ theme }) => theme.colors.primaryBg};

  td {
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  }
`;

const EditInput = styled.input`
  height: 30px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: 4px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  background: ${({ theme }) => theme.colors.bgCard};
  width: 100%;
  min-width: 100px;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primaryLight};
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
`;

const ActiveCheckbox = styled.input`
  width: 16px;
  height: 16px;
  accent-color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
`;

/** 활성 뱃지를 버튼처럼 클릭 가능하게 래핑 */
const ActiveToggle = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ disabled }) => disabled ? 0.5 : 1};
  transition: opacity ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) {
    opacity: 0.75;
  }
`;

const ActionGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  transition: opacity ${({ theme }) => theme.transitions.fast};

  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'success':
        return `color: #ffffff; background: ${theme.colors.success};`;
      default:
        return `color: ${theme.colors.textSecondary}; background: ${theme.colors.bgHover}; border: 1px solid ${theme.colors.border};`;
    }
  }}

  &:hover:not(:disabled) { opacity: 0.8; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const EditButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.bgHover};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const CenterMsg = styled.p`
  padding: ${({ theme }) => theme.spacing.xxl};
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.md};
`;
