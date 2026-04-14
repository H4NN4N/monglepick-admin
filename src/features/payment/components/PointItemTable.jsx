/**
 * 포인트 아이템 관리 컴포넌트.
 *
 * 교환 가능한 포인트 아이템 목록을 조회하고 인라인 수정 기능을 제공한다.
 * - 아이템 목록 테이블 (이름/카테고리/가격/설명/활성여부)
 * - 행의 수정 버튼 클릭 시 인라인 편집 모드 진입
 * - 수정 저장 시 updatePointItem API 호출
 * - 활성/비활성 토글 버튼으로 빠른 상태 변경 (ConfirmModal 확인)
 *
 * 2026-04-14 변경:
 *  - 백엔드 DTO(PointItemResponse / PointItemUpdateRequest) 필드 정합화.
 *    기존 코드가 item.id / item.name / item.price / item.description / item.active /
 *    item.category 를 사용했지만 실제 필드는 pointItemId / itemName / itemPrice /
 *    itemDescription / isActive / itemCategory 이다. 이로 인해 화면에 데이터가
 *    비어 보이는 것처럼 표시되던 문제를 해결한다.
 *  - window.confirm / alert 제거 → ConfirmModal 교체
 *  - 업데이트 페이로드 역시 필드명 통일
 *
 * @module PointItemTable
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdEdit, MdCheck, MdClose, MdAdd } from 'react-icons/md';
import { fetchPointItems, updatePointItem } from '../api/paymentApi';
import StatusBadge from '@/shared/components/StatusBadge';
import ConfirmModal from '@/shared/components/ConfirmModal';
import PointItemCreateModal from './PointItemCreateModal';

/**
 * 카테고리 한국어 레이블.
 * 백엔드는 문자열 자유 입력으로 저장하지만, 실제 운영값은 아래와 같이 규약되어 있다.
 */
const CATEGORY_LABEL = {
  general:               '일반',
  coupon:                '쿠폰',
  avatar:                '아바타',
  ai:                    'AI 이용권',
  subscription_discount: '구독 할인',
  extra_quota:           '추가 쿼터',
  profile_item:          '프로필 아이템',
  gift:                  '선물',
  etc:                   '기타',
};

function displayCategory(category) {
  if (!category) return '-';
  return CATEGORY_LABEL[category] ?? CATEGORY_LABEL[category.toLowerCase()] ?? category;
}

/** 편집 가능한 필드 초기값 추출 */
function toEditForm(item) {
  return {
    itemName:        item.itemName ?? '',
    itemPrice:       String(item.itemPrice ?? ''),
    itemDescription: item.itemDescription ?? '',
    itemCategory:    item.itemCategory ?? '',
    isActive:        item.isActive ?? true,
  };
}

