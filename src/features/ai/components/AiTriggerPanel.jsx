/**
 * AI 트리거 패널 컴포넌트.
 * 퀴즈 생성 폼(장르, 난이도, 수량)을 카드 형태로 표시.
 *
 * 2026-04-08: AI 리뷰 생성 기능 제거.
 * 2026-04-29: "오늘 퀴즈 강제 발행" 카드 추가 — QuizPublishScheduler.manualPublish() 호출.
 *
 * @param {Object} props - 없음 (자체 상태 관리)
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import {
  MdSmartToy,
  MdPlayArrow,
  MdCampaign,
  MdArrowForward,
  MdCheckCircle,
} from 'react-icons/md';
import StatusBadge from '@/shared/components/StatusBadge';
import { generateQuiz, publishQuizNow } from '../api/aiApi';

/**
 * 장르 옵션.
 *
 * value 는 그대로 Agent 의 movie_selector 가 `WHERE genres LIKE %value%` 로 사용한다.
 * DB(`movies.genres`)는 **한국어 배열**(예: `["SF","드라마"]`) 로 저장되므로
 * value 도 한국어 라벨과 동일해야 LIKE 매칭이 성립한다.
 * (영어 코드 `action` 으로 보내면 후보 0개로 떨어져 퀴즈 0개 생성 회귀 발생 — 2026-04-29 수정)
 */
const GENRE_OPTIONS = [
  { value: '',          label: '전체 장르' },
  { value: '액션',       label: '액션' },
  { value: '드라마',     label: '드라마' },
  { value: '코미디',     label: '코미디' },
  { value: '공포',       label: '공포' },
  { value: '로맨스',     label: '로맨스' },
  { value: 'SF',         label: 'SF' },
  { value: '스릴러',     label: '스릴러' },
  { value: '애니메이션', label: '애니메이션' },
  { value: '판타지',     label: '판타지' },
  { value: '범죄',       label: '범죄' },
  { value: '미스터리',   label: '미스터리' },
];

/** 퀴즈 난이도 옵션 */
const DIFFICULTY_OPTIONS = [
  { value: 'easy',   label: '쉬움' },
  { value: 'medium', label: '보통' },
  { value: 'hard',   label: '어려움' },
];

