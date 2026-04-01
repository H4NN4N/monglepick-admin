/**
 * 공지사항 관리 탭 컴포넌트.
 *
 * 기능:
 * - 공지사항 목록 테이블 (제목, 카테고리, 고정여부, 공개여부, 조회수, 작성일, 액션)
 * - 카테고리 필터 (NOTICE/MAINTENANCE/EVENT/UPDATE)
 * - 등록/수정 모달 (title, category, content, isPinned, isPublished, scheduledAt)
 * - 삭제 확인 다이얼로그
 * - 페이지네이션
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MdAdd, MdEdit, MdDelete, MdRefresh, MdPushPin } from 'react-icons/md';
import { fetchNotices, createNotice, updateNotice, deleteNotice } from '../api/supportApi';
import StatusBadge from '@/shared/components/StatusBadge';

/** 공지사항 카테고리 옵션 */
const CATEGORIES = [
  { value: '', label: '전체' },
  { value: 'NOTICE', label: '공지' },
  { value: 'MAINTENANCE', label: '점검' },
  { value: 'EVENT', label: '이벤트' },
  { value: 'UPDATE', label: '업데이트' },
];

/** 카테고리 한국어 라벨 */
const CATEGORY_LABELS = {
  NOTICE: '공지',
  MAINTENANCE: '점검',
  EVENT: '이벤트',
  UPDATE: '업데이트',
};

/** 등록/수정 모달 초기값 */
const INITIAL_FORM = {
  title: '',
  category: 'NOTICE',
  content: '',
  isPinned: false,
  isPublished: true,
  scheduledAt: '',
};

