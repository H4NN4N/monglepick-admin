/**
 * 비속어 사전 관리 탭 컴포넌트.
 *
 * 기능:
 * - 비속어 목록 테이블 (단어, 카테고리, 심각도, 활성여부, 등록일, 액션)
 * - 카테고리 / 심각도 필터
 * - 단어 추가 인라인 폼 (word, category, severity)
 * - 개별 삭제 확인 다이얼로그
 * - CSV 파일 일괄 임포트 (input[type=file])
 * - CSV 전체 익스포트 (Blob 다운로드)
 * - 페이지네이션
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import {
  MdRefresh,
  MdDelete,
  MdUpload,
  MdDownload,
  MdAdd,
} from 'react-icons/md';
import {
  fetchProfanity,
  addProfanity,
  deleteProfanity,
  importProfanity,
  exportProfanity,
} from '../api/supportApi';
import StatusBadge from '@/shared/components/StatusBadge';

/** 카테고리 옵션 */
const CATEGORIES = [
  { value: '', label: '전체' },
  { value: 'SLUR', label: '욕설' },
  { value: 'SEXUAL', label: '성적' },
  { value: 'HATE', label: '혐오' },
  { value: 'VIOLENCE', label: '폭력' },
  { value: 'ETC', label: '기타' },
];

/** 심각도 옵션 */
const SEVERITY_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'HIGH', label: '높음' },
  { value: 'MEDIUM', label: '중간' },
  { value: 'LOW', label: '낮음' },
];

/** 카테고리 한국어 라벨 */
const CATEGORY_LABELS = {
  SLUR: '욕설',
  SEXUAL: '성적',
  HATE: '혐오',
  VIOLENCE: '폭력',
  ETC: '기타',
};

/** 심각도 → StatusBadge 색상 매핑 */
const SEVERITY_BADGE = {
  HIGH: { status: 'error', label: '높음' },
  MEDIUM: { status: 'warning', label: '중간' },
  LOW: { status: 'default', label: '낮음' },
};

/** 추가 폼 초기값 */
const INITIAL_ADD_FORM = {
  word: '',
  category: 'SLUR',
  severity: 'MEDIUM',
};

