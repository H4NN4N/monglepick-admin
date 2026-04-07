/**
 * 운영 도구 — 퀴즈(Quiz) 관리 탭.
 *
 * 기능:
 * - 퀴즈 목록 조회 (페이징 + 상태 필터)
 * - 신규 등록 모달 (PENDING 상태로 INSERT)
 * - 수정 모달 (movieId/question/explanation/correctAnswer/options/rewardPoint/quizDate)
 * - 상태 전이 버튼 (PENDING→APPROVED/REJECTED, APPROVED→PUBLISHED/REJECTED 등)
 * - 삭제 버튼 (PENDING/REJECTED만 hard delete 허용)
 *
 * 상태 전이 정책:
 * - PENDING   → APPROVED, REJECTED
 * - APPROVED  → PUBLISHED, REJECTED
 * - REJECTED  → PENDING (재검수)
 * - PUBLISHED → REJECTED (긴급 회수)
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdAdd, MdEdit, MdDelete } from 'react-icons/md';
import {
  fetchQuizzes,
  createQuiz,
  updateQuiz,
  updateQuizStatus,
  deleteQuiz,
} from '../api/quizApi';

/** 페이지 크기 */
const PAGE_SIZE = 10;

/** 상태 필터 옵션 */
const STATUS_FILTER_OPTIONS = [
  { value: '', label: '전체 상태' },
  { value: 'PENDING', label: '검수 대기 (PENDING)' },
  { value: 'APPROVED', label: '검수 통과 (APPROVED)' },
  { value: 'REJECTED', label: '탈락 (REJECTED)' },
  { value: 'PUBLISHED', label: '출제 중 (PUBLISHED)' },
];

/** 상태별 색상 (배지) */
const STATUS_COLOR = {
  PENDING: '#f59e0b',
  APPROVED: '#3b82f6',
  REJECTED: '#ef4444',
  PUBLISHED: '#10b981',
};

/**
 * 상태별 가능한 전이 액션 (Backend AdminQuizService.STATUS_TRANSITIONS와 동일).
 */
const STATUS_TRANSITION_BUTTONS = {
  PENDING: [
    { label: '승인', target: 'APPROVED' },
    { label: '탈락', target: 'REJECTED' },
  ],
  APPROVED: [
    { label: '출제', target: 'PUBLISHED' },
    { label: '탈락', target: 'REJECTED' },
  ],
  REJECTED: [
    { label: '재검수', target: 'PENDING' },
  ],
  PUBLISHED: [
    { label: '회수', target: 'REJECTED' },
  ],
};

/** 모달 모드 */
const MODE_CREATE = 'CREATE';
const MODE_EDIT = 'EDIT';

/** 빈 폼 초기값 */
const EMPTY_FORM = {
  movieId: '',
  question: '',
  explanation: '',
  correctAnswer: '',
  options: '',
  rewardPoint: 10,
  quizDate: '',
};