export default function NoticeTab() {
  /* ── 목록 상태 ── */
  const [notices, setNotices] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ── 필터/페이지 상태 ── */
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  /* ── 모달 상태 ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null: 신규, Object: 수정
  const [form, setForm] = useState(INITIAL_FORM);
  const [formLoading, setFormLoading] = useState(false);

  /* ── 삭제 확인 다이얼로그 상태 ── */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /** 목록 조회 */
  const loadNotices = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, size: PAGE_SIZE };
      if (filterCategory) params.category = filterCategory;
      const result = await fetchNotices(params);
      // Backend 응답 구조: { content: [], totalElements: n } 또는 배열
      setNotices(result?.content ?? result ?? []);
      setTotal(result?.totalElements ?? (result?.length ?? 0));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filterCategory]);

  useEffect(() => { loadNotices(); }, [loadNotices]);

  /* ── 필터 변경 시 첫 페이지로 ── */
  function handleCategoryChange(value) {
    setFilterCategory(value);
    setPage(0);
  }

  /* ── 모달 열기 (신규) ── */
  function openCreateModal() {
    setEditTarget(null);
    setForm(INITIAL_FORM);
    setModalOpen(true);
  }

  /* ── 모달 열기 (수정) ── */
  function openEditModal(notice) {
    setEditTarget(notice);
    setForm({
      title: notice.title ?? '',
      category: notice.category ?? 'NOTICE',
      content: notice.content ?? '',
      isPinned: notice.isPinned ?? false,
      isPublished: notice.isPublished ?? true,
      scheduledAt: notice.scheduledAt ?? '',
    });
    setModalOpen(true);
  }

  /** 폼 필드 변경 핸들러 */
  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  /** 등록/수정 제출 */
  async function handleFormSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { alert('제목을 입력해주세요.'); return; }
    if (!form.content.trim()) { alert('내용을 입력해주세요.'); return; }

    try {
      setFormLoading(true);
      const payload = {
        ...form,
        scheduledAt: form.scheduledAt || null,
      };
      if (editTarget) {
        await updateNotice(editTarget.id, payload);
      } else {
        await createNotice(payload);
      }
      setModalOpen(false);
      loadNotices();
    } catch (err) {
      alert(err.message || '처리 중 오류가 발생했습니다.');
    } finally {
      setFormLoading(false);
    }
  }

  /** 삭제 확인 다이얼로그 오픈 */
  function openDeleteDialog(notice) {
    setDeleteTarget(notice);
  }

  /** 삭제 실행 */
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await deleteNotice(deleteTarget.id);
      setDeleteTarget(null);
      loadNotices();
    } catch (err) {
      alert(err.message || '삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleteLoading(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Container>
      {/* ── 툴바 ── */}
      <Toolbar>
        <ToolbarLeft>
          {CATEGORIES.map((cat) => (
            <FilterButton
              key={cat.value}
              $active={filterCategory === cat.value}
              onClick={() => handleCategoryChange(cat.value)}
            >
              {cat.label}
            </FilterButton>
          ))}
        </ToolbarLeft>
        <ToolbarRight>
          <IconButton onClick={loadNotices} disabled={loading} title="새로고침">
            <MdRefresh size={16} />
          </IconButton>
          <PrimaryButton onClick={openCreateModal}>
            <MdAdd size={16} />
            공지 등록
          </PrimaryButton>
        </ToolbarRight>
      </Toolbar>

      {/* ── 에러 메시지 ── */}
      {error && <ErrorMsg>{error}</ErrorMsg>}

      {/* ── 목록 테이블 ── */}
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>제목</Th>
              <Th $w="80px">카테고리</Th>
              <Th $w="70px">고정</Th>
              <Th $w="70px">공개</Th>
              <Th $w="80px">조회수</Th>
              <Th $w="120px">작성일</Th>
              <Th $w="100px">액션</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>
                  <LoadingCell>불러오는 중...</LoadingCell>
                </td>
              </tr>
            ) : notices.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyCell>공지사항이 없습니다.</EmptyCell>
                </td>
              </tr>
            ) : (
              notices.map((notice) => (
                <Tr key={notice.id}>
                  <Td>
                    <TitleCell>
                      {notice.isPinned && <MdPushPin size={13} color="#6366f1" title="고정됨" />}
                      <TitleText>{notice.title}</TitleText>
                    </TitleCell>
                  </Td>
                  <Td>
                    <StatusBadge
                      status="info"
                      label={CATEGORY_LABELS[notice.category] ?? notice.category}
                    />
                  </Td>
                  <Td>
                    <StatusBadge
                      status={notice.isPinned ? 'warning' : 'default'}
                      label={notice.isPinned ? '고정' : '-'}
                    />
                  </Td>
                  <Td>
                    <StatusBadge
                      status={notice.isPublished ? 'success' : 'default'}
                      label={notice.isPublished ? '공개' : '비공개'}
                    />
                  </Td>
                  <Td>{(notice.viewCount ?? 0).toLocaleString()}</Td>
                  <Td>{notice.createdAt ? notice.createdAt.slice(0, 10) : '-'}</Td>
                  <Td>
                    <ActionRow>
                      <TextButton onClick={() => openEditModal(notice)}>
                        <MdEdit size={14} /> 수정
                      </TextButton>
                      <DangerButton onClick={() => openDeleteDialog(notice)}>
                        <MdDelete size={14} /> 삭제
                      </DangerButton>
                    </ActionRow>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </TableWrap>

      {/* ── 페이지네이션 ── */}
      {totalPages > 1 && (
        <Pagination>
          <PageButton onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
            이전
          </PageButton>
          <PageInfo>{page + 1} / {totalPages}</PageInfo>
          <PageButton onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages}>
            다음
          </PageButton>
        </Pagination>
      )}

      {/* ── 등록/수정 모달 ── */}
      {modalOpen && (
        <Overlay onClick={() => setModalOpen(false)}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>{editTarget ? '공지사항 수정' : '공지사항 등록'}</ModalTitle>
              <CloseButton onClick={() => setModalOpen(false)}>✕</CloseButton>
            </ModalHeader>

            <ModalForm onSubmit={handleFormSubmit}>
              <FormRow>
                <Label>제목 *</Label>
                <Input
                  name="title"
                  value={form.title}
                  onChange={handleFormChange}
                  placeholder="공지사항 제목 입력"
                  maxLength={200}
                />
              </FormRow>

              <FormRow>
                <Label>카테고리 *</Label>
                <Select name="category" value={form.category} onChange={handleFormChange}>
                  {CATEGORIES.slice(1).map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </Select>
              </FormRow>

              <FormRow>
                <Label>내용 *</Label>
                <Textarea
                  name="content"
                  value={form.content}
                  onChange={handleFormChange}
                  placeholder="공지사항 내용을 입력하세요."
                  rows={8}
                />
              </FormRow>

              <FormRow>
                <Label>예약 발행 시간</Label>
                <Input
                  type="datetime-local"
                  name="scheduledAt"
                  value={form.scheduledAt}
                  onChange={handleFormChange}
                />
              </FormRow>

              <CheckRow>
                <CheckLabel>
                  <input
                    type="checkbox"
                    name="isPinned"
                    checked={form.isPinned}
                    onChange={handleFormChange}
                  />
                  상단 고정
                </CheckLabel>
                <CheckLabel>
                  <input
                    type="checkbox"
                    name="isPublished"
                    checked={form.isPublished}
                    onChange={handleFormChange}
                  />
                  즉시 공개
                </CheckLabel>
              </CheckRow>

              <ModalFooter>
                <CancelButton type="button" onClick={() => setModalOpen(false)}>
                  취소
                </CancelButton>
                <SubmitButton type="submit" disabled={formLoading}>
                  {formLoading ? '저장 중...' : editTarget ? '수정 완료' : '등록'}
                </SubmitButton>
              </ModalFooter>
            </ModalForm>
          </Modal>
        </Overlay>
      )}

      {/* ── 삭제 확인 다이얼로그 ── */}
      {deleteTarget && (
        <Overlay onClick={() => setDeleteTarget(null)}>
          <DialogBox onClick={(e) => e.stopPropagation()}>
            <DialogTitle>공지사항 삭제</DialogTitle>
            <DialogDesc>
              <strong>"{deleteTarget.title}"</strong>을(를) 삭제합니다.
              <br />이 작업은 되돌릴 수 없습니다.
            </DialogDesc>
            <DialogFooter>
              <CancelButton onClick={() => setDeleteTarget(null)}>취소</CancelButton>
              <DeleteConfirmButton onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? '삭제 중...' : '삭제'}
              </DeleteConfirmButton>
            </DialogFooter>
          </DialogBox>
        </Overlay>
      )}
    </Container>
  );
}