export default function ProfanityTab() {
  /* ── 목록 상태 ── */
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ── 필터/페이지 상태 ── */
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  /* ── 추가 폼 상태 ── */
  const [addForm, setAddForm] = useState(INITIAL_ADD_FORM);
  const [addLoading, setAddLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  /* ── 삭제 다이얼로그 상태 ── */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ── CSV 임포트 상태 ── */
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null); // { added, skipped }
  const fileInputRef = useRef(null);

  /* ── CSV 익스포트 상태 ── */
  const [exportLoading, setExportLoading] = useState(false);

  /** 비속어 목록 조회 */
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, size: PAGE_SIZE };
      if (filterCategory) params.category = filterCategory;
      if (filterSeverity) params.severity = filterSeverity;
      const result = await fetchProfanity(params);
      setItems(result?.content ?? result ?? []);
      setTotal(result?.totalElements ?? (result?.length ?? 0));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filterCategory, filterSeverity]);

  useEffect(() => { loadItems(); }, [loadItems]);

  /** 필터 변경 — 첫 페이지로 리셋 */
  function handleFilterChange(type, value) {
    if (type === 'category') setFilterCategory(value);
    if (type === 'severity') setFilterSeverity(value);
    setPage(0);
  }

  /** 추가 폼 필드 변경 */
  function handleAddFormChange(e) {
    const { name, value } = e.target;
    setAddForm((prev) => ({ ...prev, [name]: value }));
  }

  /** 비속어 추가 제출 */
  async function handleAddSubmit(e) {
    e.preventDefault();
    if (!addForm.word.trim()) { alert('단어를 입력해주세요.'); return; }

    try {
      setAddLoading(true);
      await addProfanity({ ...addForm, word: addForm.word.trim() });
      setAddForm(INITIAL_ADD_FORM);
      setShowAddForm(false);
      loadItems();
    } catch (err) {
      alert(err.message || '추가 중 오류가 발생했습니다.');
    } finally {
      setAddLoading(false);
    }
  }

  /** 삭제 확인 다이얼로그 오픈 */
  function openDeleteDialog(item) {
    setDeleteTarget(item);
  }

  /** 삭제 실행 */
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await deleteProfanity(deleteTarget.id);
      setDeleteTarget(null);
      loadItems();
    } catch (err) {
      alert(err.message || '삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleteLoading(false);
    }
  }

  /** CSV 파일 선택 → 임포트 실행 */
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // CSV 형식 확인
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      alert('CSV 파일(.csv)만 업로드 가능합니다.');
      e.target.value = '';
      return;
    }

    try {
      setImportLoading(true);
      setImportResult(null);
      const result = await importProfanity(file);
      setImportResult(result);
      loadItems();
    } catch (err) {
      alert(err.message || 'CSV 임포트 중 오류가 발생했습니다.');
    } finally {
      setImportLoading(false);
      // 같은 파일 재선택 가능하도록 input 초기화
      e.target.value = '';
    }
  }

  /** CSV 전체 익스포트 — Blob 다운로드 */
  async function handleExport() {
    try {
      setExportLoading(true);
      const blob = await exportProfanity();
      // Blob URL 생성 → 가상 링크 클릭 → 즉시 해제
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `profanity_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'CSV 내보내기 중 오류가 발생했습니다.');
    } finally {
      setExportLoading(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Container>
      {/* ── 툴바 ── */}
      <Toolbar>
        <ToolbarLeft>
          {/* 카테고리 필터 */}
          <FilterGroup>
            <FilterLabel>카테고리</FilterLabel>
            {CATEGORIES.map((cat) => (
              <FilterButton
                key={cat.value}
                $active={filterCategory === cat.value}
                onClick={() => handleFilterChange('category', cat.value)}
              >
                {cat.label}
              </FilterButton>
            ))}
          </FilterGroup>
          <FilterDivider />
          {/* 심각도 필터 */}
          <FilterGroup>
            <FilterLabel>심각도</FilterLabel>
            {SEVERITY_OPTIONS.map((opt) => (
              <FilterButton
                key={opt.value}
                $active={filterSeverity === opt.value}
                onClick={() => handleFilterChange('severity', opt.value)}
              >
                {opt.label}
              </FilterButton>
            ))}
          </FilterGroup>
        </ToolbarLeft>

        <ToolbarRight>
          <TotalCount>총 {total.toLocaleString()}개</TotalCount>
          <IconButton onClick={loadItems} disabled={loading} title="새로고침">
            <MdRefresh size={16} />
          </IconButton>
          {/* CSV 임포트 — 숨김 input 트리거 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <SecondaryButton
            onClick={() => fileInputRef.current?.click()}
            disabled={importLoading}
            title="CSV 파일로 일괄 등록"
          >
            <MdUpload size={15} />
            {importLoading ? '임포트 중...' : 'CSV 임포트'}
          </SecondaryButton>
          <SecondaryButton
            onClick={handleExport}
            disabled={exportLoading}
            title="전체 목록 CSV 다운로드"
          >
            <MdDownload size={15} />
            {exportLoading ? '내보내는 중...' : 'CSV 내보내기'}
          </SecondaryButton>
          <PrimaryButton onClick={() => setShowAddForm((v) => !v)}>
            <MdAdd size={16} />
            단어 추가
          </PrimaryButton>
        </ToolbarRight>
      </Toolbar>

      {/* ── 임포트 결과 알림 ── */}
      {importResult && (
        <ImportResult>
          임포트 완료: 추가 <strong>{importResult.added ?? 0}개</strong>,
          중복 스킵 <strong>{importResult.skipped ?? 0}개</strong>
          <DismissButton onClick={() => setImportResult(null)}>✕</DismissButton>
        </ImportResult>
      )}

      {/* ── 에러 메시지 ── */}
      {error && <ErrorMsg>{error}</ErrorMsg>}

      {/* ── 단어 추가 인라인 폼 ── */}
      {showAddForm && (
        <AddFormCard>
          <AddFormTitle>새 비속어 추가</AddFormTitle>
          <AddForm onSubmit={handleAddSubmit}>
            <AddFormGrid>
              <FormField>
                <Label>단어 *</Label>
                <Input
                  name="word"
                  value={addForm.word}
                  onChange={handleAddFormChange}
                  placeholder="등록할 단어 입력"
                  autoFocus
                />
              </FormField>
              <FormField>
                <Label>카테고리 *</Label>
                <Select name="category" value={addForm.category} onChange={handleAddFormChange}>
                  {CATEGORIES.slice(1).map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField>
                <Label>심각도 *</Label>
                <Select name="severity" value={addForm.severity} onChange={handleAddFormChange}>
                  {SEVERITY_OPTIONS.slice(1).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField $alignEnd>
                <Label>&nbsp;</Label>
                <AddFormActions>
                  <CancelButton type="button" onClick={() => setShowAddForm(false)}>취소</CancelButton>
                  <SubmitButton type="submit" disabled={addLoading}>
                    {addLoading ? '추가 중...' : '추가'}
                  </SubmitButton>
                </AddFormActions>
              </FormField>
            </AddFormGrid>
          </AddForm>
        </AddFormCard>
      )}

      {/* ── 목록 테이블 ── */}
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>단어</Th>
              <Th $w="90px">카테고리</Th>
              <Th $w="80px">심각도</Th>
              <Th $w="80px">활성여부</Th>
              <Th $w="110px">등록일</Th>
              <Th $w="70px">삭제</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><CenterCell>불러오는 중...</CenterCell></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6}><CenterCell>등록된 비속어가 없습니다.</CenterCell></td></tr>
            ) : (
              items.map((item) => {
                const sevInfo = SEVERITY_BADGE[item.severity] ?? { status: 'default', label: item.severity };
                return (
                  <Tr key={item.id}>
                    <Td>
                      <WordText>{item.word}</WordText>
                    </Td>
                    <Td>
                      <StatusBadge
                        status="info"
                        label={CATEGORY_LABELS[item.category] ?? item.category ?? '-'}
                      />
                    </Td>
                    <Td>
                      <StatusBadge status={sevInfo.status} label={sevInfo.label} />
                    </Td>
                    <Td>
                      <StatusBadge
                        status={item.isActive !== false ? 'success' : 'default'}
                        label={item.isActive !== false ? '활성' : '비활성'}
                      />
                    </Td>
                    <Td>{item.createdAt ? item.createdAt.slice(0, 10) : '-'}</Td>
                    <Td>
                      <DangerButton onClick={() => openDeleteDialog(item)} title="삭제">
                        <MdDelete size={14} />
                      </DangerButton>
                    </Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </TableWrap>

      {/* ── 페이지네이션 ── */}
      {totalPages > 1 && (
        <Pagination>
          <PageButton onClick={() => setPage((p) => p - 1)} disabled={page === 0}>이전</PageButton>
          <PageInfo>{page + 1} / {totalPages}</PageInfo>
          <PageButton onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages}>다음</PageButton>
        </Pagination>
      )}

      {/* ── 삭제 확인 다이얼로그 ── */}
      {deleteTarget && (
        <Overlay onClick={() => setDeleteTarget(null)}>
          <DialogBox onClick={(e) => e.stopPropagation()}>
            <DialogTitle>비속어 삭제</DialogTitle>
            <DialogDesc>
              단어 <strong>"{deleteTarget.word}"</strong>을(를) 삭제합니다.
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
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
`;

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  flex-wrap: wrap;
`;

const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const FilterLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
`;

const FilterDivider = styled.div`
  width: 1px;
  height: 20px;
  background: ${({ theme }) => theme.colors.border};
  margin: 0 ${({ theme }) => theme.spacing.xs};
`;

const FilterButton = styled.button`
  padding: 4px 10px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  border-radius: 4px;
  border: 1px solid ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.border};
  background: ${({ $active, theme }) => $active ? theme.colors.primaryLight : 'transparent'};
  color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.textSecondary};
  font-weight: ${({ $active, theme }) => $active ? theme.fontWeights.semibold : theme.fontWeights.normal};
  transition: all ${({ theme }) => theme.transitions.fast};
  &:hover { border-color: ${({ theme }) => theme.colors.primary}; color: ${({ theme }) => theme.colors.primary}; }
`;

const TotalCount = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
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

const SecondaryButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: all ${({ theme }) => theme.transitions.fast};
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.bgHover};
    border-color: ${({ theme }) => theme.colors.textSecondary};
  }
  &:disabled { opacity: 0.45; }
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
  &:hover { background: ${({ theme }) => theme.colors.primaryHover}; }
`;

const ImportResult = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.successBg};
  border: 1px solid ${({ theme }) => theme.colors.success};
  border-radius: 4px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.success};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const DismissButton = styled.button`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.success};
  padding: 2px 6px;
  &:hover { opacity: 0.7; }
`;

const ErrorMsg = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.errorBg};
  border-radius: 4px;
`;

/* ── 추가 폼 카드 ── */

const AddFormCard = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const AddFormTitle = styled.h4`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const AddForm = styled.form``;

const AddFormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 160px 160px auto;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: end;
`;

const FormField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  align-items: ${({ $alignEnd }) => $alignEnd ? 'flex-end' : 'stretch'};
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

const AddFormActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
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

/* ── 목록 테이블 ── */

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

const WordText = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  background: ${({ theme }) => theme.colors.bgHover};
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid ${({ theme }) => theme.colors.borderLight};
`;

const DangerButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textMuted};
  transition: all ${({ theme }) => theme.transitions.fast};
  &:hover {
    border-color: ${({ theme }) => theme.colors.error};
    color: ${({ theme }) => theme.colors.error};
    background: ${({ theme }) => theme.colors.errorBg};
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

/* ── 삭제 다이얼로그 ── */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
`;

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