export default function QuizManagementTab() {
  /* ── 목록 상태 ── */
  const [quizzes, setQuizzes] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ── 모달 상태 ── */
  const [modalMode, setModalMode] = useState(null);
  const [editTargetId, setEditTargetId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  /* ── 작업 진행 상태 ── */
  const [busyId, setBusyId] = useState(null);

  /** 목록 조회 */
  const loadQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, size: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      const result = await fetchQuizzes(params);
      setQuizzes(result?.content ?? []);
      setTotalPages(result?.totalPages ?? 0);
    } catch (err) {
      setError(err.message || '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  /** 상태 필터 변경 — 첫 페이지로 초기화 */
  function handleStatusFilterChange(e) {
    setStatusFilter(e.target.value);
    setPage(0);
  }

  /** 신규 등록 모달 */
  function openCreateModal() {
    setForm(EMPTY_FORM);
    setEditTargetId(null);
    setModalMode(MODE_CREATE);
  }

  /** 수정 모달 — 기존 값 로드 */
  function openEditModal(item) {
    setForm({
      movieId: item.movieId ?? '',
      question: item.question ?? '',
      explanation: item.explanation ?? '',
      correctAnswer: item.correctAnswer ?? '',
      options: item.options ?? '',
      rewardPoint: item.rewardPoint ?? 10,
      quizDate: item.quizDate ?? '',
    });
    setEditTargetId(item.quizId);
    setModalMode(MODE_EDIT);
  }

  /** 모달 닫기 */
  function closeModal() {
    setModalMode(null);
    setEditTargetId(null);
    setForm(EMPTY_FORM);
    setSubmitting(false);
  }

  /** 폼 입력 핸들러 */
  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  /** 폼 제출 */
  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    try {
      setSubmitting(true);
      const payload = {
        movieId: form.movieId || null,
        question: form.question?.trim(),
        explanation: form.explanation || null,
        correctAnswer: form.correctAnswer?.trim(),
        options: form.options || null,
        rewardPoint: form.rewardPoint === '' ? 10 : Number(form.rewardPoint),
        quizDate: form.quizDate || null,
      };

      if (modalMode === MODE_CREATE) {
        // 신규 등록 — generateQuiz 는 quizDate 미지원이므로 본문만 전달
        await createQuiz({
          movieId: payload.movieId,
          question: payload.question,
          correctAnswer: payload.correctAnswer,
          options: payload.options,
          explanation: payload.explanation,
          rewardPoint: payload.rewardPoint,
        });
      } else if (modalMode === MODE_EDIT && editTargetId != null) {
        await updateQuiz(editTargetId, payload);
      }
      closeModal();
      loadQuizzes();
    } catch (err) {
      alert(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  /** 상태 전이 */
  async function handleTransition(item, targetStatus) {
    if (busyId === item.quizId) return;
    if (!confirm(`퀴즈 #${item.quizId}를 ${targetStatus} 상태로 전이합니다. 진행하시겠습니까?`)) {
      return;
    }
    try {
      setBusyId(item.quizId);
      await updateQuizStatus(item.quizId, targetStatus);
      loadQuizzes();
    } catch (err) {
      alert(err.message || '상태 전이 실패');
    } finally {
      setBusyId(null);
    }
  }

  /** 삭제 */
  async function handleDelete(item) {
    if (busyId === item.quizId) return;
    if (!confirm(`퀴즈 #${item.quizId}를 삭제합니다. 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }
    try {
      setBusyId(item.quizId);
      await deleteQuiz(item.quizId);
      loadQuizzes();
    } catch (err) {
      alert(err.message || '삭제 실패');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Container>
      {/* ── 툴바 ── */}
      <Toolbar>
        <ToolbarLeft>
          <ToolbarTitle>퀴즈 관리</ToolbarTitle>
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
          <IconButton onClick={loadQuizzes} disabled={loading} title="새로고침">
            <MdRefresh size={16} />
          </IconButton>
        </ToolbarRight>
      </Toolbar>

      {/* ── 안내 ── */}
      <HelperText>
        <strong>상태 전이:</strong> PENDING→APPROVED/REJECTED, APPROVED→PUBLISHED/REJECTED,
        REJECTED→PENDING(재검수), PUBLISHED→REJECTED(긴급 회수).
        <strong> 삭제는 PENDING/REJECTED 상태만 가능</strong>합니다.
      </HelperText>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      {/* ── 테이블 ── */}
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th $w="60px">ID</Th>
              <Th $w="100px">영화ID</Th>
              <Th>문제</Th>
              <Th $w="100px">정답</Th>
              <Th $w="80px">보상P</Th>
              <Th $w="100px">상태</Th>
              <Th $w="100px">출제일</Th>
              <Th $w="280px">액션</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}><CenterCell>불러오는 중...</CenterCell></td></tr>
            ) : quizzes.length === 0 ? (
              <tr><td colSpan={8}><CenterCell>등록된 퀴즈가 없습니다.</CenterCell></td></tr>
            ) : (
              quizzes.map((item) => (
                <Tr key={item.quizId}>
                  <Td><MutedText>{item.quizId}</MutedText></Td>
                  <Td><MutedText>{item.movieId ?? '-'}</MutedText></Td>
                  <Td>
                    <QuestionText>{item.question}</QuestionText>
                  </Td>
                  <Td><MutedText>{item.correctAnswer ?? '-'}</MutedText></Td>
                  <Td><MutedText>{(item.rewardPoint ?? 0).toLocaleString()}</MutedText></Td>
                  <Td>
                    <StatusPill $color={STATUS_COLOR[item.status] ?? '#888'}>
                      {item.status}
                    </StatusPill>
                  </Td>
                  <Td><MutedText>{item.quizDate ?? '-'}</MutedText></Td>
                  <Td>
                    <ActionGroup>
                      <SmallButton onClick={() => openEditModal(item)} title="수정">
                        <MdEdit size={13} /> 수정
                      </SmallButton>
                      {(STATUS_TRANSITION_BUTTONS[item.status] ?? []).map((btn) => (
                        <SmallButton
                          key={btn.target}
                          onClick={() => handleTransition(item, btn.target)}
                          disabled={busyId === item.quizId}
                          title={`${item.status} → ${btn.target}`}
                        >
                          {btn.label}
                        </SmallButton>
                      ))}
                      {(item.status === 'PENDING' || item.status === 'REJECTED') && (
                        <DangerSmallButton
                          onClick={() => handleDelete(item)}
                          disabled={busyId === item.quizId}
                          title="삭제"
                        >
                          <MdDelete size={13} /> 삭제
                        </DangerSmallButton>
                      )}
                    </ActionGroup>
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
      {modalMode && (
        <Overlay onClick={closeModal}>
          <DialogBox onClick={(e) => e.stopPropagation()}>
            <DialogTitle>
              {modalMode === MODE_CREATE ? '퀴즈 신규 등록 (PENDING)' : '퀴즈 수정'}
            </DialogTitle>
            <form onSubmit={handleSubmit}>
              <FieldRow>
                <Field>
                  <Label>영화 ID (선택)</Label>
                  <Input
                    type="text"
                    name="movieId"
                    value={form.movieId}
                    onChange={handleFormChange}
                    placeholder="영화 ID (일반 퀴즈는 비워둠)"
                    maxLength={50}
                  />
                </Field>
                <Field>
                  <Label>보상 포인트</Label>
                  <Input
                    type="number"
                    name="rewardPoint"
                    value={form.rewardPoint}
                    onChange={handleFormChange}
                    min={0}
                  />
                </Field>
              </FieldRow>
              <Field>
                <Label>문제 *</Label>
                <Textarea
                  name="question"
                  value={form.question}
                  onChange={handleFormChange}
                  required
                  rows={3}
                  placeholder="퀴즈 문제 본문"
                />
              </Field>
              <Field>
                <Label>정답 *</Label>
                <Input
                  type="text"
                  name="correctAnswer"
                  value={form.correctAnswer}
                  onChange={handleFormChange}
                  required
                  maxLength={500}
                  placeholder="예: A 또는 정답 본문"
                />
              </Field>
              <Field>
                <Label>선택지 (JSON 배열, 객관식만)</Label>
                <Textarea
                  name="options"
                  value={form.options}
                  onChange={handleFormChange}
                  rows={2}
                  placeholder='예: ["A지문", "B지문", "C지문", "D지문"]'
                />
                <FieldHint>주관식 퀴즈는 비워두세요.</FieldHint>
              </Field>
              <Field>
                <Label>해설</Label>
                <Textarea
                  name="explanation"
                  value={form.explanation}
                  onChange={handleFormChange}
                  rows={2}
                  placeholder="정답 해설 (선택)"
                />
              </Field>
              {/* quizDate 는 신규 등록 EP 미지원 — 수정 모달에서만 노출 */}
              {modalMode === MODE_EDIT && (
                <Field>
                  <Label>출제 예정일 (YYYY-MM-DD)</Label>
                  <Input
                    type="date"
                    name="quizDate"
                    value={form.quizDate}
                    onChange={handleFormChange}
                  />
                </Field>
              )}
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
  &:focus { border-color: ${({ theme }) => theme.colors.primary}; outline: none; }
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

const QuestionText = styled.div`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  max-width: 400px;
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

/* ── 모달 ── */

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
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
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