export default function AiTriggerPanel() {
  /* React Router navigate — "콘텐츠 이벤트 → 퀴즈 탭(?tab=quiz)" 이동 시 사용 */
  const navigate = useNavigate();

  /* ── 퀴즈 생성 폼 상태 ── */
  const [quizGenre, setQuizGenre] = useState('');
  const [quizDifficulty, setQuizDifficulty] = useState('medium');
  const [quizCount, setQuizCount] = useState(5);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizResult, setQuizResult] = useState(null); // { status, message }
  /**
   * 직전 생성 응답의 quizzes 배열 (GeneratedQuizItem[]).
   * 운영자가 즉시 결과를 확인하고 검수/이동 결정을 내릴 수 있도록 카드 형태로 노출한다.
   * 새 호출 시 비워지고, 실패 시에도 빈 배열로 초기화된다.
   */
  const [generatedQuizzes, setGeneratedQuizzes] = useState([]);

  /* ── 오늘 퀴즈 강제 발행 상태 (2026-04-29) ── */
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishResult, setPublishResult] = useState(null); // { status, message }

  /** 퀴즈 생성 실행 */
  async function handleQuizGenerate() {
    setQuizLoading(true);
    setQuizResult(null);
    setGeneratedQuizzes([]); // 직전 결과 클리어
    try {
      const result = await generateQuiz({
        genre: quizGenre || undefined,
        difficulty: quizDifficulty,
        count: Number(quizCount),
      });
      const items = Array.isArray(result?.quizzes) ? result.quizzes : [];
      setGeneratedQuizzes(items);
      /* 후보 0건 / LLM 실패 시 서버가 message 로 사유를 내려준다 → 운영자 안내 강화 */
      const generatedCount = result?.count ?? items.length;
      const isSuccess = (result?.success ?? generatedCount > 0);
      setQuizResult({
        status: isSuccess ? 'success' : 'warning',
        message: result?.message
          || (isSuccess
            ? `퀴즈 ${generatedCount}개 생성 완료`
            : '퀴즈가 생성되지 않았습니다.'),
      });
    } catch (err) {
      setQuizResult({ status: 'error', message: err.message });
    } finally {
      setQuizLoading(false);
    }
  }

  /**
   * "퀴즈 탭으로 이동" — 콘텐츠/이벤트 → 퀴즈 탭(검수 화면) 으로 이동.
   * AccountLayout 의 다른 탭과 동일하게 ?tab=quiz 쿼리로 전환된다.
   * 검수자가 PENDING 상태인 신규 생성건을 즉시 APPROVED/REJECTED 처리할 수 있도록 한다.
   */
  function handleGoToQuizTab() {
    navigate('/admin/content-events?tab=quiz');
  }

  /**
   * 오늘 퀴즈 강제 발행 — QuizPublishScheduler.manualPublish() 호출.
   *
   * 매일 00:00 KST 자동 발행 외에 운영자가 즉시 발행하고 싶을 때 사용.
   * 멱등 가드 + FIFO 정책은 백엔드 스케줄러에서 동일하게 적용된다.
   * 서버는 이미 발행됐거나 후보 0건인 경우에도 200 + published=0 + 안내 메시지로 반환하므로
   * UI 는 단순히 published 값에 따라 success/info 토스트를 분기한다.
   */
  async function handlePublishNow() {
    /* 운영 사고 방지 — 발행은 사용자에게 노출되는 작업이므로 confirm 한 번 거친다 */
    if (!window.confirm('오늘 퀴즈 1건을 즉시 발행하시겠어요?\n(이미 발행되었거나 APPROVED 후보가 없으면 발행되지 않습니다)')) {
      return;
    }
    setPublishLoading(true);
    setPublishResult(null);
    try {
      const result = await publishQuizNow();
      /* published === 1 이면 성공 토스트, 0 이면 안내 토스트 (info 색상) */
      const isPublished = (result?.published ?? 0) === 1;
      setPublishResult({
        status: isPublished ? 'success' : 'info',
        message: result?.message || (isPublished ? '발행 완료' : '발행되지 않음'),
      });
    } catch (err) {
      setPublishResult({ status: 'error', message: err.message });
    } finally {
      setPublishLoading(false);
    }
  }

  return (
    <Section>
      <SectionTitle>AI 트리거</SectionTitle>
      <PanelGrid>

        {/* ── 퀴즈 생성 카드 ── */}
        <TriggerCard>
          <CardHeader>
            <CardIcon $color="#6366f1">
              <MdSmartToy size={20} />
            </CardIcon>
            <div>
              <CardTitle>퀴즈 생성</CardTitle>
              <CardDesc>AI가 영화 퀴즈를 자동 생성합니다.</CardDesc>
            </div>
          </CardHeader>

          <FieldGroup>
            <FieldLabel>장르</FieldLabel>
            <StyledSelect
              value={quizGenre}
              onChange={(e) => setQuizGenre(e.target.value)}
            >
              {GENRE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </StyledSelect>
          </FieldGroup>

          <FieldGroup>
            <FieldLabel>난이도</FieldLabel>
            <RadioRow>
              {DIFFICULTY_OPTIONS.map((opt) => (
                <RadioLabel key={opt.value}>
                  <RadioInput
                    type="radio"
                    name="quiz-difficulty"
                    value={opt.value}
                    checked={quizDifficulty === opt.value}
                    onChange={() => setQuizDifficulty(opt.value)}
                  />
                  {opt.label}
                </RadioLabel>
              ))}
            </RadioRow>
          </FieldGroup>

          <FieldGroup>
            <FieldLabel>생성 수량</FieldLabel>
            <NumberRow>
              <NumberInput
                type="number"
                min={1}
                max={50}
                value={quizCount}
                onChange={(e) => setQuizCount(Math.max(1, Math.min(50, Number(e.target.value))))}
              />
              <NumberUnit>개</NumberUnit>
            </NumberRow>
          </FieldGroup>

          {quizResult && (
            <ResultRow>
              <StatusBadge
                status={quizResult.status}
                label={quizResult.message}
              />
            </ResultRow>
          )}

          {/*
            ── 생성된 퀴즈 미리보기 (2026-04-29) ──
            서버 응답의 quizzes 배열을 카드 형태로 즉시 노출한다.
            정답은 ✓ 아이콘 + 강조 색으로 표시하고, 해설은 보조 텍스트로 둔다.
            5건 초과 시에도 모두 노출 — 검수 결정에 필요한 정보이므로 truncate 하지 않는다.
          */}
          {generatedQuizzes.length > 0 && (
            <PreviewBlock>
              <PreviewHeader>
                <strong>방금 생성된 퀴즈 ({generatedQuizzes.length}건)</strong>
                <PreviewHint>
                  모두 PENDING 상태로 저장되었습니다. 검수 후 APPROVED 로 전환하세요.
                </PreviewHint>
              </PreviewHeader>

              <PreviewList>
                {generatedQuizzes.map((q, idx) => (
                  <PreviewCard key={q.quizId ?? `quiz-preview-${idx}`}>
                    <PreviewMeta>
                      <PreviewIndex>#{idx + 1}</PreviewIndex>
                      <PreviewMovie>{q.movieTitle ?? q.movieId ?? '영화'}</PreviewMovie>
                      <PreviewQuizId>quizId: {q.quizId}</PreviewQuizId>
                    </PreviewMeta>

                    <PreviewQuestion>{q.question}</PreviewQuestion>

                    <PreviewOptions>
                      {(q.options ?? []).map((opt, oi) => {
                        const isCorrect = opt === q.correctAnswer;
                        return (
                          <PreviewOption key={`opt-${idx}-${oi}`} $correct={isCorrect}>
                            {isCorrect && <MdCheckCircle size={14} />}
                            <span>{opt}</span>
                          </PreviewOption>
                        );
                      })}
                    </PreviewOptions>

                    {q.explanation && (
                      <PreviewExplanation>해설: {q.explanation}</PreviewExplanation>
                    )}
                  </PreviewCard>
                ))}
              </PreviewList>

              {/* 검수 화면(콘텐츠/이벤트 → 퀴즈 탭) 으로 즉시 이동 */}
              <NavigateButton onClick={handleGoToQuizTab} type="button">
                <MdArrowForward size={14} />
                퀴즈 검수 탭으로 이동
              </NavigateButton>
            </PreviewBlock>
          )}

          <RunButton
            onClick={handleQuizGenerate}
            disabled={quizLoading}
            $color="#6366f1"
          >
            <MdPlayArrow size={16} />
            {quizLoading ? '생성 중...' : '퀴즈 생성 실행'}
          </RunButton>
        </TriggerCard>

        {/* ── 오늘 퀴즈 강제 발행 카드 (2026-04-29) ── */}
        <TriggerCard>
          <CardHeader>
            <CardIcon $color="#10b981">
              <MdCampaign size={20} />
            </CardIcon>
            <div>
              <CardTitle>오늘 퀴즈 강제 발행</CardTitle>
              <CardDesc>
                매일 00:00 KST 자동 발행 외에, APPROVED 1건을 즉시 PUBLISHED 로 전환합니다.
              </CardDesc>
            </div>
          </CardHeader>

          {/* 발행 정책 안내 — 운영자가 멱등성/FIFO 를 인지하도록 */}
          <PublishHint>
            <strong>발행 정책</strong>
            <ul>
              <li>오늘 PUBLISHED 가 이미 있으면 발행하지 않습니다 (멱등).</li>
              <li>APPROVED + quiz_date 미지정 중 가장 오래된 1건이 선정됩니다.</li>
              <li>후보 0건이면 검수 적체 가능성 — 검수 화면을 확인해주세요.</li>
            </ul>
          </PublishHint>

          {publishResult && (
            <ResultRow>
              <StatusBadge
                status={publishResult.status}
                label={publishResult.message}
              />
            </ResultRow>
          )}

          <RunButton
            onClick={handlePublishNow}
            disabled={publishLoading}
            $color="#10b981"
          >
            <MdCampaign size={16} />
            {publishLoading ? '발행 중...' : '오늘 퀴즈 강제 발행'}
          </RunButton>
        </TriggerCard>

      </PanelGrid>
    </Section>
  );
}