/* ── styled-components ── */

const Container = styled.div``;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ToolbarLeft = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const FilterButton = styled.button`
  padding: 5px 12px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border-radius: 4px;
  border: 1px solid ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.border};
  background: ${({ $active, theme }) => $active ? theme.colors.primaryLight : 'transparent'};
  color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.textSecondary};
  font-weight: ${({ $active, theme }) => $active ? theme.fontWeights.semibold : theme.fontWeights.normal};
  transition: all ${({ theme }) => theme.transitions.fast};
  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: background ${({ theme }) => theme.transitions.fast};
  &:hover { background: ${({ theme }) => theme.colors.bgHover}; }
  &:disabled { opacity: 0.4; }
`;

const PrimaryButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  border-radius: 4px;
  transition: background ${({ theme }) => theme.transitions.fast};
  &:hover { background: ${({ theme }) => theme.colors.primaryHover}; }
`;

const ErrorMsg = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.errorBg};
  border-radius: 4px;
`;

const TableWrap = styled.div`
  overflow-x: auto;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

const Th = styled.th`
  text-align: left;
  padding: 10px 12px;
  background: ${({ theme }) => theme.colors.bgHover};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  white-space: nowrap;
  width: ${({ $w }) => $w ?? 'auto'};
`;

const Tr = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
  &:last-child { border-bottom: none; }
  &:hover { background: ${({ theme }) => theme.colors.bgHover}; }
`;

const Td = styled.td`
  padding: 10px 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  vertical-align: middle;
`;

const TitleCell = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const TitleText = styled.span`
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
`;

const ActionRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const TextButton = styled.button`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px 8px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 3px;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: all ${({ theme }) => theme.transitions.fast};
  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const DangerButton = styled(TextButton)`
  &:hover {
    border-color: ${({ theme }) => theme.colors.error};
    color: ${({ theme }) => theme.colors.error};
  }
`;

const LoadingCell = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xxxl};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

const EmptyCell = styled(LoadingCell)``;

const Pagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

const PageButton = styled.button`
  padding: 5px 14px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.textSecondary};
  &:hover:not(:disabled) { background: ${({ theme }) => theme.colors.bgHover}; }
  &:disabled { opacity: 0.4; }
`;

const PageInfo = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

/* ── 모달 공통 ── */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
`;

const Modal = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: ${({ theme }) => theme.shadows.lg};
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.xl};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const ModalTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
`;

const CloseButton = styled.button`
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textMuted};
  &:hover { color: ${({ theme }) => theme.colors.textPrimary}; }
`;

const ModalForm = styled.form`
  padding: ${({ theme }) => theme.spacing.xl};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const FormRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const Input = styled.input`
  padding: 8px 12px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  outline: none;
  &:focus { border-color: ${({ theme }) => theme.colors.primary}; }
`;

const Select = styled.select`
  padding: 8px 12px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  outline: none;
  background: white;
  &:focus { border-color: ${({ theme }) => theme.colors.primary}; }
`;

const Textarea = styled.textarea`
  padding: 8px 12px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  resize: vertical;
  outline: none;
  line-height: 1.6;
  &:focus { border-color: ${({ theme }) => theme.colors.primary}; }
`;

const CheckRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xl};
`;

const CheckLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  user-select: none;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.sm};
`;

const CancelButton = styled.button`
  padding: 7px 16px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.textSecondary};
  &:hover { background: ${({ theme }) => theme.colors.bgHover}; }
`;

const SubmitButton = styled.button`
  padding: 7px 16px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  border-radius: 4px;
  &:hover:not(:disabled) { background: ${({ theme }) => theme.colors.primaryHover}; }
  &:disabled { opacity: 0.5; }
`;

/* ── 삭제 다이얼로그 ── */

const DialogBox = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  width: 100%;
  max-width: 400px;
  padding: ${({ theme }) => theme.spacing.xxl};
  box-shadow: ${({ theme }) => theme.shadows.lg};
`;

const DialogTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const DialogDesc = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.6;
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const DialogFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const DeleteConfirmButton = styled.button`
  padding: 7px 16px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  background: ${({ theme }) => theme.colors.error};
  color: #fff;
  border-radius: 4px;
  &:hover:not(:disabled) { opacity: 0.85; }
  &:disabled { opacity: 0.5; }
`;
