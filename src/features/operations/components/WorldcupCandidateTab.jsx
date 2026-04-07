/**
 * 운영 도구 — 월드컵 후보 영화(WorldcupCandidate) 관리 탭.
 *
 * 기능:
 * - 후보 목록 조회 (페이징 + 카테고리 필터)
 * - 신규 후보 등록 모달 (movieId/category/popularity/adminNote)
 * - 메타 수정 모달
 * - 활성/비활성 토글
 * - 인기도 임계값 미만 일괄 비활성화 (인기 없는 영화 일괄 제외)
 * - hard delete
 *
 * 운영 모델:
 * - WorldcupService.startWorldcup() 진입 시 활성 후보 풀에서 우선 선택
 * - 카테고리(예: DEFAULT/ACTION/DIRECTOR_NOLAN)별로 후보 묶어 다양한 토너먼트 운영
 * - (movieId, category) 복합 UNIQUE — 같은 영화를 여러 카테고리에 등록 가능
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdAdd, MdEdit, MdDelete, MdToggleOn, MdToggleOff, MdFilterList } from 'react-icons/md';
import {
  fetchCandidates,
  createCandidate,
  updateCandidate,
  updateCandidateActive,
  deactivateBelowPopularity,
  deleteCandidate,
} from '../api/worldcupCandidateApi';

const PAGE_SIZE = 10;
const MODE_CREATE = 'CREATE';
const MODE_EDIT = 'EDIT';
const EMPTY_FORM = {
  movieId: '',
  category: 'DEFAULT',
  popularity: 0,
  isActive: true,
  adminNote: '',
};

export default function WorldcupCandidateTab() {
  /* ── 목록 상태 ── */
  const [candidates, setCandidates] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ── 모달 상태 ── */
  const [modalMode, setModalMode] = useState(null);
  const [editTargetId, setEditTargetId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  /* ── 일괄 작업 상태 ── */
  const [busyId, setBusyId] = useState(null);
  const [bulkThreshold, setBulkThreshold] = useState(5.0);
  const [bulkBusy, setBulkBusy] = useState(false);

  const loadCandidates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, size: PAGE_SIZE };
      if (categoryFilter) params.category = categoryFilter;
      const result = await fetchCandidates(params);
      setCandidates(result?.content ?? []);
      setTotalPages(result?.totalPages ?? 0);
    } catch (err) {
      setError(err.message || '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [page, categoryFilter]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  function handleCategoryFilterChange(e) {
    setCategoryFilter(e.target.value);
    setPage(0);
  }

  function openCreateModal() {
    setForm(EMPTY_FORM);
    setEditTargetId(null);
    setModalMode(MODE_CREATE);
  }

  function openEditModal(item) {
    setForm({
      movieId: item.movieId ?? '',
      category: item.category ?? 'DEFAULT',
      popularity: item.popularity ?? 0,
      isActive: !!item.isActive,
      adminNote: item.adminNote ?? '',
    });
    setEditTargetId(item.id);
    setModalMode(MODE_EDIT);
  }

  function closeModal() {
    setModalMode(null);
    setEditTargetId(null);
    setForm(EMPTY_FORM);
    setSubmitting(false);
  }

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    try {
      setSubmitting(true);
      const payload = {
        popularity: form.popularity === '' ? 0 : Number(form.popularity),
        isActive: !!form.isActive,
        adminNote: form.adminNote || null,
      };
      if (modalMode === MODE_CREATE) {
        payload.movieId = form.movieId?.trim();
        payload.category = form.category?.trim() || 'DEFAULT';
        await createCandidate(payload);
      } else if (modalMode === MODE_EDIT && editTargetId != null) {
        await updateCandidate(editTargetId, payload);
      }
      closeModal();
      loadCandidates();
    } catch (err) {
      alert(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(item) {
    if (busyId === item.id) return;
    try {
      setBusyId(item.id);
      await updateCandidateActive(item.id, !item.isActive);
      loadCandidates();
    } catch (err) {
      alert(err.message || '상태 변경 실패');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item) {
    if (busyId === item.id) return;
    if (!confirm(`월드컵 후보 #${item.id} (영화 ${item.movieId}, 카테고리 ${item.category})를 삭제합니다.\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }
    try {
      setBusyId(item.id);
      await deleteCandidate(item.id);
      loadCandidates();
    } catch (err) {
      alert(err.message || '삭제 실패');
    } finally {
      setBusyId(null);
    }
  }

  /** 인기도 임계값 미만 일괄 비활성화 */
  async function handleBulkDeactivate() {
    if (bulkBusy) return;
    if (!confirm(
      `popularity < ${bulkThreshold} 인 모든 활성 후보를 비활성화합니다.\n` +
      `이 작업은 인기 없는 영화를 월드컵 풀에서 일괄 제외합니다.\n` +
      `계속하시겠습니까?`
    )) {
      return;
    }
    try {
      setBulkBusy(true);
      const result = await deactivateBelowPopularity(Number(bulkThreshold));
      alert(result?.message ?? `${result?.affected ?? 0}개 후보가 비활성화되었습니다.`);
      loadCandidates();
    } catch (err) {
      alert(err.message || '일괄 비활성화 실패');
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <Container>
      {/* ── 툴바 ── */}
      <Toolbar>
        <ToolbarLeft>
          <ToolbarTitle>월드컵 후보 영화 관리</ToolbarTitle>
          <FilterInput
            type="text"
            placeholder="카테고리 필터 (예: DEFAULT)"
            value={categoryFilter}
            onChange={handleCategoryFilterChange}
          />
        </ToolbarLeft>
        <ToolbarRight>
          <PrimaryButton onClick={openCreateModal}>
            <MdAdd size={16} /> 신규 등록
          </PrimaryButton>
          <IconButton onClick={loadCandidates} disabled={loading} title="새로고침">
            <MdRefresh size={16} />
          </IconButton>
        </ToolbarRight>
      </Toolbar>

      {/* ── 일괄 작업 패널 ── */}
      <BulkPanel>
        <BulkLabel>
          <MdFilterList size={16} />
          인기 없는 영화 일괄 비활성화 — popularity &lt;
        </BulkLabel>
        <BulkInput
          type="number"
          step="0.1"
          min="0"
          value={bulkThreshold}
          onChange={(e) => setBulkThreshold(e.target.value)}
        />
        <BulkButton onClick={handleBulkDeactivate} disabled={bulkBusy}>
          {bulkBusy ? '처리 중...' : '실행'}
        </BulkButton>
        <BulkHint>
          임계값 미만의 모든 활성 후보가 isActive=false로 일괄 전환됩니다.
        </BulkHint>
      </BulkPanel>

      <HelperText>
        월드컵 시작 시 <strong>활성 후보 풀</strong>에서 우선 선택됩니다. 카테고리 매칭 → 셔플 →
        부족 시 전체 활성 풀 → 최후 fallback Movie 랜덤 조회 순서로 동작합니다.
        같은 영화를 여러 카테고리에 등록 가능합니다.
      </HelperText>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      {/* ── 테이블 ── */}
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th $w="60px">ID</Th>
              <Th $w="120px">영화 ID</Th>
              <Th $w="160px">카테고리</Th>
              <Th $w="100px">인기도</Th>
              <Th $w="80px">활성</Th>
              <Th>관리자 메모</Th>
              <Th $w="220px">액션</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}><CenterCell>불러오는 중...</CenterCell></td></tr>
            ) : candidates.length === 0 ? (
              <tr><td colSpan={7}><CenterCell>등록된 후보가 없습니다.</CenterCell></td></tr>
            ) : (
              candidates.map((item) => (
                <Tr key={item.id}>
                  <Td><MutedText>{item.id}</MutedText></Td>
                  <Td><CodeText>{item.movieId}</CodeText></Td>
                  <Td><CategoryBadge>{item.category}</CategoryBadge></Td>
                  <Td><MutedText>{(item.popularity ?? 0).toFixed(2)}</MutedText></Td>
                  <Td>
                    <StatusPill $active={item.isActive}>
                      {item.isActive ? '활성' : '비활성'}
                    </StatusPill>
                  </Td>
                  <Td>
                    <NoteText>{item.adminNote ?? '-'}</NoteText>
                  </Td>
                  <Td>
                    <ActionGroup>
                      <SmallButton onClick={() => openEditModal(item)}>
                        <MdEdit size={13} /> 수정
                      </SmallButton>
                      <SmallButton
                        onClick={() => handleToggleActive(item)}
                        disabled={busyId === item.id}
                        title={item.isActive ? '비활성화' : '활성화'}
                      >
                        {item.isActive ? <MdToggleOff size={14} /> : <MdToggleOn size={14} />}
                        {item.isActive ? ' 비활성' : ' 활성'}
                      </SmallButton>
                      <DangerSmallButton
                        onClick={() => handleDelete(item)}
                        disabled={busyId === item.id}
                      >
                        <MdDelete size={13} /> 삭제
                      </DangerSmallButton>
                    </ActionGroup>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </TableWrap>

      {totalPages > 1 && (
        <Pagination>
          <PageButton onClick={() => setPage((p) => p - 1)} disabled={page === 0}>이전</PageButton>
          <PageInfo>{page + 1} / {totalPages}</PageInfo>
          <PageButton onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages}>다음</PageButton>
        </Pagination>
      )}

      {/* ── 등록/수정 모달 ── */}
      {modalMode && (
        <Overlay onClick={closeModal}>
          <DialogBox onClick={(e) => e.stopPropagation()}>
            <DialogTitle>
              {modalMode === MODE_CREATE ? '월드컵 후보 신규 등록' : '월드컵 후보 수정'}
            </DialogTitle>
            <form onSubmit={handleSubmit}>
              <FieldRow>
                <Field>
                  <Label>영화 ID *</Label>
                  <Input
                    type="text"
                    name="movieId"
                    value={form.movieId}
                    onChange={handleFormChange}
                    required={modalMode === MODE_CREATE}
                    disabled={modalMode === MODE_EDIT}
                    maxLength={50}
                    placeholder="movies.movie_id (VARCHAR(50))"
                  />
                </Field>
                <Field>
                  <Label>카테고리 *</Label>
                  <Input
                    type="text"
                    name="category"
                    value={form.category}
                    onChange={handleFormChange}
                    disabled={modalMode === MODE_EDIT}
                    maxLength={100}
                    placeholder="DEFAULT / ACTION / DIRECTOR_NOLAN..."
                  />
                </Field>
              </FieldRow>
              {modalMode === MODE_EDIT && (
                <FieldHint>
                  영화 ID와 카테고리는 식별자이므로 변경 불가합니다. 다른 카테고리에 등록하려면 신규 등록하세요.
                </FieldHint>
              )}
              <Field>
                <Label>인기도 (popularity)</Label>
                <Input
                  type="number"
                  name="popularity"
                  value={form.popularity}
                  onChange={handleFormChange}
                  step="0.1"
                  min="0"
                  placeholder="0.0 ~ ∞"
                />
                <FieldHint>
                  Movie.popularityScore와 동기화되지 않습니다. 일괄 비활성화 임계값 비교 기준입니다.
                </FieldHint>
              </Field>
              <Field>
                <CheckboxLabel>
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={form.isActive}
                    onChange={handleFormChange}
                  />
                  <span>활성화 (월드컵 풀에 노출)</span>
                </CheckboxLabel>
              </Field>
              <Field>
                <Label>관리자 메모</Label>
                <Textarea
                  name="adminNote"
                  value={form.adminNote}
                  onChange={handleFormChange}
                  rows={3}
                  placeholder="큐레이션 사유, 마케팅 목적 등"
                />
              </Field>
              <DialogFooter>
                <CancelButton type="button" onClick={closeModal}>취소</CancelButton>
                <PrimaryButton type="submit" disabled={submitting}>
                  {submitting ? '저장 중...' : '저장'}
                </PrimaryButton>
              </DialogFooter>
            </form>
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
  margin-bottom: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`;
const ToolbarTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
`;
const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const FilterInput = styled.input`
  padding: 6px 10px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.bgCard};
  color: ${({ theme }) => theme.colors.textPrimary};
  width: 220px;
  &:focus { border-color: ${({ theme }) => theme.colors.primary}; outline: none; }
`;

/* 일괄 작업 패널 */
const BulkPanel = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.bgHover};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: 4px;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`;
const BulkLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textPrimary};
`;
const BulkInput = styled.input`
  width: 80px;
  padding: 5px 8px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.bgCard};
  color: ${({ theme }) => theme.colors.textPrimary};
`;
const BulkButton = styled.button`
  padding: 5px 14px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  background: ${({ theme }) => theme.colors.warning ?? '#f59e0b'};
  color: #fff;
  border-radius: 4px;
  &:hover:not(:disabled) { opacity: 0.9; }
  &:disabled { opacity: 0.5; }
`;
const BulkHint = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  flex-basis: 100%;
`;

const HelperText = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bgHover};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: 4px;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  border-left: 3px solid ${({ theme }) => theme.colors.primary};
`;
const ErrorMsg = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.errorBg};
  border-radius: 4px;
`;
const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 14px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  border-radius: 4px;
  &:hover:not(:disabled) { opacity: 0.9; }
  &:disabled { opacity: 0.5; }
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
  &:hover { background: ${({ theme }) => theme.colors.bgHover}; }
  &:disabled { opacity: 0.4; }
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
const CodeText = styled.code`
  display: inline-block;
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  background: ${({ theme }) => theme.colors.bgHover};
  color: ${({ theme }) => theme.colors.textSecondary};
`;
const CategoryBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  border-radius: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  background: ${({ theme }) => theme.colors.bgHover};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;
const NoteText = styled.span`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  max-width: 280px;
`;
const MutedText = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`;
const StatusPill = styled.span`
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  border-radius: 10px;
  color: #fff;
  background: ${({ $active, theme }) =>
    $active ? theme.colors.success ?? '#10b981' : theme.colors.textMuted};
`;
const ActionGroup = styled.div`
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
`;
const SmallButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px 8px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 3px;
  color: ${({ theme }) => theme.colors.textSecondary};
  background: ${({ theme }) => theme.colors.bgCard};
  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
  &:disabled { opacity: 0.4; }
`;
const DangerSmallButton = styled(SmallButton)`
  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.error};
    color: ${({ theme }) => theme.colors.error};
  }
`;
const CenterCell = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xxxl};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;
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
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
`;
const DialogBox = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  width: 100%;
  max-width: 560px;
  padding: ${({ theme }) => theme.spacing.xxl};
  box-shadow: ${({ theme }) => theme.shadows.lg};
`;
const DialogTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colors.textPrimary};
`;
const Field = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.md};
  flex: 1;
`;
const FieldRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Label = styled.label`
  display: block;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: 4px;
`;
const Input = styled.input`
  width: 100%;
  padding: 7px 10px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.bgCard};
  color: ${({ theme }) => theme.colors.textPrimary};
  &:focus { border-color: ${({ theme }) => theme.colors.primary}; outline: none; }
  &:disabled { background: ${({ theme }) => theme.colors.bgHover}; opacity: 0.7; }
`;
const Textarea = styled.textarea`
  width: 100%;
  padding: 7px 10px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  resize: vertical;
  background: ${({ theme }) => theme.colors.bgCard};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: inherit;
  &:focus { border-color: ${({ theme }) => theme.colors.primary}; outline: none; }
`;
const FieldHint = styled.span`
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
`;
const CheckboxLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  cursor: pointer;
`;
const DialogFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;
const CancelButton = styled.button`
  padding: 7px 16px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.textSecondary};
  background: ${({ theme }) => theme.colors.bgCard};
  &:hover { background: ${({ theme }) => theme.colors.bgHover}; }
`;