/* ── styled-components ── */

const Section = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.heading};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const PanelGrid = styled.div`
  display: grid;
  /* 2026-04-29: 카드 2개(생성/강제발행) 동시 노출. 480px 최소 폭, 화면 좁으면 1열 wrap */
  grid-template-columns: repeat(auto-fit, minmax(360px, 480px));
  gap: ${({ theme }) => theme.spacing.xl};
`;

const TriggerCard = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.xl};
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
`;

const CardIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  flex-shrink: 0;
  background: ${({ $color }) => `${$color}20`};
  color: ${({ $color }) => $color};
`;

const CardTitle = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  margin-bottom: 2px;
`;

const CardDesc = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const FieldLabel = styled.label`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const StyledSelect = styled.select`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.bgBase ?? theme.colors.bgHover};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  &:focus { outline: none; border-color: ${({ theme }) => theme.colors.primary}; }
`;

const RadioRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
`;

const RadioInput = styled.input`
  accent-color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
`;

const NumberRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const NumberInput = styled.input`
  width: 80px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.bgBase ?? theme.colors.bgHover};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  text-align: center;
  &:focus { outline: none; border-color: ${({ theme }) => theme.colors.primary}; }
`;

const NumberUnit = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ResultRow = styled.div`
  display: flex;
  align-items: center;
