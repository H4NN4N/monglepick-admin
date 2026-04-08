/**
 * 운영 도구 — 리워드 정책(RewardPolicy) 관리 탭.
 *
 * 기능:
 * - 정책 목록 조회 (페이징)
 * - 신규 정책 등록 모달
 * - 정책 수정 모달 (actionType 제외, 변경 사유 입력)
 * - 활성/비활성 토글
 * - 변경 이력 패널 (INSERT-ONLY 원장 표시)
 *
 * 운영 주의:
 * - actionType은 시스템 식별 코드. 신규 등록 시에만 입력 가능
 * - 모든 변경 작업은 RewardPolicyHistory에 자동 기록 (변경/삭제 불가)
 * - 폐지된 정책은 hard delete 미지원, 활성/비활성 토글만 가능
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdAdd, MdEdit, MdToggleOn, MdToggleOff, MdHistory } from 'react-icons/md';
import {
  fetchRewardPolicies,
  fetchRewardPolicyHistory,
  createRewardPolicy,
  updateRewardPolicy,
  updateRewardPolicyActive,
} from '../api/rewardPolicyApi';

const PAGE_SIZE = 10;

/** 활동 카테고리 옵션 */
const CATEGORY_OPTIONS = [
  { value: 'CONTENT', label: 'CONTENT (콘텐츠 생산)' },
  { value: 'ENGAGEMENT', label: 'ENGAGEMENT (참여)' },
  { value: 'MILESTONE', label: 'MILESTONE (마일스톤)' },
  { value: 'ATTENDANCE', label: 'ATTENDANCE (출석)' },
];

/** 포인트 유형 */
const POINT_TYPES = [
  { value: 'earn', label: 'earn (등급 배율 적용)' },
  { value: 'bonus', label: 'bonus (고정 보너스)' },
];

const MODE_CREATE = 'CREATE';
const MODE_EDIT = 'EDIT';

const EMPTY_FORM = {
  actionType: '',
  activityName: '',
  actionCategory: 'CONTENT',
  pointsAmount: 0,
  pointType: 'earn',
  dailyLimit: 0,
  maxCount: 0,
  cooldownSeconds: 0,
  minContentLength: 0,
  limitType: '',
  thresholdCount: 0,
  thresholdTarget: '',
  parentActionType: '',
  isActive: true,
  description: '',
  changeReason: '',
};