export default function PointItemTable() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* 인라인 편집 상태 */
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [editError, setEditError] = useState(null);

  /* 신규 등록 모달 */
  const [createModalOpen, setCreateModalOpen] = useState(false);

  /* 활성/비활성 토글 모달 */
  const [toggleTarget, setToggleTarget] = useState(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [toggleError, setToggleError] = useState(null);

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
    setEditingId(item.pointItemId);
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
    if (!editForm.itemName?.trim()) {
      setEditError('아이템 이름을 입력해주세요.');
      return;
    }
    const price = Number(editForm.itemPrice);
    if (!editForm.itemPrice || Number.isNaN(price) || price < 0) {
      setEditError('가격을 올바르게 입력해주세요.');
      return;
    }

    try {
      setSavingId(itemId);
      setEditError(null);
      const payload = {
        itemName:        editForm.itemName.trim(),
        itemPrice:       price,
        itemDescription: editForm.itemDescription.trim(),
        itemCategory:    (editForm.itemCategory ?? '').trim() || 'general',
        isActive:        editForm.isActive,
      };
      const updated = await updatePointItem(itemId, payload);

      setItems((prev) =>
        prev.map((it) => (it.pointItemId === itemId ? { ...it, ...updated } : it))
      );
      setEditingId(null);
      setEditForm({});
    } catch (err) {
      setEditError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSavingId(null);
    }
  }

  /** 활성/비활성 토글 모달 열기 */
  function openToggle(item) {
    setToggleError(null);
    setToggleTarget(item);
  }

  /** 토글 확인 */
  async function runToggle() {
    if (!toggleTarget) return;
    const itemId = toggleTarget.pointItemId;
    const nextActive = !toggleTarget.isActive;

    setToggleLoading(true);
    setToggleError(null);
    try {
      const updated = await updatePointItem(itemId, {
        itemName:        toggleTarget.itemName,
        itemPrice:       toggleTarget.itemPrice,
        itemDescription: toggleTarget.itemDescription,
        itemCategory:    toggleTarget.itemCategory ?? 'general',
        isActive:        nextActive,
      });
      setItems((prev) =>
        prev.map((it) => (it.pointItemId === itemId ? { ...it, ...updated } : it))
      );
      setToggleTarget(null);
    } catch (err) {
      setToggleError(err?.message ?? '처리 실패');
    } finally {
      setToggleLoading(false);
    }
  }

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>포인트 아이템 ({items.length}개)</SectionTitle>
        <HeaderActions>
          <CreateButton
            type="button"
            onClick={() => setCreateModalOpen(true)}
            disabled={loading || editingId !== null}
            title={editingId !== null ? '편집 중에는 신규 등록 불가' : '신규 아이템 등록'}
          >
            <MdAdd size={16} />
            신규 등록
          </CreateButton>
          <RefreshButton onClick={loadItems} disabled={loading} title="새로고침">
            <MdRefresh size={16} />
          </RefreshButton>
        </HeaderActions>
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
                const isEditing = editingId === item.pointItemId;
                const isSaving  = savingId === item.pointItemId;

                return isEditing ? (
                  /* ── 편집 행 ── */
                  <EditRow key={item.pointItemId}>
                    <Td>
                      <EditInput
                        type="text"
                        value={editForm.itemName}
                        onChange={(e) => handleEditChange('itemName', e.target.value)}
                        placeholder="아이템명"
                        maxLength={200}
                        autoFocus
                      />
                    </Td>

                    <Td>
                      <EditInput
                        type="text"
                        value={editForm.itemCategory}
                        onChange={(e) => handleEditChange('itemCategory', e.target.value)}
                        placeholder="general"
                        maxLength={50}
                        style={{ width: '140px' }}
                      />
                    </Td>

                    <Td>
                      <EditInput
                        type="number"
                        min={0}
                        value={editForm.itemPrice}
                        onChange={(e) => handleEditChange('itemPrice', e.target.value)}
                        placeholder="0"
                        style={{ width: '100px' }}
                      />
                    </Td>

                    <Td>
                      <EditInput
                        type="text"
                        value={editForm.itemDescription}
                        onChange={(e) => handleEditChange('itemDescription', e.target.value)}
                        placeholder="설명 (선택)"
                        maxLength={500}
                        style={{ width: '100%', minWidth: '200px' }}
                      />
                    </Td>

                    <Td>
                      <ActiveCheckbox
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(e) => handleEditChange('isActive', e.target.checked)}
                      />
                    </Td>

                    <Td>
                      <ActionGroup>
                        <IconButton
                          $variant="success"
                          disabled={isSaving}
                          onClick={() => handleSave(item.pointItemId)}
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
                  <tr key={item.pointItemId}>
                    <Td bold>{item.itemName ?? '-'}</Td>
                    <Td muted>{displayCategory(item.itemCategory)}</Td>
                    <Td mono>
                      {item.itemPrice != null ? `${Number(item.itemPrice).toLocaleString()}P` : '-'}
                    </Td>
                    <Td muted>{item.itemDescription || '-'}</Td>
                    <Td>
                      <ActiveToggle
                        $active={item.isActive}
                        disabled={isSaving}
                        onClick={() => openToggle(item)}
                        title={item.isActive ? '클릭하여 비활성화' : '클릭하여 활성화'}
                      >
                        <StatusBadge
                          status={item.isActive ? 'success' : 'default'}
                          label={item.isActive ? '활성' : '비활성'}
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

      {/* 신규 등록 모달 */}
      <PointItemCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={loadItems}
      />

      {/* 활성/비활성 토글 모달 */}
      <ConfirmModal
        isOpen={!!toggleTarget}
        title={toggleTarget?.isActive ? '아이템 비활성화' : '아이템 활성화'}
        description={
          toggleTarget
            ? `"${toggleTarget.itemName}"을(를) ${toggleTarget.isActive ? '비활성화' : '활성화'}하시겠습니까?`
            : null
        }
        confirmText={toggleTarget?.isActive ? '비활성화' : '활성화'}
        cancelText="취소"
        variant={toggleTarget?.isActive ? 'warning' : 'primary'}
        loading={toggleLoading}
        error={toggleError}
        onConfirm={runToggle}
        onClose={() => {
          if (!toggleLoading) setToggleTarget(null);
        }}
      />
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

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const CreateButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: 6px ${({ theme }) => theme.spacing.lg};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: #ffffff;
  background: ${({ theme }) => theme.colors.primary};
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
