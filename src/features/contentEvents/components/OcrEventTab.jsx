/**
 * 운영 도구 — OCR 인증 이벤트(OcrEvent) 관리 탭.
 *
 * 기능:
 * - 이벤트 목록 조회 (페이징 + 상태 필터)
 * - 신규 등록 모달 (movieId/start/end)
 * - 메타 수정 모달
 * - 상태 전이 버튼 (READY → ACTIVE → CLOSED)
 * - hard delete
 *
 * 시작일/종료일은 datetime-local input으로 입력. ISO 형식으로 변환하여 백엔드 전송.
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdAdd, MdEdit, MdDelete } from 'react-icons/md';
import {
  fetchOcrEvents,
  createOcrEvent,
  updateOcrEvent,
  updateOcrEventStatus,
  deleteOcrEvent,
} from '../api/ocrEventApi';

const PAGE_SIZE = 10;

const STATUS_FILTER_OPTIONS = [
  { value: '', label: '전체 상태' },
  { value: 'READY', label: '대기 (READY)' },
  { value: 'ACTIVE', label: '진행 중 (ACTIVE)' },
  { value: 'CLOSED', label: '종료 (CLOSED)' },
];

const STATUS_COLOR = {
  READY: '#f59e0b',
  ACTIVE: '#10b981',
  CLOSED: '#6b7280',
};

/** 상태별 가능한 전이 액션 */
const STATUS_TRANSITION_BUTTONS = {
  READY:  [{ label: '활성화', target: 'ACTIVE' }, { label: '종료', target: 'CLOSED' }],
  ACTIVE: [{ label: '종료', target: 'CLOSED' }, { label: '대기로', target: 'READY' }],
  CLOSED: [{ label: '재개', target: 'ACTIVE' }],
};

const MODE_CREATE = 'CREATE';
const MODE_EDIT = 'EDIT';
/**
 * 폼 초기값.
 *
 * 2026-04-14: 유저 커뮤니티 "실관람인증" 탭 노출용 title/memo 필드 추가.
 * title 은 필수, memo 는 선택. 백엔드 @NotBlank + @Size 검증과 정합 유지.
 */
const EMPTY_FORM = {
  movieId: '',
  title: '',
  memo: '',
  startDate: '',
  endDate: '',
};

/**
 * datetime-local input value (yyyy-MM-ddTHH:mm) → ISO 문자열로 변환.
 * 백엔드 LocalDateTime 파싱과 호환되는 형식: yyyy-MM-ddTHH:mm:ss.
 */
function toIsoLocalDateTime(value) {
  if (!value) return null;
  return value.length === 16 ? `${value}:00` : value;
}

/** ISO 문자열 → datetime-local input value (yyyy-MM-ddTHH:mm) */
function fromIsoLocalDateTime(iso) {
  if (!iso) return '';
  return iso.substring(0, 16);
}

