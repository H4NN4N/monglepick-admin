/**
 * 검색 분석 탭 컴포넌트.
 *
 * 2026-04-08 개편:
 *  - 하단에 "인기 검색어 운영 관리" 섹션(PopularSearchManage) 추가 —
 *    구 운영 도구 > 인기 검색어 탭을 흡수. 조회(품질 지표/TOP 20)와
 *    조작(블랙리스트/강제 노출 CRUD)을 한 탭에서 함께 관리한다.
 *
 * 구성:
 * 1. 기간 선택 버튼 그룹 (1d / 7d / 30d)
 * 2. 검색 품질 지표 카드 3개 (성공률, 총 검색 수, 0건 검색 수)
 * 3. 기간별 검색 이력 통계 테이블 (search_history 기반)
 * 4. 현재 인기 검색어 TOP 20 (trending_keywords 기반, 누적 기준)
 * 5. 인기 검색어 운영 관리 (CRUD + 블랙리스트)
 *
 * 데이터 패칭:
 * - 기간 변경 시: 검색 품질 + 기간별 검색 이력 통계 재호출
 * - 누적 TOP 20: 별도 호출 (기간 필터 영향 없음)
 *
 * @param {Object} props - 없음 (내부 상태 관리)
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import {
  MdSearch,
  MdCheckCircle,
  MdSearchOff,
  MdEdit,
  MdBlock,
} from 'react-icons/md';
import StatsCard from '@/shared/components/StatsCard';
import {
  fetchPopularKeywords,
  fetchSearchHistoryKeywords,
  fetchSearchKeywordClicks,
  fetchSearchQuality,
} from '../api/statsApi';
import {
  createPopularKeyword,
  updatePopularKeyword,
  updatePopularKeywordExcluded,
} from '../api/popularSearchApi';
import PopularSearchManage from './PopularSearchManage';

/** 기간 선택 옵션 (검색 분석은 1d / 7d / 30d 세 가지) */
const PERIOD_OPTIONS = [
  { value: '1d',  label: '1일' },
  { value: '7d',  label: '7일' },
  { value: '30d', label: '30일' },
];

const EMPTY_EDIT_FORM = {
  id: null,
  keyword: '',
  displayRank: '',
  manualPriority: 0,
  isExcluded: false,
  adminNote: '',
};

/**
 * 숫자 천 단위 포맷.
 *
 * @param {number|null|undefined} val
 * @returns {string}
 */
function fmt(val) {
  if (val === null || val === undefined) return '-';
  return Number(val).toLocaleString();
}

/**
 * 퍼센트 포맷. 0.9234 → "92.3%"
 *
 * @param {number|null|undefined} val
 * @returns {string}
 */
function fmtPct(val) {
  if (val === null || val === undefined) return '-';
  return `${(Number(val) * 100).toFixed(1)}%`;
}

