/**
 * 파이프라인 실행 컴포넌트.
 * 9개 작업 선택 드롭다운 + 옵션 설정 + 실행/취소 버튼.
 * 실행 중에는 SSE 로그 스트림을 EventSource로 구독하여 실시간 표시.
 * 30초마다 상태 polling으로 진행률 동기화.
 *
 * @param {Object} props - 없음 (자체 상태 관리)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { MdPlayArrow, MdStop, MdRefresh, MdChevronDown } from 'react-icons/md';
import StatusBadge from '@/shared/components/StatusBadge';
import {
  runPipeline,
  cancelPipeline,
  fetchPipelineStatus,
  fetchPipelineCheckpoint,
  getPipelineLogUrl,
} from '../api/dataApi';
import { SERVICE_URLS } from '@/shared/api/serviceUrls';

/** 실행 가능한 파이프라인 작업 9개 */
const PIPELINE_TASKS = [
  { value: 'full_reload', label: '전체 재적재', desc: '5DB 모두 클리어 후 재적재 (장시간)' },
  { value: 'tmdb_collect', label: 'TMDB 수집', desc: 'TMDB 신규 영화 수집 및 업데이트' },
  { value: 'kobis_collect', label: 'KOBIS 수집', desc: 'KOBIS 영화 정보 수집' },
  { value: 'kmdb_collect', label: 'KMDb 수집', desc: 'KMDb 한국영화 정보 수집' },
  { value: 'embed_upsert', label: '임베딩 적재', desc: 'Solar 임베딩 생성 후 Qdrant 업서트' },
  { value: 'neo4j_sync', label: 'Neo4j 동기화', desc: 'MySQL → Neo4j 그래프 동기화' },
  { value: 'es_index', label: 'ES 인덱싱', desc: 'Elasticsearch 인덱스 재구축' },
  { value: 'mood_enrich', label: '무드태그 보강', desc: 'Solar Pro로 무드태그 일괄 생성' },
  { value: 'resume', label: '중단 재개', desc: '마지막 체크포인트부터 재개' },
];

/** 파이프라인 상태 → 뱃지 매핑 */
function getPipelineStatusBadge(status) {
  switch (status) {
    case 'running':  return { status: 'info',    label: '실행 중' };
    case 'done':
    case 'success':  return { status: 'success', label: '완료' };
    case 'failed':
    case 'error':    return { status: 'error',   label: '오류' };
    case 'cancelled':return { status: 'warning', label: '취소됨' };
    case 'idle':     return { status: 'default', label: '대기' };
    default:         return { status: 'default', label: status ?? '대기' };
  }
}

