/**
 * 관리자 — 영화 티켓 추첨 관리 탭 (2026-04-28 신규).
 *
 * 결제/포인트 페이지의 서브탭으로 노출되며, 5개 EP 를 단일 화면에서 다룬다:
 *  - 회차 목록 (status 필터, 페이징)
 *  - 회차 상세 + winner_count / notes 인라인 수정
 *  - 수동 추첨 트리거 (확인 다이얼로그)
 *  - 응모자 명단 (회차 상세 모달 안에서 status 필터, 페이징)
 *
 * 운영 흐름:
 *  1) 회차 목록에서 PENDING 회차의 winner_count 를 조정 (필요 시)
 *  2) 자동 배치(매월 1일 0시) 외에 즉시 추첨이 필요하면 [수동 추첨] 클릭
 *  3) 추첨 완료된 회차에서 응모자 명단을 status=WON 으로 필터링해 당첨자 확인
 *  4) 당첨자 정보(닉네임/이메일) 를 기반으로 외부 채널로 영화티켓 발송
 *
 * @module LotteryTab
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import {
  MdRefresh,
  MdCasino,
  MdEdit,
  MdClose,
  MdAdd,
  MdRestartAlt,
  MdFileDownload,
  MdSearch,
  MdWarningAmber,
} from 'react-icons/md';
import {
  fetchLotteryCycles,
  fetchLotteryCycle,
  updateLotteryCycle,
  drawLotteryCycle,
  fetchLotteryEntries,
  createLotteryCycle,
  resetLotteryCycle,
  downloadLotteryEntriesCsv,
} from '../api/lotteryApi';

/** 한 페이지에 표시할 회차 수 */
const PAGE_SIZE = 10;
/** 한 페이지에 표시할 응모자 수 */
const ENTRY_PAGE_SIZE = 50;

/** 회차 상태 → 표시 라벨 */
const LOTTERY_STATUS_LABEL = {
  PENDING: '대기',
  DRAWING: '추첨 중',
  COMPLETED: '완료',
};

/** entry 상태 → 표시 라벨 */
const ENTRY_STATUS_LABEL = {
  PENDING: '대기',
  WON: '당첨',
  LOST: '미당첨',
};

/** 숫자 천단위 콤마 포맷 */
function fmt(n) {
  return (n ?? 0).toLocaleString('ko-KR');
}