`;

/**
 * 강제 발행 카드의 정책 안내 박스 (2026-04-29).
 * 멱등 / FIFO / 후보 없음 케이스를 운영자가 사전에 인지하도록 한다.
 */
const PublishHint = styled.div`
  background: ${({ theme }) => theme.colors.bgHover};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};

  strong {
    display: block;
    margin-bottom: ${({ theme }) => theme.spacing.xs};
    color: ${({ theme }) => theme.colors.textPrimary};
    font-weight: ${({ theme }) => theme.fontWeights.medium};
  }
  ul {
    margin: 0;
    padding-left: 18px;
    list-style: disc;
  }
  li + li {
    margin-top: 2px;
  }
`;

const RunButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl};
  background: ${({ $color }) => $color ?? '#6366f1'};
  color: #fff;
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  transition: opacity ${({ theme }) => theme.transitions.fast};
  margin-top: auto;

  &:hover { opacity: 0.85; }
  &:disabled { opacity: 0.5; }
`;

/* ── 생성 결과 미리보기 (2026-04-29) ── */

/** 미리보기 전체 컨테이너 — 생성 결과 카드 묶음 */
const PreviewBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.bgHover};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  /* 카드가 길어질 수 있으므로 카드 폭 안에서 세로 스크롤 허용 */
  max-height: 480px;
  overflow-y: auto;
`;

const PreviewHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textPrimary};
    font-weight: ${({ theme }) => theme.fontWeights.semibold};
  }
`;

const PreviewHint = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const PreviewList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const PreviewCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.borderLight};
  border-radius: 6px;
`;

const PreviewMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`;

const PreviewIndex = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  color: ${({ theme }) => theme.colors.primary};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
`;

const PreviewMovie = styled.span`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
`;

const PreviewQuizId = styled.span`
  margin-left: auto;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const PreviewQuestion = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  line-height: 1.4;
`;

/** 4지선다 옵션 그리드 — 정답은 색상 + ✓ 아이콘으로 강조 */
const PreviewOptions = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const PreviewOption = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  background: ${({ $correct, theme }) =>
    $correct ? `${theme.colors.success}15` : theme.colors.bgHover};
  color: ${({ $correct, theme }) =>
    $correct ? theme.colors.success : theme.colors.textSecondary};
  font-weight: ${({ $correct, theme }) =>
    $correct ? theme.fontWeights.semibold : theme.fontWeights.regular};
  border: 1px solid ${({ $correct, theme }) =>
    $correct ? `${theme.colors.success}40` : 'transparent'};
`;

const PreviewExplanation = styled.div`
  margin-top: 2px;
  padding-top: ${({ theme }) => theme.spacing.xs};
  border-top: 1px dashed ${({ theme }) => theme.colors.borderLight};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.4;
`;

/** 검수 탭 이동 버튼 — RunButton 보다 약하게(보더 + 텍스트색) */
const NavigateButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
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