export default function PipelineExecutor() {
  /* ── 작업 선택 상태 ── */
  const [selectedTask, setSelectedTask] = useState('tmdb_collect');
  const [clearDb, setClearDb] = useState(false);
  const [resumeMode, setResumeMode] = useState(false);

  /* ── 실행 상태 ── */
  const [pipelineStatus, setPipelineStatus] = useState(null); // API 응답
  const [runLoading, setRunLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [statusError, setStatusError] = useState(null);

  /* ── SSE 로그 ── */
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);
  const eventSourceRef = useRef(null);

  /* ── 체크포인트 ── */
  const [checkpoint, setCheckpoint] = useState(null);

  /* ── polling 타이머 ── */
  const pollTimerRef = useRef(null);

  /** 파이프라인 상태 1회 조회 */
  const loadStatus = useCallback(async () => {
    try {
      const result = await fetchPipelineStatus();
      setPipelineStatus(result);
      setStatusError(null);
    } catch (err) {
      setStatusError(err.message);
    }
  }, []);

  /** 체크포인트 조회 */
  const loadCheckpoint = useCallback(async () => {
    try {
      const result = await fetchPipelineCheckpoint();
      setCheckpoint(result);
    } catch {
      // 체크포인트 없으면 무시
    }
  }, []);

  /* 초기 로드 */
  useEffect(() => {
    loadStatus();
    loadCheckpoint();
  }, [loadStatus, loadCheckpoint]);

  /* 실행 중일 때 30초 polling */
  useEffect(() => {
    if (pipelineStatus?.status === 'running') {
      pollTimerRef.current = setInterval(loadStatus, 30000);
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [pipelineStatus?.status, loadStatus]);

  /* 로그 자동 스크롤 */
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  /* 컴포넌트 언마운트 시 SSE 연결 정리 */
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  /** SSE 로그 스트림 구독 시작 */
  function subscribeLogStream() {
    // 기존 연결 정리
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    const url = `${SERVICE_URLS.AGENT}${getPipelineLogUrl()}`;
    const es = new EventSource(url, { withCredentials: false });

    es.onmessage = (e) => {
      setLogs((prev) => [...prev.slice(-500), e.data]); // 최대 500줄 유지
    };

    es.addEventListener('done', () => {
      es.close();
      eventSourceRef.current = null;
      loadStatus();
    });

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
    };

    eventSourceRef.current = es;
  }

  /** 파이프라인 실행 */
  async function handleRun() {
    setRunLoading(true);
    setLogs([]);
    try {
      const payload = {
        task: selectedTask,
        options: {
          clear_db: clearDb,
          resume: resumeMode,
        },
      };
      await runPipeline(payload);
      setLogs([`[시작] ${PIPELINE_TASKS.find((t) => t.value === selectedTask)?.label} 파이프라인 실행`]);
      // SSE 로그 구독
      subscribeLogStream();
      // 상태 즉시 갱신
      await loadStatus();
    } catch (err) {
      setLogs([`[오류] ${err.message}`]);
    } finally {
      setRunLoading(false);
    }
  }

  /** 파이프라인 취소 */
  async function handleCancel() {
    setCancelLoading(true);
    try {
      await cancelPipeline();
      setLogs((prev) => [...prev, '[취소] 파이프라인 취소 요청 전송']);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      await loadStatus();
    } catch (err) {
      setLogs((prev) => [...prev, `[오류] 취소 실패: ${err.message}`]);
    } finally {
      setCancelLoading(false);
    }
  }

  const isRunning = pipelineStatus?.status === 'running';
  const progressPct = pipelineStatus?.progress ?? 0;
  const badge = getPipelineStatusBadge(pipelineStatus?.status);
  const selectedTaskMeta = PIPELINE_TASKS.find((t) => t.value === selectedTask);

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>파이프라인 실행</SectionTitle>
        <RefreshButton onClick={loadStatus} title="상태 새로고침">
          <MdRefresh size={16} />
        </RefreshButton>
      </SectionHeader>

      {statusError && <ErrorMsg>상태 조회 오류: {statusError}</ErrorMsg>}

      {/* 현재 파이프라인 상태 카드 */}
      <StatusCard>
        <StatusRow>
          <StatusLabel>현재 상태</StatusLabel>
          <StatusBadge status={badge.status} label={badge.label} />
        </StatusRow>

        {pipelineStatus?.currentStep && (
          <StatusRow>
            <StatusLabel>진행 단계</StatusLabel>
            <StatusValue>{pipelineStatus.currentStep}</StatusValue>
          </StatusRow>
        )}

        {isRunning && (
          <>
            <StatusRow>
              <StatusLabel>진행률</StatusLabel>
              <StatusValue>{progressPct}%</StatusValue>
            </StatusRow>
            <ProgressBar>
              <ProgressFill $pct={progressPct} />
            </ProgressBar>
          </>
        )}

        {pipelineStatus?.startedAt && (
          <StatusRow>
            <StatusLabel>시작 시각</StatusLabel>
            <StatusValue>
              {new Date(pipelineStatus.startedAt).toLocaleString('ko-KR')}
            </StatusValue>
          </StatusRow>
        )}

        {checkpoint && (
          <StatusRow>
            <StatusLabel>체크포인트</StatusLabel>
            <StatusValue>
              {checkpoint.task} — {checkpoint.processedCount?.toLocaleString()}건 처리됨
            </StatusValue>
          </StatusRow>
        )}
      </StatusCard>

      {/* 작업 선택 영역 */}
      {!isRunning && (
        <ConfigArea>
          <ConfigTitle>작업 설정</ConfigTitle>

          <TaskSelectWrapper>
            <TaskSelect
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
            >
              {PIPELINE_TASKS.map((task) => (
                <option key={task.value} value={task.value}>
                  {task.label}
                </option>
              ))}
            </TaskSelect>
            <SelectIcon><MdChevronDown size={16} /></SelectIcon>
          </TaskSelectWrapper>

          {selectedTaskMeta && (
            <TaskDesc>{selectedTaskMeta.desc}</TaskDesc>
          )}

          <OptionRow>
            <Checkbox
              id="opt-clear-db"
              type="checkbox"
              checked={clearDb}
              onChange={(e) => setClearDb(e.target.checked)}
            />
            <CheckLabel htmlFor="opt-clear-db">
              DB 초기화 후 실행 (full_reload 전용, 주의)
            </CheckLabel>
          </OptionRow>

          <OptionRow>
            <Checkbox
              id="opt-resume"
              type="checkbox"
              checked={resumeMode}
              onChange={(e) => setResumeMode(e.target.checked)}
            />
            <CheckLabel htmlFor="opt-resume">
              체크포인트부터 재개
              {checkpoint && ` (${checkpoint.processedCount?.toLocaleString()}건 완료)`}
            </CheckLabel>
          </OptionRow>

          <RunButton onClick={handleRun} disabled={runLoading}>
            <MdPlayArrow size={18} />
            {runLoading ? '시작 중...' : '실행'}
          </RunButton>
        </ConfigArea>
      )}

      {/* 실행 중 취소 버튼 */}
      {isRunning && (
        <CancelArea>
          <CancelButton onClick={handleCancel} disabled={cancelLoading}>
            <MdStop size={18} />
            {cancelLoading ? '취소 중...' : '파이프라인 취소'}
          </CancelButton>
        </CancelArea>
      )}

      {/* 실시간 로그 */}
      {logs.length > 0 && (
        <LogSection>
          <LogHeader>
            <LogTitle>실행 로그</LogTitle>
            <ClearLogButton onClick={() => setLogs([])}>지우기</ClearLogButton>
          </LogHeader>
          <LogBox>
            {logs.map((line, i) => (
              /* 로그 라인은 순서가 중요하므로 index 사용 허용 */
              <LogLine key={`log-${i}`} $isError={line.startsWith('[오류]')}>
                {line}
              </LogLine>
            ))}
            <div ref={logEndRef} />
          </LogBox>
        </LogSection>
      )}
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

const ErrorMsg = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const StatusCard = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.xl};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.sm} 0;

  &:not(:last-child) {
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
  }