export default function RewardPolicyTab() {
  const [policies, setPolicies] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalMode, setModalMode] = useState(null);
  const [editTargetId, setEditTargetId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  /* ── 변경 이력 패널 ── */
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadPolicies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchRewardPolicies({ page, size: PAGE_SIZE });
      setPolicies(result?.content ?? []);
      setTotalPages(result?.totalPages ?? 0);
    } catch (err) {
      setError(err.message || '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);

  function openCreateModal() {
    setForm(EMPTY_FORM);
    setEditTargetId(null);
    setModalMode(MODE_CREATE);
  }

  function openEditModal(item) {
    setForm({
      actionType: item.actionType ?? '',
      activityName: item.activityName ?? '',
      actionCategory: item.actionCategory ?? 'CONTENT',
      pointsAmount: item.pointsAmount ?? 0,
      pointType: item.pointType ?? 'earn',
      dailyLimit: item.dailyLimit ?? 0,
      maxCount: item.maxCount ?? 0,
      cooldownSeconds: item.cooldownSeconds ?? 0,
      minContentLength: item.minContentLength ?? 0,
      limitType: item.limitType ?? '',
      thresholdCount: item.thresholdCount ?? 0,
      thresholdTarget: item.thresholdTarget ?? '',
      parentActionType: item.parentActionType ?? '',
      isActive: !!item.isActive,
      description: item.description ?? '',
      changeReason: '',
    });
    setEditTargetId(item.policyId);
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
      const toIntOrZero = (v) => (v === '' || v == null ? 0 : Number(v));
      if (modalMode === MODE_CREATE) {
        const payload = {
          actionType: form.actionType?.trim(),
          activityName: form.activityName?.trim(),
          actionCategory: form.actionCategory,
          pointsAmount: toIntOrZero(form.pointsAmount),
          pointType: form.pointType || 'earn',
          dailyLimit: toIntOrZero(form.dailyLimit),
          maxCount: toIntOrZero(form.maxCount),
          cooldownSeconds: toIntOrZero(form.cooldownSeconds),
          minContentLength: toIntOrZero(form.minContentLength),
          limitType: form.limitType || null,
          thresholdCount: toIntOrZero(form.thresholdCount),
          thresholdTarget: form.thresholdTarget || null,
          parentActionType: form.parentActionType || null,
          isActive: !!form.isActive,
          description: form.description || null,
          changeReason: form.changeReason || '신규 정책 등록',
        };
        await createRewardPolicy(payload);
      } else if (modalMode === MODE_EDIT && editTargetId != null) {
        const payload = {
          pointsAmount: toIntOrZero(form.pointsAmount),
          dailyLimit: toIntOrZero(form.dailyLimit),
          maxCount: toIntOrZero(form.maxCount),
          cooldownSeconds: toIntOrZero(form.cooldownSeconds),
          minContentLength: toIntOrZero(form.minContentLength),
          description: form.description || null,
          changeReason: form.changeReason || '정책 메타 수정',
        };
        await updateRewardPolicy(editTargetId, payload);
      }
      closeModal();
      loadPolicies();
    } catch (err) {
      alert(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(item) {
    if (busyId === item.policyId) return;
    const reason = prompt(
      `정책 "${item.actionType}"를 ${item.isActive ? '비활성화' : '활성화'}합니다.\n변경 사유를 입력하세요:`,
      item.isActive ? '정책 일시 중단' : '정책 재활성화'
    );
    if (reason == null) return;
    try {
      setBusyId(item.policyId);
      await updateRewardPolicyActive(item.policyId, !item.isActive, reason);
      loadPolicies();
    } catch (err) {
      alert(err.message || '상태 변경 실패');
    } finally {
      setBusyId(null);
    }
  }

  /** 변경 이력 패널 열기 */
  async function openHistory(item) {
    setHistoryOpen(true);
    setHistoryTarget(item);
    setHistory([]);
    try {
      setHistoryLoading(true);
      const result = await fetchRewardPolicyHistory(item.policyId);
      setHistory(Array.isArray(result) ? result : []);
    } catch (err) {
      alert(err.message || '이력 조회 실패');
    } finally {
      setHistoryLoading(false);
    }
  }

  function closeHistory() {
    setHistoryOpen(false);
    setHistoryTarget(null);
    setHistory([]);
  }

  return (
    <Container>
      <Toolbar>
        <ToolbarTitle>리워드 정책 관리</ToolbarTitle>
        <ToolbarRight>
          <PrimaryButton onClick={openCreateModal}>
            <MdAdd size={16} /> 신규 등록
          </PrimaryButton>
          <IconButton onClick={loadPolicies} disabled={loading} title="새로고침">
            <MdRefresh size={16} />
          </IconButton>
        </ToolbarRight>
      </Toolbar>

      <HelperText>
        활동별 포인트 정책 마스터를 관리합니다. <strong>action_type</strong>은 시스템 식별 코드이며 신규 등록 시에만 입력 가능합니다.
        모든 변경 작업은 <strong>RewardPolicyHistory(INSERT-ONLY 원장)</strong>에 자동 기록되며, 이력은 수정·삭제할 수 없습니다.
      </HelperText>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th $w="60px">ID</Th>
              <Th $w="180px">활동 코드</Th>
              <Th>표시명</Th>
              <Th $w="100px">카테고리</Th>
              <Th $w="80px">포인트</Th>
              <Th $w="80px">유형</Th>
              <Th $w="80px">일한도</Th>
              <Th $w="80px">평한도</Th>
              <Th $w="80px">활성</Th>
              <Th $w="240px">액션</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10}><CenterCell>불러오는 중...</CenterCell></td></tr>
            ) : policies.length === 0 ? (
              <tr><td colSpan={10}><CenterCell>등록된 정책이 없습니다.</CenterCell></td></tr>
            ) : (
              policies.map((item) => (
                <Tr key={item.policyId}>
                  <Td><MutedText>{item.policyId}</MutedText></Td>
                  <Td><CodeText>{item.actionType}</CodeText></Td>
                  <Td>
                    <NameText>{item.activityName}</NameText>
                    {item.description && <DescText>{item.description}</DescText>}
                  </Td>
                  <Td><CategoryBadge>{item.actionCategory}</CategoryBadge></Td>
                  <Td><PointsText>{(item.pointsAmount ?? 0).toLocaleString()}P</PointsText></Td>
                  <Td><MutedText>{item.pointType ?? '-'}</MutedText></Td>
                  <Td><MutedText>{item.dailyLimit === 0 ? '∞' : item.dailyLimit}</MutedText></Td>
                  <Td><MutedText>{item.maxCount === 0 ? '∞' : item.maxCount}</MutedText></Td>
                  <Td>
                    <StatusPill $active={item.isActive}>
                      {item.isActive ? '활성' : '비활성'}
                    </StatusPill>
                  </Td>
                  <Td>
                    <ActionGroup>
                      <SmallButton onClick={() => openEditModal(item)}>
                        <MdEdit size={13} /> 수정
                      </SmallButton>
                      <SmallButton
                        onClick={() => handleToggleActive(item)}
                        disabled={busyId === item.policyId}
                      >
                        {item.isActive ? <MdToggleOff size={14} /> : <MdToggleOn size={14} />}
                        {item.isActive ? ' 비활성' : ' 활성'}
                      </SmallButton>
                      <SmallButton onClick={() => openHistory(item)}>
                        <MdHistory size={13} /> 이력
                      </SmallButton>
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
              {modalMode === MODE_CREATE ? '리워드 정책 신규 등록' : '리워드 정책 수정'}
            </DialogTitle>
            <form onSubmit={handleSubmit}>
              {modalMode === MODE_CREATE && (
                <FieldRow>
                  <Field>
                    <Label>활동 코드 (UNIQUE) *</Label>
                    <Input
                      type="text"
                      name="actionType"
                      value={form.actionType}
                      onChange={handleFormChange}
                      required
                      maxLength={50}
                      placeholder="예: REVIEW_CREATE, ATTENDANCE_BASE"
                    />
                  </Field>
                  <Field>
                    <Label>활동 표시명 *</Label>
                    <Input
                      type="text"
                      name="activityName"
                      value={form.activityName}
                      onChange={handleFormChange}
                      required
                      maxLength={100}
                    />
                  </Field>
                </FieldRow>
              )}
              {modalMode === MODE_CREATE && (
                <FieldRow>
                  <Field>
                    <Label>카테고리 *</Label>
                    <Select name="actionCategory" value={form.actionCategory} onChange={handleFormChange}>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field>
                    <Label>포인트 유형</Label>
                    <Select name="pointType" value={form.pointType} onChange={handleFormChange}>
                      {POINT_TYPES.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </Select>
                  </Field>
                </FieldRow>
              )}
              <FieldRow>
                <Field>
                  <Label>지급 포인트 *</Label>
                  <Input
                    type="number"
                    name="pointsAmount"
                    value={form.pointsAmount}
                    onChange={handleFormChange}
                    required
                    min="0"
                  />
                </Field>
                <Field>
                  <Label>일일 한도 (0=무제한)</Label>
                  <Input
                    type="number"
                    name="dailyLimit"
                    value={form.dailyLimit}
                    onChange={handleFormChange}
                    min="0"
                  />
                </Field>
                <Field>
                  <Label>평생 한도 (0=무제한)</Label>
                  <Input
                    type="number"
                    name="maxCount"
                    value={form.maxCount}
                    onChange={handleFormChange}
                    min="0"
                  />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field>
                  <Label>쿨다운 (초)</Label>
                  <Input
                    type="number"
                    name="cooldownSeconds"
                    value={form.cooldownSeconds}
                    onChange={handleFormChange}
                    min="0"
                  />
                </Field>
                <Field>
                  <Label>최소 콘텐츠 길이</Label>
                  <Input
                    type="number"
                    name="minContentLength"
                    value={form.minContentLength}
                    onChange={handleFormChange}
                    min="0"
                  />
                </Field>
              </FieldRow>
              {modalMode === MODE_CREATE && (
                <FieldRow>
                  <Field>
                    <Label>limit_type (보조 분류)</Label>
                    <Input
                      type="text"
                      name="limitType"
                      value={form.limitType}
                      onChange={handleFormChange}
                      maxLength={20}
                      placeholder="ONCE / DAILY / STREAK / PER_REF"
                    />
                  </Field>
                  <Field>
                    <Label>thresholdTarget</Label>
                    <Input
                      type="text"
                      name="thresholdTarget"
                      value={form.thresholdTarget}
                      onChange={handleFormChange}
                      maxLength={30}
                      placeholder="TOTAL / DAILY / STREAK"
                    />
                  </Field>
                </FieldRow>
              )}
              {modalMode === MODE_CREATE && (
                <FieldRow>
                  <Field>
                    <Label>thresholdCount</Label>
                    <Input
                      type="number"
                      name="thresholdCount"
                      value={form.thresholdCount}
                      onChange={handleFormChange}
                      min="0"
                    />
                  </Field>
                  <Field>
                    <Label>parentActionType</Label>
                    <Input
                      type="text"
                      name="parentActionType"
                      value={form.parentActionType}
                      onChange={handleFormChange}
                      maxLength={50}
                      placeholder="예: REVIEW_CREATE (마일스톤만)"
                    />
                  </Field>
                </FieldRow>
              )}
              <Field>
                <Label>설명</Label>
                <Textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  rows={2}
                  maxLength={500}
                  placeholder="정책 의도, 주의사항 등"
                />
              </Field>
              <Field>
                <Label>변경 사유 (이력 기록용)</Label>
                <Textarea
                  name="changeReason"
                  value={form.changeReason}
                  onChange={handleFormChange}
                  rows={2}
                  placeholder="이 변경의 사유를 입력하세요 (RewardPolicyHistory에 기록됨)"
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

      {/* ── 변경 이력 패널 ── */}
      {historyOpen && (
        <Overlay onClick={closeHistory}>
          <DialogBox $wide onClick={(e) => e.stopPropagation()}>
            <DialogTitle>
              변경 이력 — {historyTarget?.actionType}
            </DialogTitle>
            <HistoryList>
              {historyLoading ? (
                <CenterCell>불러오는 중...</CenterCell>
              ) : history.length === 0 ? (
                <CenterCell>변경 이력이 없습니다.</CenterCell>
              ) : (
                history.map((h) => (
                  <HistoryItem key={h.historyId}>
                    <HistoryHead>
                      <span>
                        <strong>#{h.historyId}</strong> · {h.changedBy ?? 'SYSTEM'}
                      </span>
                      <MutedText>{h.createdAt}</MutedText>
                    </HistoryHead>
                    <HistoryReason>{h.changeReason}</HistoryReason>
                    {h.beforeValue && (
                      <HistoryDiff>
                        <DiffLabel>BEFORE</DiffLabel>
                        <DiffJson>{h.beforeValue}</DiffJson>
                      </HistoryDiff>
                    )}
                    <HistoryDiff>
                      <DiffLabel $after>AFTER</DiffLabel>
                      <DiffJson>{h.afterValue}</DiffJson>
                    </HistoryDiff>
                  </HistoryItem>
                ))
              )}
            </HistoryList>
            <DialogFooter>
              <CancelButton type="button" onClick={closeHistory}>닫기</CancelButton>
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
  margin-bottom: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
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
const NameText = styled.div`
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textPrimary};
`;
const DescText = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
const PointsText = styled.span`
  color: ${({ theme }) => theme.colors.primary};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
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
  max-width: ${({ $wide }) => ($wide ? '720px' : '640px')};
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
const Select = styled.select`
  width: 100%;
  padding: 7px 10px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.bgCard};
  color: ${({ theme }) => theme.colors.textPrimary};
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

/* ── 변경 이력 ── */
const HistoryList = styled.div`
  max-height: 60vh;
  overflow-y: auto;
`;
const HistoryItem = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.borderLight};
  border-radius: 4px;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;
const HistoryHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;
const HistoryReason = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;
const HistoryDiff = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;
const DiffLabel = styled.div`
  display: inline-block;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  border-radius: 3px;
  color: #fff;
  background: ${({ $after, theme }) =>
    $after ? theme.colors.success ?? '#10b981' : theme.colors.textMuted};
  margin-bottom: 4px;
`;
const DiffJson = styled.pre`
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 11px;
  background: ${({ theme }) => theme.colors.bgHover};
  padding: ${({ theme }) => theme.spacing.sm};
  border-radius: 3px;
  white-space: pre-wrap;
  word-break: break-all;
  color: ${({ theme }) => theme.colors.textSecondary};
  max-height: 200px;
  overflow-y: auto;
`;
