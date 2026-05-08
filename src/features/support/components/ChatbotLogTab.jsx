/**
 * 고객센터 챗봇 로그 / 통계 탭.
 *
 * <p>Agent (FastAPI) 가 매 턴 fire-and-forget INSERT 한 {@code support_chat_log} 데이터를
 * 관리자 페이지에서 검색·트레이스·집계할 수 있게 한다.</p>
 *
 * <h3>구성</h3>
 * <ul>
 *   <li>상단 KPI 카드: 총 건수 / 1:1 유도 비율 / 의도별 분포 / TOP 발화</li>
 *   <li>중단 필터: 의도 / 1:1 유도 여부 / 키워드 / 기간</li>
 *   <li>하단 페이징 테이블: 시각 / 사용자 / 의도 / 발화 / 응답 / 1:1 유도</li>
 *   <li>행 클릭 → 세션 트레이스 모달 (한 사용자의 전체 대화 흐름)</li>
 * </ul>
 *
 * 2026-04-28 신규 — `support_assistant_v4` 사용 통계 / 감사용.
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdSearch, MdClose } from 'react-icons/md';
import {
  fetchChatLogs,
  fetchChatLogSession,
  fetchChatLogSummary,
} from '../api/supportApi';

/**
 * 의도 라벨 (UI 표시용). 6종 + unknown.
 */
const INTENT_LABELS = {
  faq: 'FAQ',
  personal_data: '본인 데이터',
  policy: '정책',
  redirect: '리다이렉트',
  smalltalk: '잡담',
  complaint: '컴플레인',
  unknown: '미분류',
};

/** 의도별 배지 색상 (공통 styled 정의에서 매핑) */
const INTENT_COLORS = {
  faq: '#3b82f6',
  personal_data: '#a855f7',
  policy: '#0ea5e9',
  redirect: '#facc15',
  smalltalk: '#94a3b8',
  complaint: '#ef4444',
  unknown: '#6b7280',
};

const PAGE_SIZE = 20;