`;

const StatusLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const StatusValue = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  font-family: ${({ theme }) => theme.fonts.mono};
`;

const ProgressBar = styled.div`
  height: 6px;
  background: ${({ theme }) => theme.colors.bgHover};
  border-radius: 3px;
  margin-top: ${({ theme }) => theme.spacing.sm};
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  width: ${({ $pct }) => `${$pct}%`};
  background: ${({ theme }) => theme.colors.primary};
  border-radius: 3px;
  transition: width 0.5s ease;
`;

const ConfigArea = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.xl};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const ConfigTitle = styled.h4`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const TaskSelectWrapper = styled.div`
  position: relative;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const TaskSelect = styled.select`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  padding-right: 36px;
  background: ${({ theme }) => theme.colors.bgBase ?? theme.colors.bgHover};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  appearance: none;
  cursor: pointer;
`;

const SelectIcon = styled.div`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TaskDesc = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const OptionRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const Checkbox = styled.input`
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: ${({ theme }) => theme.colors.primary};
`;

const CheckLabel = styled.label`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
`;

const RunButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xxl};
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover { opacity: 0.85; }
  &:disabled { opacity: 0.5; }
`;

const CancelArea = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const CancelButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xxl};
  background: ${({ theme }) => theme.colors.error};
  color: #fff;
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover { opacity: 0.85; }
  &:disabled { opacity: 0.5; }
`;

const LogSection = styled.div``;

const LogHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const LogTitle = styled.h4`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const ClearLogButton = styled.button`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  &:hover { color: ${({ theme }) => theme.colors.textSecondary}; }
`;

const LogBox = styled.div`
  background: #0d1117;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  padding: ${({ theme }) => theme.spacing.lg};
  max-height: 320px;
  overflow-y: auto;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 12px;
  line-height: 1.6;
`;

const LogLine = styled.div`
  color: ${({ $isError }) => ($isError ? '#f87171' : '#e2e8f0')};
  white-space: pre-wrap;
  word-break: break-all;
`;
