/**
 * AI 생성 이력 컴포넌트.
 * 상단에 운영 KPI 카드(QuizStatsCard) + 하단에 퀴즈 이력 페이징 테이블.
 *
 * 2026-04-08: AI 리뷰 이력 탭 제거 (AI 리뷰 생성 기능 삭제).
 * 2026-04-28: QuizStatsCard 상단 마운트 — quiz_generation 에이전트 운영 가시성 확보.
 *             새로고침 버튼 클릭 시 refreshKey 가 증가하여 통계 카드도 함께 재페치된다.
 * 2026-04-29: 백엔드 QuizSummary 응답 필드(quizId/movieId/question/correctAnswer/options/
 *             rewardPoint/status/quizDate/createdAt/updatedAt) 와 컬럼 정합성 회복.
 *             기존에는 응답에 없는 genre/difficulty/count/note 를 렌더하여 모든 행이 '-' 만 노출됨.
 *             영화 ID, 질문, 상태, 보상 포인트, 출제일, 생성일 컬럼으로 재구성하고
 *             행 클릭 시 4지선다/정답/해설을 펼쳐 보이며 "퀴즈 검수 탭으로 이동" 액션 제공.
 *
 * @param {Object} props - 없음 (자체 데이터 fetch)
 */

import { Fragment, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import {
  MdRefresh,
  MdChevronLeft,
  MdChevronRight,
  MdExpandMore,
  MdExpandLess,
  MdArrowForward,
  MdCheckCircle,
} from 'react-icons/md';
import StatusBadge from '@/shared/components/StatusBadge';
import { fetchQuizHistory } from '../api/aiApi';
import QuizStatsCard from './QuizStatsCard';

/**
 * 퀴즈 상태 → StatusBadge 매핑 (백엔드 Quiz.QuizStatus enum 기준).
 *
 * 백엔드는 PENDING/APPROVED/REJECTED/PUBLISHED 4개 enum 만 반환한다.
 * 과거 success/done/pending/failed 매핑은 잘못된 가정 — 응답 컨트랙트와 어긋나 있었다 (2026-04-29 수정).
 */
function getQuizStatusBadge(status) {
  switch (status) {
    case 'PENDING':   return { status: 'warning', label: '검수 대기' };
    case 'APPROVED':  return { status: 'success', label: '검수 완료' };
    case 'REJECTED':  return { status: 'error',   label: '반려' };
    case 'PUBLISHED': return { status: 'info',    label: '발행됨' };
    default:          return { status: 'default', label: status ?? '-' };
  }
}

/**
 * options 컬럼(JSON 문자열 또는 배열) 을 안전하게 파싱하여 string 배열로 반환.
 * 잘못된 데이터(빈/깨진 JSON) 가 와도 빈 배열로 폴백한다.
 */
function parseOptions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s));
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((s) => String(s));
    } catch {
      // JSON 파싱 실패 — 콤마 구분 fallback
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export default function GenerationHistory() {
  /* React Router navigate — "퀴즈 검수 탭으로 이동" 이동 시 사용 */
  const navigate = useNavigate();

  /* ── 퀴즈 이력 상태 ── */
  const [quizItems, setQuizItems]       = useState([]);
  const [quizPages, setQuizPages]       = useState(0);
  const [quizPage, setQuizPage]         = useState(0);
  const [quizLoading, setQuizLoading]   = useState(false);
  const [quizError, setQuizError]       = useState(null);
  /**
   * QuizStatsCard 강제 재마운트용 키.
   * 새로고침 버튼 클릭 시 +1 → 카드의 useEffect 가 재실행되어 통계도 새로 페치된다.
   * 페이지 이동 시에는 통계가 바뀌지 않으므로 변경하지 않는다 (네트워크 절약).
   */
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  /**
   * 행 펼치기 상태 — 클릭한 quizId 1개만 펼쳐 4지선다/정답/해설을 노출한다.
   * 다중 펼치기는 의도적으로 막아 화면을 단순하게 유지한다.
   */
  const [expandedQuizId, setExpandedQuizId] = useState(null);

  /** 퀴즈 이력 조회 */
  const loadQuiz = useCallback(async (pageNum = 0) => {
    setQuizLoading(true);
    setQuizError(null);
    try {
      const res = await fetchQuizHistory({ page: pageNum, size: 15 });
      setQuizItems(res?.content ?? []);
      setQuizPages(res?.totalPages ?? 0);
      setQuizPage(pageNum);
      setExpandedQuizId(null); // 페이지 이동 시 펼침 상태 초기화
    } catch (err) {
      setQuizError(err.message);
    } finally {
      setQuizLoading(false);
    }
  }, []);

  /** 새로고침 버튼 — 이력 + 통계 카드 동시 재페치 */
  const handleRefresh = useCallback(() => {
    loadQuiz(quizPage);
    setStatsRefreshKey((k) => k + 1);
  }, [loadQuiz, quizPage]);

  /** 행 펼치기 토글 — 같은 quizId 재클릭 시 접기 */
  const toggleExpand = useCallback((quizId) => {
    setExpandedQuizId((prev) => (prev === quizId ? null : quizId));
  }, []);

  /** 콘텐츠/이벤트 → 퀴즈 탭(검수 화면)으로 이동 */
  const handleGoToQuizTab = useCallback(() => {
    navigate('/content-events?tab=quiz');
  }, [navigate]);

  /* 초기 로드 */
  useEffect(() => {
    loadQuiz(0);
  }, [loadQuiz]);

  /* ── 공통 테이블 렌더 헬퍼 ── */
  function renderPagination(page, totalPages, loading, onPageChange) {
    if (totalPages <= 1) return null;
    return (
      <Pagination>
        <PageButton onClick={() => onPageChange(page - 1)} disabled={page === 0 || loading}>
          <MdChevronLeft size={18} />
        </PageButton>
        <PageInfo>{page + 1} / {totalPages}</PageInfo>
        <PageButton onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1 || loading}>
          <MdChevronRight size={18} />
        </PageButton>
      </Pagination>
    );
  }

  return (
    <Section>
      {/* ── 상단 운영 KPI 카드 (2026-04-28 신규) ── */}
      <QuizStatsCard refreshKey={statsRefreshKey} />

      <SectionHeader>
        <SectionTitle>퀴즈 생성 이력</SectionTitle>
        <HeaderActions>
          {/* 검수 탭 이동 — 운영자 동선: 이력 확인 → 검수/발행 화면으로 한 번에 진입 */}
          <NavigateButton onClick={handleGoToQuizTab} type="button">
            <MdArrowForward size={14} />
            퀴즈 검수 탭으로 이동
          </NavigateButton>
          <RefreshButton
            onClick={handleRefresh}
            title="새로고침 (이력 + 통계)"
          >
            <MdRefresh size={16} />
          </RefreshButton>
        </HeaderActions>
      </SectionHeader>

      {/* ── 퀴즈 이력 테이블 ── */}
      {quizError && <ErrorMsg>{quizError}</ErrorMsg>}
      <TableWrapper>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: '70px' }}>퀴즈ID</Th>
              <Th style={{ width: '110px' }}>영화 ID</Th>
              <Th>질문</Th>
              <Th style={{ width: '100px' }}>상태</Th>
              <Th style={{ width: '70px' }}>보상</Th>
              <Th style={{ width: '110px' }}>출제일</Th>
              <Th style={{ width: '160px' }}>생성 시각</Th>
              <Th style={{ width: '40px' }} aria-label="펼치기" />
            </tr>
          </thead>
          <tbody>
            {quizLoading ? (
              <tr><td colSpan={8}><EmptyRow>불러오는 중...</EmptyRow></td></tr>
            ) : quizItems.length === 0 ? (
              <tr><td colSpan={8}><EmptyRow>퀴즈 생성 이력이 없습니다.</EmptyRow></td></tr>
            ) : (
              quizItems.map((item, idx) => {
                const badge = getQuizStatusBadge(item.status);
                const isExpanded = expandedQuizId === item.quizId;
                const options = parseOptions(item.options);
                return (
                  <Fragment key={item.quizId ?? `quiz-${idx}`}>
                    <Tr
                      onClick={() => toggleExpand(item.quizId)}
                      $expandable
                      title="클릭하여 4지선다/정답 펼치기"
                    >
                      <Td><RunId>{item.quizId ?? '-'}</RunId></Td>
                      <Td>
                        <MovieIdCell title={item.movieId ?? ''}>
                          {item.movieId ?? '-'}
                        </MovieIdCell>
                      </Td>
                      <Td>
                        <QuestionCell title={item.question ?? ''}>
                          {item.question ?? '-'}
                        </QuestionCell>
                      </Td>
                      <Td><StatusBadge status={badge.status} label={badge.label} /></Td>
                      <Td><CountVal>{item.rewardPoint ?? '-'}P</CountVal></Td>
                      <Td>
                        <DateCell>{item.quizDate ?? '-'}</DateCell>
                      </Td>
                      <Td>
                        <DateCell>
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString('ko-KR')
                            : '-'}
                        </DateCell>
                      </Td>
                      <Td>
                        {isExpanded ? <MdExpandLess size={18} /> : <MdExpandMore size={18} />}
                      </Td>
                    </Tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8}>
                          <DetailPanel>
                            <DetailRow>
                              <DetailLabel>4지선다</DetailLabel>
                              <OptionsGrid>
                                {options.length === 0
                                  ? <DetailMuted>(선택지 없음)</DetailMuted>
                                  : options.map((opt, oi) => {
                                      const isCorrect = opt === item.correctAnswer;
                                      return (
                                        <OptionPill key={`opt-${item.quizId}-${oi}`} $correct={isCorrect}>
                                          {isCorrect && <MdCheckCircle size={14} />}
                                          <span>{opt}</span>
                                        </OptionPill>
                                      );
                                    })}
                              </OptionsGrid>
                            </DetailRow>
                            <DetailRow>
                              <DetailLabel>정답</DetailLabel>
                              <DetailValue>{item.correctAnswer ?? '-'}</DetailValue>
                            </DetailRow>
                            <DetailRow>
                              <DetailLabel>업데이트</DetailLabel>
                              <DetailValue>
                                {item.updatedAt
                                  ? new Date(item.updatedAt).toLocaleString('ko-KR')
                                  : '-'}
                              </DetailValue>
                            </DetailRow>
                          </DetailPanel>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </Table>
      </TableWrapper>
      {renderPagination(quizPage, quizPages, quizLoading, loadQuiz)}
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
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.heading};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
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
  &:hover { background: ${({ theme }) => theme.colors.bgHover}; }
`;

/** 헤더 우측 액션(이동 버튼 + 새로고침) 묶음 — 2026-04-29 */
const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

/** 콘텐츠/이벤트 → 퀴즈 검수 탭 이동 버튼 (보더 + 텍스트 컬러) */
const NavigateButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: 4px ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.bgCard};
  color: ${({ theme }) => theme.colors.primary};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => `${theme.colors.primary}10`};
  }
`;

const ErrorMsg = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const TableWrapper = styled.div`
  overflow-x: auto;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  background: ${({ theme }) => theme.colors.bgCard};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  text-align: left;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textMuted};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
  background: ${({ theme }) => theme.colors.bgHover};
`;

const Tr = styled.tr`
  &:not(:last-child) { border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight}; }
  &:hover { background: ${({ theme }) => theme.colors.bgHover}; }
  /* $expandable=true 인 행은 클릭 가능 — 커서 변경으로 행 펼치기 affordance 제공 */
  cursor: ${({ $expandable }) => ($expandable ? 'pointer' : 'default')};
`;

const Td = styled.td`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  vertical-align: middle;
`;

const RunId = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const CountVal = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
`;

const DateCell = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
`;

const EmptyRow = styled.div`
  padding: ${({ theme }) => theme.spacing.xxl};
  text-align: center;
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgCard};
  color: ${({ theme }) => theme.colors.textSecondary};
  &:hover:not(:disabled) { background: ${({ theme }) => theme.colors.bgHover}; }
  &:disabled { opacity: 0.4; }
`;

const PageInfo = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

/* ── 행 펼치기 / 컬럼 셀 (2026-04-29) ── */

/** 영화 ID 셀 — 긴 ID 는 ellipsis 로 잘리지만 title 툴팁으로 전체 노출 */
const MovieIdCell = styled.span`
  display: inline-block;
  max-width: 110px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
`;

/** 질문 셀 — 2줄까지 노출, 그 이상은 ellipsis. 펼치기로 전체 확인 가능 */
const QuestionCell = styled.span`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  line-height: 1.4;
  word-break: keep-all;
`;

/** 펼침 영역 컨테이너 — 행 아래쪽에 inline 카드처럼 노출 */
const DetailPanel = styled.div`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.bgHover};
  border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const DetailRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
`;

const DetailLabel = styled.div`
  flex: 0 0 80px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textMuted};
  padding-top: 4px;
`;

const DetailValue = styled.div`
  flex: 1;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  word-break: break-word;
`;

const DetailMuted = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const OptionsGrid = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: ${({ theme }) => theme.spacing.xs};
`;

/** 4지선다 옵션 알약 — 정답은 success 컬러로 강조 */
const OptionPill = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  background: ${({ $correct, theme }) =>
    $correct ? `${theme.colors.success}15` : theme.colors.bgCard};
  color: ${({ $correct, theme }) =>
    $correct ? theme.colors.success : theme.colors.textSecondary};
  font-weight: ${({ $correct, theme }) =>
    $correct ? theme.fontWeights.semibold : theme.fontWeights.regular};
  border: 1px solid ${({ $correct, theme }) =>
    $correct ? `${theme.colors.success}40` : theme.colors.borderLight};
`;