export default function ChatbotLogTab() {
  /* ── 통계 요약 ── */
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  /* ── 페이징 검색 ── */
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [logsLoading, setLogsLoading] = useState(true);

  /* ── 필터 상태 ── */
  const [filter, setFilter] = useState({
    intentKind: '',
    needsHuman: '', // '' | 'true' | 'false'
    keyword: '',
    from: '',
    to: '',
  });

  /* ── 세션 트레이스 모달 ── */
  const [sessionTrace, setSessionTrace] = useState(null); // {sessionId, items}
  const [traceLoading, setTraceLoading] = useState(false);

  /* ── 통계 요약 로드 ── */
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const params = {
        topN: 10,
        ...(filter.from ? { from: filter.from } : {}),
        ...(filter.to ? { to: filter.to } : {}),
      };
      const res = await fetchChatLogSummary(params);
      setSummary(res.data?.data ?? res.data);
    } catch (err) {
      console.error('chat log summary 로드 실패', err);
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [filter.from, filter.to]);

  /* ── 페이징 검색 로드 ── */
  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = {
        page,
        size: PAGE_SIZE,
        sort: 'createdAt,desc',
        ...(filter.intentKind ? { intentKind: filter.intentKind } : {}),
        ...(filter.needsHuman !== '' ? { needsHuman: filter.needsHuman } : {}),
        ...(filter.keyword.trim() ? { keyword: filter.keyword.trim() } : {}),
        ...(filter.from ? { from: filter.from } : {}),
        ...(filter.to ? { to: filter.to } : {}),
      };
      const res = await fetchChatLogs(params);
      const body = res.data?.data ?? res.data;
      setLogs(body?.content ?? []);
      setTotal(body?.totalElements ?? 0);
    } catch (err) {
      console.error('chat log 검색 실패', err);
      setLogs([]);
      setTotal(0);
    } finally {
      setLogsLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  /* ── 세션 트레이스 열기 ── */
  const openTrace = async (sessionId) => {
    setTraceLoading(true);
    setSessionTrace({ sessionId, items: [] });
    try {
      const res = await fetchChatLogSession(sessionId);
      const items = res.data?.data ?? res.data ?? [];
      setSessionTrace({ sessionId, items });
    } catch (err) {
      console.error('세션 트레이스 로드 실패', err);
      setSessionTrace({ sessionId, items: [] });
    } finally {
      setTraceLoading(false);
    }
  };

  /* ── 필터 변경시 페이지 0 으로 리셋 ── */
  const handleFilterChange = (key, value) => {
    setFilter((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Wrapper>
      {/* ── KPI 카드 ── */}
      <KpiRow>
        <KpiCard>
          <KpiLabel>총 대화 수</KpiLabel>
          <KpiValue>
            {summaryLoading ? '...' : (summary?.totalCount ?? 0).toLocaleString()}
          </KpiValue>
        </KpiCard>
        <KpiCard>
          <KpiLabel>1:1 유도 비율</KpiLabel>
          <KpiValue>
            {summaryLoading
              ? '...'
              : `${((summary?.needsHumanRatio ?? 0) * 100).toFixed(1)}%`}
            <KpiSub>
              ({(summary?.needsHumanCount ?? 0).toLocaleString()}건)
            </KpiSub>
          </KpiValue>
        </KpiCard>
        <KpiCard $wide>
          <KpiLabel>의도별 분포</KpiLabel>
          <IntentBars>
            {summary?.intentDistribution?.map((row) => {
              const ratio = summary.totalCount
                ? row.count / summary.totalCount
                : 0;
              return (
                <IntentBar key={row.intentKind}>
                  <IntentBarLabel>
                    {INTENT_LABELS[row.intentKind] || row.intentKind}
                  </IntentBarLabel>
                  <IntentBarTrack>
                    <IntentBarFill
                      style={{
                        width: `${ratio * 100}%`,
                        background:
                          INTENT_COLORS[row.intentKind] || '#6b7280',
                      }}
                    />
                  </IntentBarTrack>
                  <IntentBarCount>{row.count.toLocaleString()}</IntentBarCount>
                </IntentBar>
              );
            }) ?? <Empty>데이터 없음</Empty>}
          </IntentBars>
        </KpiCard>
      </KpiRow>

      {/* ── TOP 발화 ── */}
      <Section>
        <SectionTitle>자주 묻는 질문 TOP 10</SectionTitle>
        <TopList>
          {(summary?.topMessages ?? []).map((row, idx) => (
            <TopItem key={idx}>
              <TopRank>{idx + 1}</TopRank>
              <TopText>{row.userMessage}</TopText>
              <TopCount>{row.count.toLocaleString()}회</TopCount>
            </TopItem>
          ))}
          {(summary?.topMessages?.length ?? 0) === 0 && (
            <Empty>자주 들어온 질문이 없습니다.</Empty>
          )}
        </TopList>
      </Section>

      {/* ── 필터 ── */}
      <FilterBar>
        <FilterField>
          <label>의도</label>
          <select
            value={filter.intentKind}
            onChange={(e) => handleFilterChange('intentKind', e.target.value)}
          >
            <option value="">전체</option>
            {Object.entries(INTENT_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField>
          <label>1:1 유도</label>
          <select
            value={filter.needsHuman}
            onChange={(e) => handleFilterChange('needsHuman', e.target.value)}
          >
            <option value="">전체</option>
            <option value="true">유도됨</option>
            <option value="false">미유도</option>
          </select>
        </FilterField>
        <FilterField $grow>
          <label>키워드</label>
          <input
            type="text"
            placeholder="user_message LIKE 검색"
            value={filter.keyword}
            onChange={(e) => handleFilterChange('keyword', e.target.value)}
          />
        </FilterField>
        <FilterField>
          <label>기간 시작</label>
          <input
            type="datetime-local"
            value={filter.from}
            onChange={(e) => handleFilterChange('from', e.target.value)}
            max={filter.to || undefined}
          />
        </FilterField>
        <FilterField>
          <label>기간 종료</label>
          <input
            type="datetime-local"
            value={filter.to}
            onChange={(e) => handleFilterChange('to', e.target.value)}
            min={filter.from || undefined}
          />
        </FilterField>
        <RefreshButton
          onClick={() => {
            loadLogs();
            loadSummary();
          }}
          title="새로고침"
        >
          <MdRefresh size={18} />
        </RefreshButton>
      </FilterBar>

      {/* ── 테이블 ── */}
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <th>시각</th>
              <th>사용자</th>
              <th>의도</th>
              <th>발화</th>
              <th>응답</th>
              <th>1:1</th>
              <th>hop</th>
            </tr>
          </thead>
          <tbody>
            {logsLoading && (
              <tr>
                <td colSpan={7}>
                  <Empty>불러오는 중...</Empty>
                </td>
              </tr>
            )}
            {!logsLoading && logs.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <Empty>조건에 맞는 로그가 없습니다.</Empty>
                </td>
              </tr>
            )}
            {!logsLoading &&
              logs.map((log) => (
                <Row key={log.id} onClick={() => openTrace(log.sessionId)}>
                  <td>{formatTimestamp(log.createdAt)}</td>
                  <td>
                    {log.guest
                      ? <GuestBadge>게스트</GuestBadge>
                      : (log.userId || '-')}
                  </td>
                  <td>
                    <IntentBadge $color={INTENT_COLORS[log.intentKind]}>
                      {INTENT_LABELS[log.intentKind] || log.intentKind}
                      <Confidence>
                        {(log.intentConfidence * 100).toFixed(0)}%
                      </Confidence>
                    </IntentBadge>
                  </td>
                  <td>
                    <Truncated title={log.userMessage}>
                      {log.userMessage}
                    </Truncated>
                  </td>
                  <td>
                    <Truncated title={log.responseText}>
                      {log.responseText}
                    </Truncated>
                  </td>
                  <td>
                    {log.needsHuman ? (
                      <NeedsHumanBadge>유도</NeedsHumanBadge>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{log.hopCount}</td>
                </Row>
              ))}
          </tbody>
        </Table>
      </TableWrap>

      {/* ── 페이지네이션 ── */}
      <Pagination>
        <PageButton
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          이전
        </PageButton>
        <PageInfo>
          {page + 1} / {totalPages} ({total.toLocaleString()}건)
        </PageInfo>
        <PageButton
          disabled={page + 1 >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          다음
        </PageButton>
      </Pagination>

      {/* ── 세션 트레이스 모달 ── */}
      {sessionTrace && (
        <ModalBackdrop onClick={() => setSessionTrace(null)}>
          <ModalBody onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <span>세션 트레이스 — {sessionTrace.sessionId}</span>
              <CloseBtn onClick={() => setSessionTrace(null)}>
                <MdClose size={18} />
              </CloseBtn>
            </ModalHeader>
            <ModalContent>
              {traceLoading && <Empty>불러오는 중...</Empty>}
              {!traceLoading && sessionTrace.items.length === 0 && (
                <Empty>이 세션에 로그가 없습니다.</Empty>
              )}
              {!traceLoading &&
                sessionTrace.items.map((item) => (
                  <TraceTurn key={item.id}>
                    <TraceMeta>
                      <span>{formatTimestamp(item.createdAt)}</span>
                      <IntentBadge
                        $color={INTENT_COLORS[item.intentKind]}
                        style={{ marginLeft: 8 }}
                      >
                        {INTENT_LABELS[item.intentKind] || item.intentKind}
                      </IntentBadge>
                      {item.needsHuman && (
                        <NeedsHumanBadge style={{ marginLeft: 8 }}>
                          유도
                        </NeedsHumanBadge>
                      )}
                    </TraceMeta>
                    <TraceUser>
                      <strong>사용자</strong>
                      <pre>{item.userMessage}</pre>
                    </TraceUser>
                    <TraceBot>
                      <strong>몽글이</strong>
                      <pre>{item.responseText}</pre>
                    </TraceBot>
                    {item.toolCallsJson && item.toolCallsJson !== '[]' && (
                      <TraceMeta>
                        tools:
                        <code style={{ marginLeft: 6 }}>
                          {item.toolCallsJson}
                        </code>
                      </TraceMeta>
                    )}
                  </TraceTurn>
                ))}
            </ModalContent>
          </ModalBody>
        </ModalBackdrop>
      )}
    </Wrapper>
  );
}

/** ISO datetime → "YYYY-MM-DD HH:MM:SS" 짧은 표기 */
function formatTimestamp(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', { hour12: false });
  } catch {
    return iso;
  }
}

/* ── styled ── */

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const KpiRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
`;

const KpiCard = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: 16px;
  ${({ $wide }) => $wide && `grid-column: span 2;`}
`;

const KpiLabel = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: 6px;
`;

const KpiValue = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xxl};
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.text};
`;

const KpiSub = styled.span`
  margin-left: 6px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  font-weight: ${({ theme }) => theme.fontWeights.normal};
`;

const IntentBars = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
`;

const IntentBar = styled.div`
  display: grid;
  grid-template-columns: 80px 1fr 60px;
  align-items: center;
  gap: 8px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

const IntentBarLabel = styled.div`
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const IntentBarTrack = styled.div`
  background: ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  height: 10px;
  overflow: hidden;
`;

const IntentBarFill = styled.div`
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
`;

const IntentBarCount = styled.div`
  text-align: right;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Section = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: 16px;
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  margin-bottom: 12px;
`;

const TopList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const TopItem = styled.div`
  display: grid;
  grid-template-columns: 32px 1fr 80px;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border-bottom: 1px dashed ${({ theme }) => theme.colors.border};
  &:last-child {
    border-bottom: none;
  }
`;

const TopRank = styled.div`
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.primary};
`;

const TopText = styled.div`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TopCount = styled.div`
  text-align: right;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const FilterBar = styled.div`
  display: grid;
  grid-template-columns: 140px 140px 1fr 200px 200px auto;
  gap: 12px;
  align-items: end;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: 12px;
`;

const FilterField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  ${({ $grow }) => $grow && `min-width: 0;`}

  label {
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  }

  input,
  select {
    padding: 6px 10px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 6px;
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  }
`;

const RefreshButton = styled.button`
  padding: 8px 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.background};
  cursor: pointer;
  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }
`;

const TableWrap = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  overflow: hidden;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.fontSizes.sm};

  th, td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }
  th {
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.textMuted};
    font-weight: ${({ theme }) => theme.fontWeights.semibold};
  }
`;

const Row = styled.tr`
  cursor: pointer;
  &:hover {
    background: ${({ theme }) => theme.colors.background};
  }
`;

const Truncated = styled.div`
  max-width: 320px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const IntentBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  background: ${({ $color }) => `${$color}20`};
  color: ${({ $color }) => $color};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
`;

const Confidence = styled.span`
  opacity: 0.7;
  font-weight: ${({ theme }) => theme.fontWeights.normal};
`;

const GuestBadge = styled.span`
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  background: #94a3b820;
  color: #475569;
  font-size: ${({ theme }) => theme.fontSizes.xs};
`;

const NeedsHumanBadge = styled.span`
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  background: #ef444420;
  color: #b91c1c;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
`;

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
`;

const PageButton = styled.button`
  padding: 6px 14px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.background};
  cursor: pointer;
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.surface};
  }
`;

const PageInfo = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Empty = styled.div`
  padding: 24px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const ModalBody = styled.div`
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  width: min(900px, 90vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
`;

const CloseBtn = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ModalContent = styled.div`
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const TraceTurn = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: 12px;
`;

const TraceMeta = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: 6px;
`;

const TraceUser = styled.div`
  margin-bottom: 6px;
  strong {
    display: inline-block;
    width: 60px;
    color: ${({ theme }) => theme.colors.primary};
  }
  pre {
    display: inline-block;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: inherit;
  }
`;

const TraceBot = styled(TraceUser)`
  strong {
    color: ${({ theme }) => theme.colors.success || '#10b981'};
  }
`;