/** ISO datetime → 'YYYY-MM-DD HH:mm' 표기 */
function formatDateTime(s) {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function LotteryTab() {
  /* ── 회차 목록 상태 ── */
  const [cycles, setCycles] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState(''); // '' = 전체
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ── 상세 모달 상태 ── */
  const [detailLottery, setDetailLottery] = useState(null);   // LotterySummary | null
  const [detailLoading, setDetailLoading] = useState(false);
  /* 인라인 수정 폼 (모달 내) */
  const [editWinnerCount, setEditWinnerCount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState(false);

  /* ── 응모자 명단 상태 (상세 모달 내) ── */
  const [entries, setEntries] = useState([]);
  const [entriesTotalPages, setEntriesTotalPages] = useState(0);
  const [entriesTotalElements, setEntriesTotalElements] = useState(0);
  const [entriesPage, setEntriesPage] = useState(0);
  const [entryStatusFilter, setEntryStatusFilter] = useState(''); // '' = 전체
  const [entryKeyword, setEntryKeyword] = useState('');
  const [entryKeywordCommitted, setEntryKeywordCommitted] = useState('');
  const [entriesLoading, setEntriesLoading] = useState(false);

  /* ── 회차 생성 모달 상태 (2026-04-29) ── */
  const [createOpen, setCreateOpen] = useState(false);
  const [createCycle, setCreateCycle] = useState('');         // 'YYYY-MM'
  const [createWinnerCount, setCreateWinnerCount] = useState('5');
  const [creating, setCreating] = useState(false);

  /* ── 수동 추첨 강제 확인 모달 상태 ── */
  const [drawConfirmOpen, setDrawConfirmOpen] = useState(false);
  const [drawConfirmInput, setDrawConfirmInput] = useState('');

  /* ── 회차 목록 로드 ── */
  const loadCycles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, size: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      const result = await fetchLotteryCycles(params);
      setCycles(result?.content ?? []);
      setTotalPages(result?.totalPages ?? 0);
      setTotalElements(result?.totalElements ?? 0);
    } catch (err) {
      setError(err.message || '회차 목록 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { loadCycles(); }, [loadCycles]);

  /* statusFilter 변경 시 1페이지로 리셋 */
  useEffect(() => { setPage(0); }, [statusFilter]);

  /* ── 응모자 명단 로드 (상세 모달 오픈 후 호출) ── */
  const loadEntries = useCallback(async (lotteryId) => {
    if (!lotteryId) return;
    try {
      setEntriesLoading(true);
      const params = { page: entriesPage, size: ENTRY_PAGE_SIZE };
      if (entryStatusFilter) params.status = entryStatusFilter;
      if (entryKeywordCommitted) params.keyword = entryKeywordCommitted;
      const result = await fetchLotteryEntries(lotteryId, params);
      setEntries(result?.content ?? []);
      setEntriesTotalPages(result?.totalPages ?? 0);
      setEntriesTotalElements(result?.totalElements ?? 0);
    } catch (err) {
      /* 모달 내 에러는 alert 로 노출 — 글로벌 error state 와 분리 */
      alert(err.message || '응모자 명단 조회 실패');
    } finally {
      setEntriesLoading(false);
    }
  }, [entriesPage, entryStatusFilter, entryKeywordCommitted]);

  /* 모달 오픈 또는 페이지/필터/키워드 변경 시 응모자 재로드 */
  useEffect(() => {
    if (detailLottery?.lotteryId) loadEntries(detailLottery.lotteryId);
  }, [detailLottery?.lotteryId, loadEntries]);

  /* ── 상단 KPI 통계 계산 (현재 페이지 기준) ── */
  const kpi = useMemo(() => {
    const completed = cycles.filter((c) => c.status === 'COMPLETED').length;
    const pending = cycles.filter((c) => c.status === 'PENDING').length;
    const drawing = cycles.filter((c) => c.status === 'DRAWING').length;
    const sumEntries = cycles.reduce((acc, c) => acc + (c.totalEntries || 0), 0);
    const sumWinners = cycles.reduce((acc, c) => acc + (c.wonCount || 0), 0);
    return { completed, pending, drawing, sumEntries, sumWinners };
  }, [cycles]);

  /* ── 모달 핸들러 ── */

  /** 회차 상세 모달 오픈 — 최신 데이터 fetch + 폼 초기화 */
  async function openDetail(lottery) {
    try {
      setDetailLoading(true);
      const fresh = await fetchLotteryCycle(lottery.lotteryId);
      setDetailLottery(fresh);
      setEditWinnerCount(String(fresh.winnerCount ?? ''));
      setEditNotes(fresh.notes ?? '');
      setEntriesPage(0);
      setEntryStatusFilter('');
    } catch (err) {
      alert(err.message || '회차 상세 조회 실패');
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailLottery(null);
    setEditWinnerCount('');
    setEditNotes('');
    setEntries([]);
    setEntriesPage(0);
    setEntryStatusFilter('');
    setEntryKeyword('');
    setEntryKeywordCommitted('');
    setDrawConfirmOpen(false);
    setDrawConfirmInput('');
  }

  /** 회차 수정 (winnerCount/notes) */
  async function handleSaveDetail() {
    if (!detailLottery || savingDetail) return;
    const wc = editWinnerCount === '' ? null : Number(editWinnerCount);
    if (wc != null && (Number.isNaN(wc) || wc < 1 || wc > 1000)) {
      alert('당첨자 수는 1~1000 사이의 숫자여야 합니다.');
      return;
    }
    try {
      setSavingDetail(true);
      const payload = {};
      if (wc != null) payload.winnerCount = wc;
      if (editNotes !== detailLottery.notes) payload.notes = editNotes;
      if (Object.keys(payload).length === 0) {
        alert('변경된 내용이 없습니다.');
        return;
      }
      const updated = await updateLotteryCycle(detailLottery.lotteryId, payload);
      setDetailLottery(updated);
      /* 목록에도 반영하기 위해 재조회 */
      loadCycles();
      alert('회차 정보가 수정되었습니다.');
    } catch (err) {
      alert(err.message || '회차 수정 실패');
    } finally {
      setSavingDetail(false);
    }
  }

  /** 수동 추첨 — 강제 확인 모달 오픈 (회차명 직접 입력 요구) */
  function handleManualDrawClick() {
    if (!detailLottery) return;
    if (detailLottery.status === 'COMPLETED') {
      alert('이미 추첨이 완료된 회차입니다.');
      return;
    }
    if ((detailLottery.totalEntries ?? 0) === 0) {
      const proceed = confirm(
        '응모자가 0명입니다. 추첨하면 회차가 빈 상태로 COMPLETED 처리됩니다.\n\n그래도 진행하시겠습니까?'
      );
      if (!proceed) return;
    }
    setDrawConfirmInput('');
    setDrawConfirmOpen(true);
  }

  /** 수동 추첨 실제 실행 — 회차명 입력 일치 시에만 */
  async function executeManualDraw() {
    if (!detailLottery || drawing) return;
    if (drawConfirmInput.trim() !== detailLottery.cycleYearMonth) {
      alert(`회차명을 정확히 입력해주세요: ${detailLottery.cycleYearMonth}`);
      return;
    }
    try {
      setDrawing(true);
      const result = await drawLotteryCycle(detailLottery.lotteryId);
      alert(
        `추첨 완료\n` +
        `회차: ${result.cycleYearMonth}\n` +
        `당첨자 수: ${result.drawnCount}명\n` +
        `상태: ${LOTTERY_STATUS_LABEL[result.status] ?? result.status}`
      );
      /* 상세/응모자/목록 모두 재로드 */
      const fresh = await fetchLotteryCycle(detailLottery.lotteryId);
      setDetailLottery(fresh);
      setEditWinnerCount(String(fresh.winnerCount ?? ''));
      setEditNotes(fresh.notes ?? '');
      setEntriesPage(0);
      setEntryStatusFilter('WON'); // 추첨 직후 당첨자 자동 노출
      loadEntries(detailLottery.lotteryId);
      loadCycles();
      setDrawConfirmOpen(false);
      setDrawConfirmInput('');
    } catch (err) {
      alert(err.message || '수동 추첨 실패');
    } finally {
      setDrawing(false);
    }
  }

  /** DRAWING → PENDING 강제 복구 */
  async function handleResetDrawing() {
    if (!detailLottery || resetting) return;
    if (detailLottery.status !== 'DRAWING') {
      alert('DRAWING 상태가 아닌 회차는 복구할 수 없습니다.');
      return;
    }
    const confirmed = confirm(
      `회차 ${detailLottery.cycleYearMonth} 를 DRAWING → PENDING 으로 복구합니다.\n` +
      `정상적으로 추첨이 재시도 가능해집니다. 진행하시겠습니까?`
    );
    if (!confirmed) return;
    try {
      setResetting(true);
      const updated = await resetLotteryCycle(detailLottery.lotteryId);
      setDetailLottery(updated);
      loadCycles();
      alert('회차가 PENDING 으로 복구되었습니다. 다시 [수동 추첨] 을 시도해주세요.');
    } catch (err) {
      alert(err.message || '회차 복구 실패');
    } finally {
      setResetting(false);
    }
  }

  /** 응모자 명단 CSV 다운로드 */
  async function handleExportCsv() {
    if (!detailLottery || exporting) return;
    try {
      setExporting(true);
      const blob = await downloadLotteryEntriesCsv(
        detailLottery.lotteryId,
        entryStatusFilter || undefined,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const statusLabel = entryStatusFilter || 'ALL';
      a.download = `lottery-${detailLottery.cycleYearMonth}-${statusLabel}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'CSV 다운로드 실패');
    } finally {
      setExporting(false);
    }
  }

  /** 응모자 키워드 검색 — Enter 또는 [검색] 버튼 클릭 시 commit */
  function commitKeyword() {
    setEntriesPage(0);
    setEntryKeywordCommitted(entryKeyword);
  }

  /** 회차 강제 생성 모달 오픈 */
  function openCreateModal() {
    setCreateOpen(true);
    /* 기본값: 다음 달 회차 — 운영자가 사전 생성하는 가장 흔한 케이스 */
    const now = new Date();
    const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const yyyy = nm.getFullYear();
    const mm = String(nm.getMonth() + 1).padStart(2, '0');
    setCreateCycle(`${yyyy}-${mm}`);
    setCreateWinnerCount('5');
  }

  function closeCreateModal() {
    setCreateOpen(false);
    setCreateCycle('');
    setCreateWinnerCount('5');
  }

  /** 회차 강제 생성 실행 */
  async function handleCreateCycle() {
    if (creating) return;
    const cycleRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!cycleRegex.test(createCycle)) {
      alert('회차 형식은 YYYY-MM 이어야 합니다 (예: 2026-05)');
      return;
    }
    const wc = Number(createWinnerCount);
    if (Number.isNaN(wc) || wc < 1 || wc > 1000) {
      alert('당첨자 수는 1~1000 사이의 숫자여야 합니다.');
      return;
    }
    try {
      setCreating(true);
      await createLotteryCycle({ cycleYearMonth: createCycle, winnerCount: wc });
      closeCreateModal();
      loadCycles();
      alert(`회차 ${createCycle} 가 생성되었습니다.`);
    } catch (err) {
      alert(err.message || '회차 생성 실패');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Container>
      <Toolbar>
        <ToolbarTitle>추첨 관리</ToolbarTitle>
        <ToolbarRight>
          <FilterSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">전체 상태</option>
            <option value="PENDING">대기</option>
            <option value="DRAWING">추첨 중</option>
            <option value="COMPLETED">완료</option>
          </FilterSelect>
          <PrimaryButton onClick={openCreateModal} title="새 회차 강제 생성">
            <MdAdd size={16} /> 회차 생성
          </PrimaryButton>
          <IconButton onClick={loadCycles} disabled={loading} title="새로고침">
            <MdRefresh size={16} />
          </IconButton>
        </ToolbarRight>
      </Toolbar>

      {/* 상단 KPI — 현재 페이지 회차 기준 즉시 통계 */}
      <KpiRow>
        <KpiCard>
          <KpiLabel>전체 회차 (조회 결과)</KpiLabel>
          <KpiValue>{fmt(totalElements)}</KpiValue>
        </KpiCard>
        <KpiCard>
          <KpiLabel>현재 페이지 — 완료</KpiLabel>
          <KpiValue>{fmt(kpi.completed)}</KpiValue>
        </KpiCard>
        <KpiCard>
          <KpiLabel>현재 페이지 — 대기</KpiLabel>
          <KpiValue>{fmt(kpi.pending)}</KpiValue>
        </KpiCard>
        <KpiCard>
          <KpiLabel>현재 페이지 — 추첨 중</KpiLabel>
          <KpiValue style={{ color: kpi.drawing > 0 ? '#b26a00' : 'inherit' }}>
            {fmt(kpi.drawing)}
          </KpiValue>
        </KpiCard>
        <KpiCard>
          <KpiLabel>현재 페이지 — 응모자 합계</KpiLabel>
          <KpiValue>{fmt(kpi.sumEntries)}</KpiValue>
        </KpiCard>
        <KpiCard>
          <KpiLabel>현재 페이지 — 당첨자 합계</KpiLabel>
          <KpiValue>{fmt(kpi.sumWinners)}</KpiValue>
        </KpiCard>
      </KpiRow>

      <HelperText>
        매월 1일 0시 KST 자동 배치가 직전 월 회차를 추첨합니다. 운영 사고로 자동 배치가 누락된 경우
        회차 상세 화면의 <strong>수동 추첨</strong> 버튼으로 즉시 실행할 수 있습니다.
        당첨자에게는 닉네임/이메일을 기반으로 외부 채널(이메일/알림톡 등)로 티켓을 발송합니다.
        <br />
        DRAWING 상태에서 멈춘 회차는 상세 화면에서 <strong>회차 복구</strong> 버튼으로 PENDING 으로 되돌릴 수 있고,
        다음 달처럼 사전 회차가 필요한 경우 <strong>회차 생성</strong> 으로 직접 만들 수 있습니다.
        당첨자 명단은 <strong>CSV 다운로드</strong> 로 받아 외부 채널 발송 도구에 붙여넣으세요.
      </HelperText>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th $w="80px">ID</Th>
              <Th $w="120px">회차</Th>
              <Th $w="100px">상태</Th>
              <Th $w="100px">당첨 정원</Th>
              <Th $w="100px">응모자 수</Th>
              <Th $w="100px">당첨자 수</Th>
              <Th $w="160px">추첨 시각</Th>
              <Th $w="100px">액션</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}><CenterCell>불러오는 중...</CenterCell></td></tr>
            ) : cycles.length === 0 ? (
              <tr><td colSpan={8}><CenterCell>등록된 회차가 없습니다.</CenterCell></td></tr>
            ) : (
              cycles.map((c) => (
                <Tr key={c.lotteryId}>
                  <Td><MutedText>{c.lotteryId}</MutedText></Td>
                  <Td><CycleText>{c.cycleYearMonth}</CycleText></Td>
                  <Td>
                    <StatusPill $status={c.status}>
                      {LOTTERY_STATUS_LABEL[c.status] ?? c.status}
                    </StatusPill>
                  </Td>
                  <Td><NumberText>{fmt(c.winnerCount)}명</NumberText></Td>
                  <Td><NumberText>{fmt(c.totalEntries)}명</NumberText></Td>
                  <Td><NumberText>{fmt(c.wonCount)}명</NumberText></Td>
                  <Td><MutedText>{formatDateTime(c.drawnAt)}</MutedText></Td>
                  <Td>
                    <SmallButton onClick={() => openDetail(c)}>
                      <MdEdit size={13} /> 상세
                    </SmallButton>
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

      {/* 회차 상세 모달 — 폼 + 수동 추첨 + 응모자 명단 */}
      {detailLottery && (
        <Overlay onClick={closeDetail}>
          <DialogBox onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>
                회차 상세 — {detailLottery.cycleYearMonth}
                <StatusPill $status={detailLottery.status} style={{ marginLeft: 12 }}>
                  {LOTTERY_STATUS_LABEL[detailLottery.status] ?? detailLottery.status}
                </StatusPill>
              </DialogTitle>
              <CloseIcon onClick={closeDetail} title="닫기">
                <MdClose size={18} />
              </CloseIcon>
            </DialogHeader>

            {detailLoading ? (
              <DialogBody>불러오는 중...</DialogBody>
            ) : (
              <DialogBody>
                {/* 통계 카드 */}
                <StatsRow>
                  <StatCard>
                    <StatLabel>응모자 수</StatLabel>
                    <StatValue>{fmt(detailLottery.totalEntries)}명</StatValue>
                  </StatCard>
                  <StatCard>
                    <StatLabel>당첨자 수</StatLabel>
                    <StatValue>{fmt(detailLottery.wonCount)}명</StatValue>
                  </StatCard>
                  <StatCard>
                    <StatLabel>미당첨자 수</StatLabel>
                    <StatValue>{fmt(detailLottery.lostCount)}명</StatValue>
                  </StatCard>
                  <StatCard>
                    <StatLabel>당첨 정원</StatLabel>
                    <StatValue>{fmt(detailLottery.winnerCount)}명</StatValue>
                  </StatCard>
                </StatsRow>

                {/* 회차 수정 폼 */}
                <SectionTitle>회차 정보 수정</SectionTitle>
                <FieldRow>
                  <Field>
                    <Label>당첨 정원 (1~1000)</Label>
                    <Input
                      type="number"
                      value={editWinnerCount}
                      onChange={(e) => setEditWinnerCount(e.target.value)}
                      min="1"
                      max="1000"
                      disabled={detailLottery.status === 'COMPLETED'}
                    />
                  </Field>
                  <Field>
                    <Label>운영자 메모 (최대 500자)</Label>
                    <Textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      maxLength={500}
                      rows={2}
                    />
                  </Field>
                </FieldRow>
                {detailLottery.status === 'COMPLETED' && (
                  <FieldHint>이미 추첨이 완료된 회차입니다. 당첨 정원은 변경할 수 없으며, 메모만 수정 가능합니다.</FieldHint>
                )}

                <ActionRow>
                  <PrimaryButton onClick={handleSaveDetail} disabled={savingDetail}>
                    {savingDetail ? '저장 중...' : '저장'}
                  </PrimaryButton>
                  <DangerButton
                    onClick={handleManualDrawClick}
                    disabled={drawing || detailLottery.status === 'COMPLETED'}
                    title={detailLottery.status === 'COMPLETED' ? '이미 추첨된 회차입니다' : '비가역 작업'}
                  >
                    <MdCasino size={16} /> {drawing ? '추첨 중...' : '수동 추첨'}
                  </DangerButton>
                  {detailLottery.status === 'DRAWING' && (
                    <WarnButton onClick={handleResetDrawing} disabled={resetting}>
                      <MdRestartAlt size={16} /> {resetting ? '복구 중...' : '회차 복구 (DRAWING → PENDING)'}
                    </WarnButton>
                  )}
                </ActionRow>

                {/* 응모자 명단 */}
                <SectionTitleRow>
                  <SectionTitle>
                    응모자 명단{' '}
                    <SubtleCount>
                      ({fmt(entriesTotalElements)}
                      {entryKeywordCommitted ? ` · "${entryKeywordCommitted}" 일치` : ''})
                    </SubtleCount>
                  </SectionTitle>
                  <ToolbarRight>
                    <SearchBox>
                      <MdSearch size={14} />
                      <SearchInput
                        type="text"
                        placeholder="닉네임/이메일/userId"
                        value={entryKeyword}
                        onChange={(e) => setEntryKeyword(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitKeyword(); }}
                      />
                      <SmallButton onClick={commitKeyword}>검색</SmallButton>
                      {entryKeywordCommitted && (
                        <SmallButton onClick={() => { setEntryKeyword(''); setEntryKeywordCommitted(''); setEntriesPage(0); }}>
                          초기화
                        </SmallButton>
                      )}
                    </SearchBox>
                    <FilterSelect
                      value={entryStatusFilter}
                      onChange={(e) => { setEntryStatusFilter(e.target.value); setEntriesPage(0); }}
                    >
                      <option value="">전체 결과</option>
                      <option value="PENDING">대기</option>
                      <option value="WON">당첨</option>
                      <option value="LOST">미당첨</option>
                    </FilterSelect>
                    <SmallButton onClick={handleExportCsv} disabled={exporting} title="현재 필터 기준 CSV 다운로드">
                      <MdFileDownload size={14} /> {exporting ? '다운로드 중...' : 'CSV'}
                    </SmallButton>
                  </ToolbarRight>
                </SectionTitleRow>

                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th $w="80px">Entry ID</Th>
                        <Th $w="160px">User ID</Th>
                        <Th>닉네임</Th>
                        <Th>이메일</Th>
                        <Th $w="80px">결과</Th>
                        <Th $w="160px">응모 시각</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {entriesLoading ? (
                        <tr><td colSpan={6}><CenterCell>불러오는 중...</CenterCell></td></tr>
                      ) : entries.length === 0 ? (
                        <tr><td colSpan={6}><CenterCell>응모자가 없습니다.</CenterCell></td></tr>
                      ) : (
                        entries.map((e) => (
                          <Tr key={e.entryId}>
                            <Td><MutedText>{e.entryId}</MutedText></Td>
                            <Td><MonoText>{e.userId}</MonoText></Td>
                            <Td>{e.nickname ?? '-'}</Td>
                            <Td><MonoText>{e.email ?? '-'}</MonoText></Td>
                            <Td>
                              <EntryPill $status={e.status}>
                                {ENTRY_STATUS_LABEL[e.status] ?? e.status}
                              </EntryPill>
                            </Td>
                            <Td><MutedText>{formatDateTime(e.enrolledAt)}</MutedText></Td>
                          </Tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </TableWrap>

                {entriesTotalPages > 1 && (
                  <Pagination>
                    <PageButton
                      onClick={() => setEntriesPage((p) => p - 1)}
                      disabled={entriesPage === 0}
                    >
                      이전
                    </PageButton>
                    <PageInfo>{entriesPage + 1} / {entriesTotalPages}</PageInfo>
                    <PageButton
                      onClick={() => setEntriesPage((p) => p + 1)}
                      disabled={entriesPage + 1 >= entriesTotalPages}
                    >
                      다음
                    </PageButton>
                  </Pagination>
                )}
              </DialogBody>
            )}
          </DialogBox>
        </Overlay>
      )}

      {/* 회차 강제 생성 모달 */}
      {createOpen && (
        <Overlay onClick={closeCreateModal}>
          <SmallDialogBox onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>회차 강제 생성</DialogTitle>
              <CloseIcon onClick={closeCreateModal} title="닫기">
                <MdClose size={18} />
              </CloseIcon>
            </DialogHeader>
            <DialogBody>
              <FieldHint>
                자동 lazy 생성 외에 운영자가 미래 회차/특수 회차를 사전 생성합니다.
                동일 회차가 이미 존재하면 거부됩니다.
              </FieldHint>
              <Field style={{ marginTop: 12 }}>
                <Label>회차 (YYYY-MM)</Label>
                <Input
                  type="text"
                  placeholder="2026-05"
                  value={createCycle}
                  onChange={(e) => setCreateCycle(e.target.value)}
                  maxLength={7}
                />
              </Field>
              <Field style={{ marginTop: 12 }}>
                <Label>당첨자 수 (1~1000)</Label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={createWinnerCount}
                  onChange={(e) => setCreateWinnerCount(e.target.value)}
                />
              </Field>
              <ActionRow>
                <PrimaryButton onClick={handleCreateCycle} disabled={creating}>
                  {creating ? '생성 중...' : '회차 생성'}
                </PrimaryButton>
                <SmallButton onClick={closeCreateModal} disabled={creating}>취소</SmallButton>
              </ActionRow>
            </DialogBody>
          </SmallDialogBox>
        </Overlay>
      )}

      {/* 수동 추첨 강제 확인 모달 — 회차명 직접 입력 요구 */}
      {drawConfirmOpen && detailLottery && (
        <Overlay onClick={() => !drawing && setDrawConfirmOpen(false)}>
          <SmallDialogBox onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle style={{ color: '#d32f2f' }}>
                <MdWarningAmber size={18} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                수동 추첨 — 비가역 작업
              </DialogTitle>
              <CloseIcon onClick={() => !drawing && setDrawConfirmOpen(false)} title="닫기">
                <MdClose size={18} />
              </CloseIcon>
            </DialogHeader>
            <DialogBody>
              <DangerBanner>
                이 작업은 취소할 수 없습니다. PENDING 응모자 전원이 즉시 WON/LOST 로 확정됩니다.
              </DangerBanner>
              <DetailKv>
                <span>회차</span>
                <strong>{detailLottery.cycleYearMonth}</strong>
              </DetailKv>
              <DetailKv>
                <span>응모자 수</span>
                <strong>{fmt(detailLottery.totalEntries)}명</strong>
              </DetailKv>
              <DetailKv>
                <span>당첨 정원</span>
                <strong>{fmt(detailLottery.winnerCount)}명</strong>
              </DetailKv>
              {detailLottery.totalEntries < detailLottery.winnerCount && detailLottery.totalEntries > 0 && (
                <FieldHint style={{ color: '#b26a00' }}>
                  ⚠ 응모자가 당첨 정원보다 적습니다. 응모자 전원이 당첨됩니다.
                </FieldHint>
              )}
              <Field style={{ marginTop: 16 }}>
                <Label>
                  확인을 위해 회차명 <code style={{ background: '#fff5e1', padding: '0 4px' }}>{detailLottery.cycleYearMonth}</code> 을 정확히 입력하세요.
                </Label>
                <Input
                  type="text"
                  value={drawConfirmInput}
                  onChange={(e) => setDrawConfirmInput(e.target.value)}
                  placeholder={detailLottery.cycleYearMonth}
                  autoFocus
                />
              </Field>
              <ActionRow>
                <DangerButton
                  onClick={executeManualDraw}
                  disabled={drawing || drawConfirmInput.trim() !== detailLottery.cycleYearMonth}
                >
                  <MdCasino size={16} /> {drawing ? '추첨 중...' : '추첨 실행'}
                </DangerButton>
                <SmallButton onClick={() => setDrawConfirmOpen(false)} disabled={drawing}>취소</SmallButton>
              </ActionRow>
            </DialogBody>
          </SmallDialogBox>
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
const FilterSelect = styled.select`
  padding: 6px 10px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: #fff;
  color: ${({ theme }) => theme.colors.textPrimary};
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
const HelperText = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bgHover};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: 4px;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  border-left: 3px solid ${({ theme }) => theme.colors.primary};
  line-height: 1.6;
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
  margin-bottom: ${({ theme }) => theme.spacing.md};
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
const CenterCell = styled.div`
  text-align: center;
  padding: 24px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;
const CycleText = styled.span`
  font-family: 'Menlo', 'Monaco', monospace;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
`;
const NumberText = styled.span`
  font-family: 'Menlo', 'Monaco', monospace;
`;
const MutedText = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`;
const MonoText = styled.span`
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: ${({ theme }) => theme.fontSizes.xs};
`;

/** 회차 상태별 색상 — primary/warning/success */
const StatusPill = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  background: ${({ $status, theme }) =>
    $status === 'COMPLETED' ? theme.colors.successBg ?? '#e8f6ee' :
    $status === 'DRAWING'   ? theme.colors.warningBg ?? '#fff5e1' :
                              theme.colors.bgHover};
  color: ${({ $status, theme }) =>
    $status === 'COMPLETED' ? (theme.colors.success ?? '#2e7d32') :
    $status === 'DRAWING'   ? (theme.colors.warning ?? '#b26a00') :
                              theme.colors.textSecondary};
`;
/** entry 상태별 색상 — 당첨 강조 */
const EntryPill = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  background: ${({ $status, theme }) =>
    $status === 'WON'  ? (theme.colors.successBg ?? '#e8f6ee') :
    $status === 'LOST' ? theme.colors.bgHover :
                         (theme.colors.warningBg ?? '#fff5e1')};
  color: ${({ $status, theme }) =>
    $status === 'WON'  ? (theme.colors.success ?? '#2e7d32') :
    $status === 'LOST' ? theme.colors.textMuted :
                         (theme.colors.warning ?? '#b26a00')};
`;

const Pagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: ${({ theme }) => theme.spacing.md};
`;
const PageButton = styled.button`
  padding: 6px 14px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: #fff;
  color: ${({ theme }) => theme.colors.textPrimary};
  &:hover:not(:disabled) { background: ${({ theme }) => theme.colors.bgHover}; }
  &:disabled { opacity: 0.4; }
`;
const PageInfo = styled.span`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-family: 'Menlo', 'Monaco', monospace;
`;

const SmallButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: #fff;
  color: ${({ theme }) => theme.colors.textSecondary};
  &:hover:not(:disabled) { background: ${({ theme }) => theme.colors.bgHover}; }
  &:disabled { opacity: 0.5; }
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
const DangerButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 14px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  background: ${({ theme }) => theme.colors.error ?? '#d32f2f'};
  color: #fff;
  border-radius: 4px;
  &:hover:not(:disabled) { opacity: 0.9; }
  &:disabled { opacity: 0.4; }
`;
/** WarnButton — DRAWING 복구처럼 위험은 낮지만 강조가 필요한 경고 액션 (주황) */
const WarnButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 14px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  background: ${({ theme }) => theme.colors.warning ?? '#b26a00'};
  color: #fff;
  border-radius: 4px;
  &:hover:not(:disabled) { opacity: 0.9; }
  &:disabled { opacity: 0.4; }
`;

/* ── 상단 KPI 카드 ── */
const KpiRow = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  @media (max-width: 1100px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;
const KpiCard = styled.div`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  background: #fff;
`;
const KpiLabel = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const KpiValue = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: 'Menlo', 'Monaco', monospace;
`;

/* ── 검색 박스 (응모자 명단) ── */
const SearchBox = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: #fff;
  color: ${({ theme }) => theme.colors.textMuted};
`;
const SearchInput = styled.input`
  border: none;
  outline: none;
  padding: 4px 0;
  width: 200px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  background: transparent;
`;
const SubtleCount = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  font-weight: ${({ theme }) => theme.fontWeights.regular ?? 400};
  margin-left: 6px;
`;

/* ── 작은 다이얼로그 (회차 생성 / 추첨 확인 전용) ── */
const SmallDialogBox = styled.div`
  background: #fff;
  width: 90%;
  max-width: 480px;
  max-height: 90vh;
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;
const DangerBanner = styled.div`
  background: ${({ theme }) => theme.colors.errorBg ?? '#fde7e9'};
  color: ${({ theme }) => theme.colors.error ?? '#d32f2f'};
  padding: 10px 12px;
  border-radius: 4px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border-left: 3px solid ${({ theme }) => theme.colors.error ?? '#d32f2f'};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  line-height: 1.5;
`;
const DetailKv = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  span { color: ${({ theme }) => theme.colors.textMuted}; }
  strong { font-family: 'Menlo', 'Monaco', monospace; }
`;

/* ── 모달 ── */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
`;
const DialogBox = styled.div`
  background: #fff;
  width: 90%;
  max-width: 1000px;
  max-height: 90vh;
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;
const DialogHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;
const DialogTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  display: flex;
  align-items: center;
`;
const CloseIcon = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.textMuted};
  &:hover { background: ${({ theme }) => theme.colors.bgHover}; }
`;
const DialogBody = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
  overflow-y: auto;
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;
const StatCard = styled.div`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.bgHover};
`;
const StatLabel = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: 4px;
`;
const StatValue = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const SectionTitle = styled.h4`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;
const SectionTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;
const FieldRow = styled.div`
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;
const Field = styled.div`
  display: flex;
  flex-direction: column;
`;
const Label = styled.label`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: 4px;
`;
const Input = styled.input`
  padding: 7px 10px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  &:disabled { background: ${({ theme }) => theme.colors.bgHover}; }
`;
const Textarea = styled.textarea`
  padding: 7px 10px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  resize: vertical;
  font-family: inherit;
`;
const FieldHint = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin: -4px 0 ${({ theme }) => theme.spacing.sm};
`;
const ActionRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;