export default function SearchTab() {
  /** 현재 선택된 기간 */
  const [period, setPeriod] = useState('7d');

  /** 검색 품질 지표 상태 */
  const [quality, setQuality] = useState(null);
  const [qualityLoading, setQualityLoading] = useState(true);
  const [qualityError, setQualityError] = useState(null);

  /** 기간별 검색 이력 키워드 상태 */
  const [historyKeywords, setHistoryKeywords] = useState([]);
  const [historyKeywordsLoading, setHistoryKeywordsLoading] = useState(true);
  const [historyKeywordsError, setHistoryKeywordsError] = useState(null);
  const [detailBusyKeyword, setDetailBusyKeyword] = useState(null);
  const [detailModal, setDetailModal] = useState({
    open: false,
    keyword: '',
    periodLabel: '7d',
    totalClicks: 0,
    movies: [],
    loading: false,
    error: null,
  });

  /** 현재 인기 검색어 TOP 20 상태 */
  const [topKeywords, setTopKeywords] = useState([]);
  const [topKeywordsLoading, setTopKeywordsLoading] = useState(true);
  const [topKeywordsError, setTopKeywordsError] = useState(null);
  const [actionBusyKeyword, setActionBusyKeyword] = useState(null);
  const [manageRefreshSignal, setManageRefreshSignal] = useState(0);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  /**
   * 기간 필터 영향을 받는 데이터만 병렬 호출.
   *
   * @param {string} p - 기간 (1d | 7d | 30d)
   */
  const loadPeriodData = useCallback(async (p) => {
    setQualityLoading(true);
    setHistoryKeywordsLoading(true);
    setQualityError(null);
    setHistoryKeywordsError(null);

    const [qualityResult, historyKeywordsResult] = await Promise.allSettled([
      fetchSearchQuality({ period: p }),
      fetchSearchHistoryKeywords({ period: p, limit: 20 }),
    ]);

    /* 품질 지표 처리 */
    if (qualityResult.status === 'fulfilled') {
      setQuality(qualityResult.value);
    } else {
      setQualityError(qualityResult.reason?.message ?? '검색 품질 데이터를 불러올 수 없습니다.');
    }
    setQualityLoading(false);

    /* 기간별 검색 이력 통계 처리 */
    if (historyKeywordsResult.status === 'fulfilled') {
      setHistoryKeywords(
        Array.isArray(historyKeywordsResult.value) ? historyKeywordsResult.value : [],
      );
    } else {
      setHistoryKeywordsError(historyKeywordsResult.reason?.message ?? '검색 이력 통계를 불러올 수 없습니다.');
    }
    setHistoryKeywordsLoading(false);
  }, []);

  /**
   * 기간과 무관한 현재 인기 검색어 TOP 20을 조회한다.
   */
  const loadTopKeywords = useCallback(async () => {
    setTopKeywordsLoading(true);
    setTopKeywordsError(null);

    try {
      const data = await fetchPopularKeywords({ limit: 20 });
      setTopKeywords(Array.isArray(data) ? data : []);
    } catch (err) {
      setTopKeywordsError(err.message ?? '현재 인기 검색어를 불러올 수 없습니다.');
    } finally {
      setTopKeywordsLoading(false);
    }
  }, []);

  /* 최초 마운트 + 기간 변경 시 기간 기반 데이터 로드 */
  useEffect(() => {
    loadPeriodData(period);
  }, [period, loadPeriodData]);

  /* 누적 인기 검색어 TOP 20은 별도 로드 */
  useEffect(() => {
    loadTopKeywords();
  }, [loadTopKeywords]);

  /* 품질 지표 안전 접근 */
  const q = quality ?? {};

  function openEditModal(item) {
    setEditForm({
      id: item.id ?? null,
      keyword: item.keyword ?? '',
      displayRank: item.displayRank ?? '',
      manualPriority: item.manualPriority ?? 0,
      isExcluded: !!item.isExcluded,
      adminNote: item.adminNote ?? '',
    });
    setEditOpen(true);
  }

  function closeEditModal() {
    setEditOpen(false);
    setEditForm(EMPTY_EDIT_FORM);
    setEditSubmitting(false);
  }

  function handleEditFormChange(e) {
    const { name, value, type, checked } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (editSubmitting) return;

    try {
      setEditSubmitting(true);
      const toIntOrNull = (v) => (v === '' || v == null ? null : parseInt(v, 10));
      const payload = {
        displayRank: toIntOrNull(editForm.displayRank),
        manualPriority: editForm.manualPriority === '' ? 0 : Number(editForm.manualPriority),
        isExcluded: !!editForm.isExcluded,
        adminNote: editForm.adminNote || null,
      };

      if (editForm.id != null) {
        await updatePopularKeyword(editForm.id, payload);
      } else {
        await createPopularKeyword({
          keyword: editForm.keyword,
          ...payload,
        });
      }

      closeEditModal();
      await loadTopKeywords();
      setManageRefreshSignal((prev) => prev + 1);
    } catch (err) {
      alert(err.message || '키워드 저장 중 오류가 발생했습니다.');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleToggleExcluded(item) {
    if (actionBusyKeyword === item.keyword) return;

    try {
      setActionBusyKeyword(item.keyword);
      if (item.id != null) {
        await updatePopularKeywordExcluded(item.id, !item.isExcluded);
      } else {
        await createPopularKeyword({
          keyword: item.keyword,
          displayRank: null,
          manualPriority: 0,
          isExcluded: true,
          adminNote: null,
        });
      }
      await loadTopKeywords();
      setManageRefreshSignal((prev) => prev + 1);
    } catch (err) {
      alert(err.message || '키워드 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setActionBusyKeyword(null);
    }
  }

  async function handleOpenDetail(keyword) {
    if (detailBusyKeyword === keyword) return;

    try {
      setDetailBusyKeyword(keyword);
      setDetailModal({
        open: true,
        keyword,
        periodLabel: period,
        totalClicks: 0,
        movies: [],
        loading: true,
        error: null,
      });

      const data = await fetchSearchKeywordClicks({
        keyword,
        period,
        limit: 20,
      });

      setDetailModal({
        open: true,
        keyword: data?.keyword ?? keyword,
        periodLabel: period,
        totalClicks: data?.totalClicks ?? 0,
        movies: Array.isArray(data?.movies) ? data.movies : [],
        loading: false,
        error: null,
      });
    } catch (err) {
      setDetailModal({
        open: true,
        keyword,
        periodLabel: period,
        totalClicks: 0,
        movies: [],
        loading: false,
        error: err.message ?? '클릭 상세 통계를 불러올 수 없습니다.',
      });
    } finally {
      setDetailBusyKeyword(null);
    }
  }

  function closeDetailModal() {
    setDetailModal({
      open: false,
      keyword: '',
      periodLabel: '7d',
      totalClicks: 0,
      movies: [],
      loading: false,
      error: null,
    });
  }

  /** 품질 지표 카드 정의 */
  const qualityCards = [
    {
      key: 'successRate',
      icon: <MdCheckCircle size={18} />,
      title: '검색 성공률',
      value: qualityLoading ? '...' : fmtPct(q.successRate),
      subtitle: '1건 이상 결과 반환 비율',
      status: 'success',
    },
    {
      key: 'totalSearches',
      icon: <MdSearch size={18} />,
      title: '총 검색 수',
      value: qualityLoading ? '...' : fmt(q.totalSearches),
      subtitle: '기간 내 전체 검색 횟수',
      status: 'info',
    },
    {
      key: 'zeroResults',
      icon: <MdSearchOff size={18} />,
      title: '0건 검색 수',
      value: qualityLoading ? '...' : fmt(q.zeroResultSearches),
      subtitle: '결과 없음 반환 횟수',
      /* 0건 검색이 전체의 10% 초과면 warning */
      status: qualityLoading
        ? 'info'
        : (q.zeroResultSearches ?? 0) / Math.max(q.totalSearches ?? 1, 1) > 0.1
          ? 'warning'
          : 'info',
    },
  ];

  return (
    <Wrapper>
      {/* ── 기간 선택 ── */}
      <FilterRow>
        <FilterLabel>집계 기간</FilterLabel>
        <PeriodGroup>
          {PERIOD_OPTIONS.map((opt) => (
            <PeriodButton
              key={opt.value}
              $active={period === opt.value}
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </PeriodButton>
          ))}
        </PeriodGroup>
      </FilterRow>

      {/* ── 검색 품질 지표 카드 ── */}
      <SectionLabel>검색 품질 지표</SectionLabel>
      {qualityError && <ErrorMsg>{qualityError}</ErrorMsg>}
      <QualityGrid>
        {qualityCards.map((card) => (
          <StatsCard
            key={card.key}
            icon={card.icon}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            status={card.status}
          />
        ))}
      </QualityGrid>

      {/* ── 기간별 검색 이력 테이블 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>기간별 검색 이력</SectionLabel>
      {historyKeywordsError && <ErrorMsg>{historyKeywordsError}</ErrorMsg>}
      <TableCard>
        <TableHeader>
          <CardTitle>검색 이력 기준 TOP 20</CardTitle>
          {!historyKeywordsLoading && (
            <TableMeta>{period} 기준 총 {historyKeywords.length}개 키워드</TableMeta>
          )}
        </TableHeader>
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <Th style={{ width: '60px' }}>번호</Th>
                <Th>키워드</Th>
                <Th style={{ textAlign: 'right' }}>검색 수</Th>
                <Th style={{ textAlign: 'right' }}>검색 세션 수</Th>
                <Th style={{ textAlign: 'right' }}>검색 결과</Th>
                <Th style={{ textAlign: 'right' }}>전환율</Th>
                <Th style={{ width: '180px', textAlign: 'right' }}>상세보기</Th>
              </tr>
            </thead>
            <tbody>
              {historyKeywordsLoading ? (
                <tr>
                  <Td colSpan={7} style={{ textAlign: 'center' }}>
                    데이터를 불러오는 중...
                  </Td>
                </tr>
              ) : historyKeywords.length === 0 ? (
                <tr>
                  <Td colSpan={7} style={{ textAlign: 'center' }}>
                    검색어 데이터가 없습니다.
                  </Td>
                </tr>
              ) : (
                historyKeywords.map((kw, idx) => (
                  <tr key={`${kw.keyword}-${idx}`}>
                    <Td>
                      <RowNumber>{idx + 1}</RowNumber>
                    </Td>
                    <Td>
                      <KeywordText>{kw.keyword ?? '-'}</KeywordText>
                    </Td>
                    <Td style={{ textAlign: 'right' }}>
                      {fmt(kw.searchCount)}
                    </Td>
                    <Td style={{ textAlign: 'right' }}>
                      {fmt(kw.sessionCount)}
                    </Td>
                    <Td style={{ textAlign: 'right' }}>
                      {fmt(kw.resultCount)}
                    </Td>
                    <Td style={{ textAlign: 'right' }}>
                      <ConversionRate
                        $high={(kw.conversionRate ?? 0) >= 0.3}
                      >
                        {fmtPct(kw.conversionRate)}
                      </ConversionRate>
                    </Td>
                    <Td style={{ textAlign: 'right' }}>
                      <ActionGroup $align="flex-end">
                        <SmallActionButton
                          onClick={() => handleOpenDetail(kw.keyword)}
                          disabled={detailBusyKeyword === kw.keyword}
                        >
                          상세보기
                        </SmallActionButton>
                      </ActionGroup>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrapper>
      </TableCard>

      {/* ── 현재 인기 검색어 테이블 ── */}
      <SectionLabel style={{ marginTop: '32px' }}>현재 인기 검색어</SectionLabel>
      {topKeywordsError && <ErrorMsg>{topKeywordsError}</ErrorMsg>}
      <TableCard>
        <TableHeader>
          <CardTitle>현재 인기 검색어 TOP 20</CardTitle>
          {!topKeywordsLoading && (
            <TableMeta>누적 trending_keywords 기준 총 {topKeywords.length}개 키워드</TableMeta>
          )}
        </TableHeader>
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <Th style={{ width: '60px' }}>순위</Th>
                <Th>키워드</Th>
                <Th style={{ textAlign: 'right' }}>검색 수</Th>
                <Th style={{ width: '180px', textAlign: 'right' }}>운영</Th>
              </tr>
            </thead>
            <tbody>
              {topKeywordsLoading ? (
                <tr>
                  <Td colSpan={4} style={{ textAlign: 'center' }}>
                    데이터를 불러오는 중...
                  </Td>
                </tr>
              ) : topKeywords.length === 0 ? (
                <tr>
                  <Td colSpan={4} style={{ textAlign: 'center' }}>
                    검색어 데이터가 없습니다.
                  </Td>
                </tr>
              ) : (
                topKeywords.map((kw, idx) => (
                  <tr key={`${kw.keyword}-${idx}`}>
                    <Td>
                      <RankBadge $rank={idx + 1}>
                        {idx + 1}
                      </RankBadge>
                    </Td>
                    <Td>
                      <KeywordCell>
                        <KeywordText>{kw.keyword ?? '-'}</KeywordText>
                        {kw.isExcluded ? (
                          <ManageStatePill $color="#ef4444">제외</ManageStatePill>
                        ) : kw.id ? (
                          <ManageStatePill $color="#10b981">관리중</ManageStatePill>
                        ) : null}
                      </KeywordCell>
                    </Td>
                    <Td style={{ textAlign: 'right' }}>
                      {fmt(kw.searchCount)}
                    </Td>
                    <Td style={{ textAlign: 'right' }}>
                      <ActionGroup $align="flex-end">
                        <SmallActionButton
                          onClick={() => openEditModal(kw)}
                          disabled={actionBusyKeyword === kw.keyword}
                        >
                          <MdEdit size={13} /> 수정
                        </SmallActionButton>
                        <ToggleActionButton
                          onClick={() => handleToggleExcluded(kw)}
                          disabled={actionBusyKeyword === kw.keyword}
                          $restore={!!kw.isExcluded}
                        >
                          {kw.isExcluded ? <MdCheckCircle size={13} /> : <MdBlock size={13} />}
                          {kw.isExcluded ? ' 복원' : ' 제외'}
                        </ToggleActionButton>
                      </ActionGroup>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrapper>
      </TableCard>

      {/* ── 인기 검색어 운영 관리 (CRUD) ── */}
      <SectionLabel style={{ marginTop: '48px' }}>인기 검색어 운영 관리</SectionLabel>
      <PopularSearchManage
        refreshSignal={manageRefreshSignal}
        onChanged={() => loadTopKeywords()}
      />

      {editOpen && (
        <Overlay onClick={closeEditModal}>
          <DialogBox onClick={(e) => e.stopPropagation()}>
            <DialogTitle>인기 검색어 운영 설정</DialogTitle>
            <form onSubmit={handleEditSubmit}>
              <Field>
                <Label htmlFor="search-tab-keyword">키워드</Label>
                <Input
                  id="search-tab-keyword"
                  type="text"
                  name="keyword"
                  value={editForm.keyword}
                  disabled
                />
                <FieldHint>TOP 20 리스트에서 선택한 키워드에 운영 메타만 추가/수정합니다.</FieldHint>
              </Field>
              <FieldRow>
                <Field>
                  <Label htmlFor="search-tab-display-rank">고정 노출 순위 (선택)</Label>
                  <Input
                    id="search-tab-display-rank"
                    type="number"
                    name="displayRank"
                    value={editForm.displayRank}
                    onChange={handleEditFormChange}
                    min={1}
                    placeholder="비워두면 자동 순위"
                  />
                </Field>
                <Field>
                  <Label htmlFor="search-tab-manual-priority">수동 가중치</Label>
                  <Input
                    id="search-tab-manual-priority"
                    type="number"
                    name="manualPriority"
                    value={editForm.manualPriority}
                    onChange={handleEditFormChange}
                    min={0}
                  />
                </Field>
              </FieldRow>
              <Field>
                <CheckboxLabel>
                  <input
                    id="search-tab-is-excluded"
                    type="checkbox"
                    name="isExcluded"
                    checked={editForm.isExcluded}
                    onChange={handleEditFormChange}
                  />
                  <span>블랙리스트(자동 집계 결과에서 제외)</span>
                </CheckboxLabel>
              </Field>
              <Field>
                <Label htmlFor="search-tab-admin-note">관리자 메모</Label>
                <Textarea
                  id="search-tab-admin-note"
                  name="adminNote"
                  value={editForm.adminNote}
                  onChange={handleEditFormChange}
                  rows={3}
                  placeholder="제외 사유, 강제 노출 목적 등"
                />
              </Field>
              <DialogFooter>
                <CancelButton type="button" onClick={closeEditModal}>취소</CancelButton>
                <SubmitButton type="submit" disabled={editSubmitting}>
                  {editSubmitting ? '저장 중...' : '저장'}
                </SubmitButton>
              </DialogFooter>
            </form>
          </DialogBox>
        </Overlay>
      )}

      {detailModal.open && (
        <Overlay onClick={closeDetailModal}>
          <DialogBox onClick={(e) => e.stopPropagation()}>
            <DialogTitle>검색어 클릭 상세</DialogTitle>
            <DialogSummary>
              <SummaryKeyword>{detailModal.keyword}</SummaryKeyword>
              <SummaryMeta>
                {detailModal.periodLabel} 기준 총 클릭 {fmt(detailModal.totalClicks)}건
              </SummaryMeta>
            </DialogSummary>

            {detailModal.error && <ErrorMsg>{detailModal.error}</ErrorMsg>}

            <TableWrapper>
              <Table>
                <thead>
                  <tr>
                    <Th style={{ width: '60px' }}>번호</Th>
                    <Th>영화</Th>
                    <Th style={{ textAlign: 'right' }}>클릭 수</Th>
                    <Th style={{ textAlign: 'right' }}>비중</Th>
                  </tr>
                </thead>
                <tbody>
                  {detailModal.loading ? (
                    <tr>
                      <Td colSpan={4} style={{ textAlign: 'center' }}>
                        데이터를 불러오는 중...
                      </Td>
                    </tr>
                  ) : detailModal.movies.length === 0 ? (
                    <tr>
                      <Td colSpan={4} style={{ textAlign: 'center' }}>
                        클릭 통계가 없습니다.
                      </Td>
                    </tr>
                  ) : (
                    detailModal.movies.map((movie, idx) => (
                      <tr key={`${movie.movieId ?? 'unknown'}-${idx}`}>
                        <Td><RowNumber>{idx + 1}</RowNumber></Td>
                        <Td>
                          <MovieText>
                            {movie.movieTitle ?? '제목 없음'}
                            {movie.movieId ? <MovieIdText>({movie.movieId})</MovieIdText> : null}
                          </MovieText>
                        </Td>
                        <Td style={{ textAlign: 'right' }}>{fmt(movie.clickCount)}</Td>
                        <Td style={{ textAlign: 'right' }}>{fmtPct(movie.clickRate)}</Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </TableWrapper>

            <DialogFooter>
              <CancelButton type="button" onClick={closeDetailModal}>닫기</CancelButton>
            </DialogFooter>
          </DialogBox>
        </Overlay>
      )}
    </Wrapper>
  );
}

/* ── styled-components ── */

const Wrapper = styled.div``;

const FilterRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
`;

const FilterLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const PeriodGroup = styled.div`
  display: flex;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  overflow: hidden;
`;

const PeriodButton = styled.button`
  padding: 5px ${({ theme }) => theme.spacing.lg};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ $active, theme }) =>
    $active ? '#ffffff' : theme.colors.textSecondary};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primary : 'transparent'};
  transition: all ${({ theme }) => theme.transitions.fast};
  white-space: nowrap;

  & + & {
    border-left: 1px solid ${({ theme }) => theme.colors.border};
  }

  &:hover {
    background: ${({ $active, theme }) =>
      $active ? theme.colors.primaryHover : theme.colors.bgHover};
  }
`;

const SectionLabel = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const QualityGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
`;

const ErrorMsg = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.error};
  background: ${({ theme }) => theme.colors.errorBg};
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const TableCard = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.xl};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const TableHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const CardTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.heading};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const TableMeta = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TableWrapper = styled.div`
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

const Th = styled.th`
  text-align: left;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
`;

const Td = styled.td`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
  vertical-align: middle;

  tr:nth-child(even) & {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`;

/**
 * 순위 배지.
 * 1~3위: 금/은/동 색상, 나머지: 기본 회색.
 *
 * @param {number} $rank - 순위
 */
const RankBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  background: ${({ $rank }) =>
    $rank === 1 ? '#fbbf24' :
    $rank === 2 ? '#94a3b8' :
    $rank === 3 ? '#cd7c3a' :
    '#e2e8f0'};
  color: ${({ $rank }) =>
    $rank <= 3 ? '#ffffff' : '#475569'};
`;

const RowNumber = styled.span`
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const KeywordText = styled.span`
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const KeywordCell = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const ManageStatePill = styled.span`
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  border-radius: 999px;
  color: #fff;
  background: ${({ $color }) => $color};
`;

/**
 * 전환율 텍스트.
 * 30% 이상이면 초록, 미만이면 기본.
 *
 * @param {boolean} $high - 전환율 높음 여부
 */
const ConversionRate = styled.span`
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ $high, theme }) =>
    $high ? theme.colors.success : theme.colors.textSecondary};
`;

const ActionGroup = styled.div`
  display: flex;
  justify-content: ${({ $align }) => $align ?? 'flex-start'};
  gap: 4px;
  flex-wrap: wrap;
`;

const SmallActionButton = styled.button`
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

  &:disabled {
    opacity: 0.4;
  }
`;

const ToggleActionButton = styled(SmallActionButton)`
  &:hover:not(:disabled) {
    border-color: ${({ $restore, theme }) =>
      $restore ? theme.colors.success : theme.colors.error};
    color: ${({ $restore, theme }) =>
      $restore ? theme.colors.success : theme.colors.error};
  }
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

const DialogSummary = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const SummaryKeyword = styled.strong`
  font-size: ${({ theme }) => theme.fontSizes.base};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const SummaryMeta = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
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

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    outline: none;
  }

  &:disabled {
    background: ${({ theme }) => theme.colors.bgHover};
    opacity: 0.7;
  }
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

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    outline: none;
  }
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

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`;

const SubmitButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 14px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  border-radius: 4px;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
  }
`;

const MovieText = styled.span`
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const MovieIdText = styled.span`
  margin-left: 6px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;