export default function OcrEventTab() {
  const [events, setEvents] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalMode, setModalMode] = useState(null);
  const [editTargetId, setEditTargetId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, size: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      const result = await fetchOcrEvents(params);
      setEvents(result?.content ?? []);
      setTotalPages(result?.totalPages ?? 0);
    } catch (err) {
      setError(err.message || '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  function handleStatusFilterChange(e) {
    setStatusFilter(e.target.value);
    setPage(0);
  }

  function openCreateModal() {
    setForm(EMPTY_FORM);
    setEditTargetId(null);
    setModalMode(MODE_CREATE);
  }

  function openEditModal(item) {
    // 수정 모달: 기존 값(title/memo 포함)을 폼에 pre-fill
    setForm({
      movieId: item.movieId ?? '',
      title: item.title ?? '',
      memo: item.memo ?? '',
      startDate: fromIsoLocalDateTime(item.startDate),
      endDate: fromIsoLocalDateTime(item.endDate),
    });
    setEditTargetId(item.eventId);
    setModalMode(MODE_EDIT);
  }

  function closeModal() {
    setModalMode(null);
    setEditTargetId(null);
    setForm(EMPTY_FORM);
    setSubmitting(false);
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    try {
      setSubmitting(true);
      // Backend Create/UpdateOcrEventRequest 와 필드명 1:1 정합
      const payload = {
        movieId: form.movieId?.trim(),
        title: form.title?.trim(),
        memo: form.memo?.trim() || null, // 선택 필드 — 빈 문자열 대신 null 전송
        startDate: toIsoLocalDateTime(form.startDate),
        endDate: toIsoLocalDateTime(form.endDate),
      };
      if (modalMode === MODE_CREATE) {
        await createOcrEvent(payload);
      } else if (modalMode === MODE_EDIT && editTargetId != null) {
        await updateOcrEvent(editTargetId, payload);
      }
      closeModal();
      loadEvents();
    } catch (err) {
      alert(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTransition(item, targetStatus) {
    if (busyId === item.eventId) return;
    if (!confirm(`OCR 이벤트 #${item.eventId}를 ${targetStatus} 상태로 변경합니다.`)) return;
    try {
      setBusyId(item.eventId);
      await updateOcrEventStatus(item.eventId, targetStatus);
      loadEvents();
    } catch (err) {
      alert(err.message || '상태 변경 실패');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item) {
    if (busyId === item.eventId) return;
    if (!confirm(`OCR 이벤트 #${item.eventId} (영화 ${item.movieId})를 삭제합니다.\n사용자 인증 기록이 보존되지 않을 수 있습니다.`)) {
      return;
    }
    try {
      setBusyId(item.eventId);
      await deleteOcrEvent(item.eventId);
      loadEvents();
    } catch (err) {
      alert(err.message || '삭제 실패');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Container>
      <Toolbar>
        <ToolbarLeft>
          <ToolbarTitle>OCR 인증 이벤트 관리</ToolbarTitle>
          <FilterSelect value={statusFilter} onChange={handleStatusFilterChange}>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </FilterSelect>
        </ToolbarLeft>
        <ToolbarRight>
          <PrimaryButton onClick={openCreateModal}>
            <MdAdd size={16} /> 신규 등록
          </PrimaryButton>
          <IconButton onClick={loadEvents} disabled={loading} title="새로고침">
            <MdRefresh size={16} />
          </IconButton>
        </ToolbarRight>
      </Toolbar>

      <HelperText>
        실관람 OCR 인증 이벤트는 <strong>대기 → 진행 중 → 종료</strong> 순서로 운영됩니다.
        관리자는 필요 시 언제든 상태를 전이할 수 있습니다.
      </HelperText>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th $w="60px">ID</Th>
              <Th $w="120px">영화 ID</Th>
              {/* 2026-04-14 신규: 제목 컬럼. 유저 카드 상단에 동일 노출 */}
              <Th>제목 / 메모</Th>
              <Th $w="200px">시작일 ~ 종료일</Th>
              <Th $w="100px">상태</Th>
              <Th $w="120px">생성자</Th>
              <Th $w="280px">액션</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}><CenterCell>불러오는 중...</CenterCell></td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={7}><CenterCell>등록된 이벤트가 없습니다.</CenterCell></td></tr>
            ) : (
              events.map((item) => (
                <Tr key={item.eventId}>
                  <Td><MutedText>{item.eventId}</MutedText></Td>
                  <Td><CodeText>{item.movieId}</CodeText></Td>
                  {/*
                   * 제목(굵게) + 메모 1-2줄 미리보기.
                   * 메모는 overflow-wrap + line-clamp 로 넘치지 않게 처리.
                   */}
                  <Td>
                    <TitleText>{item.title || <MutedText>(제목 없음)</MutedText>}</TitleText>
                    {item.memo && <MemoPreview>{item.memo}</MemoPreview>}
                  </Td>
                  <Td>
                    <PeriodText>
                      {item.startDate?.replace('T', ' ').substring(0, 16)} ~{' '}
                      {item.endDate?.replace('T', ' ').substring(0, 16)}
                    </PeriodText>
                  </Td>
                  <Td>
                    <StatusPill $color={STATUS_COLOR[item.status] ?? '#888'}>
                      {item.status}
                    </StatusPill>
                  </Td>
                  <Td><MutedText>{item.adminId ?? '-'}</MutedText></Td>
                  <Td>
                    <ActionGroup>
                      <SmallButton onClick={() => openEditModal(item)}>
                        <MdEdit size={13} /> 수정
                      </SmallButton>
                      {(STATUS_TRANSITION_BUTTONS[item.status] ?? []).map((btn) => (
                        <SmallButton
                          key={btn.target}
                          onClick={() => handleTransition(item, btn.target)}
                          disabled={busyId === item.eventId}
                        >
                          {btn.label}
                        </SmallButton>
                      ))}
                      <DangerSmallButton
                        onClick={() => handleDelete(item)}
                        disabled={busyId === item.eventId}
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

      {modalMode && (
        <Overlay onClick={closeModal}>
          <DialogBox onClick={(e) => e.stopPropagation()}>
            <DialogTitle>
              {modalMode === MODE_CREATE ? 'OCR 이벤트 신규 등록' : 'OCR 이벤트 수정'}
            </DialogTitle>
            <form onSubmit={handleSubmit}>
              <Field>
                <Label>대상 영화 ID *</Label>
                <Input
                  type="text"
                  name="movieId"
                  value={form.movieId}
                  onChange={handleFormChange}
                  required
                  maxLength={50}
                  placeholder="movie_id (VARCHAR(50))"
                />
              </Field>
              {/*
               * 2026-04-14 신규: title(필수) + memo(선택) 필드.
               * 유저 커뮤니티 "실관람인증" 탭 카드에 그대로 렌더된다.
               */}
              <Field>
                <Label>이벤트 제목 *</Label>
                <Input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleFormChange}
                  required
                  maxLength={200}
                  placeholder="예: 봄맞이 실관람 인증 이벤트"
                />
              </Field>
              <Field>
                <Label>이벤트 메모 / 상세 설명</Label>
                <TextArea
                  name="memo"
                  value={form.memo}
                  onChange={handleFormChange}
                  maxLength={2000}
                  rows={4}
                  placeholder={'유저 카드 본문에 노출됩니다.\n(예: 영화관에서 촬영한 영수증을 업로드해 주세요. 인증 완료 시 500P 지급!)'}
                />
              </Field>
              <FieldRow>
                <Field>
                  <Label>시작일 *</Label>
                  <Input
                    type="datetime-local"
                    name="startDate"
                    value={form.startDate}
                    onChange={handleFormChange}
                    required
                  />
                </Field>
                <Field>
                  <Label>종료일 *</Label>
                  <Input
                    type="datetime-local"
                    name="endDate"
                    value={form.endDate}
                    onChange={handleFormChange}
                    required
                  />
                </Field>
              </FieldRow>
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
const FilterSelect = styled.select`
  padding: 6px 10px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.bgCard};
  color: ${({ theme }) => theme.colors.textPrimary};
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
const PeriodText = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: 'Menlo', 'Monaco', monospace;
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
  background: ${({ $color }) => $color};
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
  max-width: 540px;
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
`;
/**
 * 메모(상세 설명) 입력용 textarea.
 * Input 과 동일한 시각 언어를 유지하면서 여러 줄 입력을 허용한다.
 */
const TextArea = styled.textarea`
  width: 100%;
  padding: 7px 10px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.bgCard};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  &:focus { border-color: ${({ theme }) => theme.colors.primary}; outline: none; }
`;
/** 테이블 "제목/메모" 컬럼의 제목 텍스트 (강조) */
const TitleText = styled.div`
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  word-break: break-word;
`;
/**
 * 테이블 "제목/메모" 컬럼의 메모 미리보기.
 * 2줄로 제한 — 긴 텍스트는 줄임표로 자르고 hover 시 title 속성으로 전체 노출 가능.
 */
const MemoPreview = styled.div`
  margin-top: 2px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  white-space: pre-wrap;
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
