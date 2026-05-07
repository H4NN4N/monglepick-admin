/**
 * 사용자 관리 페이지.
 *
 * 2026-04-08 개편:
 *  - "업적 마스터" 서브탭 흡수 (구 운영 도구 → 사용자 도메인 이관)
 *  - 최상위에 2개 서브탭 도입: "사용자 목록" / "업적 마스터"
 *
 * 2026-04-23: URL 쿼리파라미터 자동 반응 추가.
 *  - ?userId=u_xxx : 해당 사용자 자동 선택 + 상세 패널 오픈
 *  - ?action=suspend|activate|role|points-adjust|tokens-grant : UserDetailPanel 을 통해
 *    해당 action 모달을 자동 오픈 (userId 도 함께 있어야 동작)
 *  - location.state.draft 가 있으면 UserDetailPanel → UserActionModal 에 초기값 주입
 *
 * 2026-04-29: AI 어시스턴트 navigation 으로 도착한 후 모달 자동 오픈이 끝나면
 *   URL 의 액션 관련 쿼리(action/reason/suspendUntil/targetRole/...)를 즉시 정리한다.
 *   정리하지 않으면 새로고침 시 같은 URL 로 useQueryParams 가 재계산되어
 *   pendingAction 이 다시 truthy 가 되고 → UserDetailPanel useEffect 가
 *   초기 모달을 또 열어버리는 무한 재오픈 버그가 발생한다.
 *   userId 는 보존하여 사용자 상세 패널 자체는 새로고침 후에도 유지되도록 한다.
 *
 * 사용자 목록 서브탭:
 * - 2단 레이아웃 구조 (좌: UserTable, 우: UserDetailPanel)
 * - 선택된 사용자가 없으면 1단으로 축소
 *
 * 업적 마스터 서브탭:
 * - 업적 코드/이름/설명/포인트 보상 CRUD
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import UserTable from '../components/UserTable';
import UserDetailPanel from '../components/UserDetailPanel';
import AchievementMasterTab from '../components/AchievementMasterTab';
import { useQueryParams } from '@/shared/hooks/useQueryParams';
import { useAiPrefill } from '@/shared/hooks/useAiPrefill';

/** 서브탭 정의 */
const TABS = [
  { key: 'list',        label: '사용자 목록' },
  { key: 'achievement', label: '업적 마스터' },
];

/** 유효한 action 값 집합 (UserActionModal mode 와 매핑) */
const VALID_ACTIONS = new Set(['suspend', 'activate', 'role', 'points-adjust', 'tokens-grant']);

/**
 * AI 어시스턴트 navigation 으로 들어온 URL 쿼리 중
 * 모달 자동 오픈/prefill 에 사용되고 나면 즉시 제거해야 하는 키 목록.
 *
 * userId 는 보존(상세 패널이 사라지지 않도록).
 * 그 외 액션·prefill 관련 쿼리는 새로고침 시 모달 재오픈을 막기 위해 모두 제거.
 *  - action          : 모달 모드 (suspend / activate / role / points-adjust / tokens-grant)
 *  - reason          : 정지·복구·역할변경·포인트조정·이용권발급 공통 사유
 *  - suspendUntil    : 임시 정지 종료일 (goto_user_suspend prefill)
 *  - targetRole      : 역할 변경 시 변경 대상 역할 (goto_user_role prefill)
 *  - pointAmount     : 수동 포인트 조정 변동량 (goto_user_points_adjust prefill)
 *  - tokenAmount     : 수동 AI 이용권 발급 수량 (goto_user_tokens_grant prefill)
 */
const ACTION_QUERY_KEYS = [
  'action',
  'reason',
  'suspendUntil',
  'targetRole',
  'pointAmount',
  'tokenAmount',
];

/**
 * URL ?action= 값을 UserActionModal 의 mode 값으로 변환.
 * URL 에서는 하이픈 표기(points-adjust)를 사용하고 모달에서는 내부 mode 명(points, grant-tokens)을 사용한다.
 */
function actionToModalMode(action) {
  if (action === 'points-adjust') return 'points';
  if (action === 'tokens-grant')  return 'grant-tokens';
  return action; // suspend | activate | role
}

/**
 * Agent navigation tool 이 URL query 로 보내는 prefill 키들을 UserActionModal 의
 * `aiDraft` 형태로 변환한다.
 *
 * Agent 측 URL 키 → UserActionModal aiDraft 키 매핑:
 *  - pointAmount  (string|int) → amount (number)        — `points` 모드
 *  - tokenAmount  (string|int) → count  (number)        — `grant-tokens` 모드
 *  - reason       (string)     → reason (string passthrough)
 *  - targetRole   (string)     → role   (string passthrough)
 *  - suspendUntil (ISO date)   → durationDays (오늘 기준 잔여 일수, 1일 미만은 무시)
 *
 * 이 변환이 빠져 있어 "리워드 지급 폼 prefill 누락" 회귀(2026-04-29)가 발생했다.
 * NavigationCard 가 `navigate(path)` 만 수행하고 location.state.draft 를 채우지 않으므로,
 * URL 쿼리가 prefill 의 단일 진실 원본이다.
 *
 * @param {URLSearchParams} searchParams
 * @returns {Object|null} 빈 draft 면 null
 */
function buildUrlDraft(searchParams) {
  const pointAmount  = searchParams.get('pointAmount');
  const tokenAmount  = searchParams.get('tokenAmount');
  const reason       = searchParams.get('reason');
  const targetRole   = searchParams.get('targetRole');
  const suspendUntil = searchParams.get('suspendUntil');

  const draft = {};
  if (pointAmount != null && pointAmount !== '' && !Number.isNaN(Number(pointAmount))) {
    draft.amount = Number(pointAmount);
  }
  if (tokenAmount != null && tokenAmount !== '' && !Number.isNaN(Number(tokenAmount))) {
    draft.count = Number(tokenAmount);
  }
  if (reason)     draft.reason = reason;
  if (targetRole) draft.role   = targetRole;
  if (suspendUntil) {
    /* ISO 날짜를 오늘 기준 잔여 일수로 환산. 잘못된 날짜·과거 시각은 무시. */
    const t = Date.parse(suspendUntil);
    if (!Number.isNaN(t)) {
      const days = Math.ceil((t - Date.now()) / 86400000);
      if (days > 0) draft.durationDays = days;
    }
  }
  return Object.keys(draft).length > 0 ? draft : null;
}

export default function UsersPage() {
  /* ── URL 쿼리파라미터 / AI prefill ── */
  /**
   * ?userId=u_xxx          : 해당 사용자 자동 선택 + 상세 패널 오픈
   * ?action=suspend|...    : userId 와 함께 사용 시 해당 액션 모달 자동 오픈
   * location.state.draft   : UserActionModal 초기값으로 전달
   */
  const { userId: queryUserId, action: queryAction } = useQueryParams();
  const { draft, isAiGenerated } = useAiPrefill();

  /**
   * 액션 관련 쿼리 cleanup 용 setter.
   * useQueryParams 는 read-only 파싱 훅이므로, 쓰기는 react-router-dom 의 useSearchParams 를 함께 사용.
   * 두 훅 모두 useLocation 기반이라 동일한 search 문자열을 바라보므로 정합성 유지된다.
   */
  const [searchParams, setSearchParams] = useSearchParams();

  /*
   * 2026-04-29 리워드/이용권/정지 등 prefill 누락 회귀 픽스.
   *
   * Agent 의 navigation tool (goto_points_adjust / goto_token_grant / goto_user_suspend 등)은
   * 폼 prefill 값을 URL query (pointAmount/tokenAmount/reason/...) 로 실어 보낸다. 그러나
   * NavigationCard 는 `navigate(path)` 만 수행하므로 location.state.draft 가 비어 있고
   * useAiPrefill 은 null 을 반환한다. 결과적으로 UserActionModal 에 prefill 값이
   * 도달하지 않아 폼이 빈 채로 열리는 회귀.
   *
   * URL 쿼리 → aiDraft 로 변환해 누락분을 보완한다. cleanActionQueries 가 URL 키를
   * 제거해도 한 번 캡처한 snapshot 은 유지(setSnapshot 을 next!=null 일 때만 호출)하여
   * UserActionModal 입력 값이 리셋되지 않게 한다. 다음 AI 액션이 새 prefill 키를
   * URL 에 실어보내면 그 시점에 snapshot 이 갱신된다.
   */
  const [urlDraftSnapshot, setUrlDraftSnapshot] = useState(() =>
    buildUrlDraft(searchParams)
  );
  useEffect(() => {
    const next = buildUrlDraft(searchParams);
     
    if (next !== null) setUrlDraftSnapshot(next);
    // null 이어도 기존 snapshot 유지 — cleanup 후에도 모달이 prefill 을 그대로 보유.
  }, [searchParams]);

  /**
   * UserActionModal 이 실제로 사용할 aiDraft.
   *  - 1순위: form_prefill SSE 로 들어온 location.state.draft (useAiPrefill)
   *  - 2순위: URL 쿼리에서 변환한 snapshot (buildUrlDraft)
   * 메모이제이션으로 reference equality 를 유지해 UserActionModal 의 useEffect 가
   * 불필요하게 재발화하는 것을 방지.
   */
  const effectiveAiDraft = useMemo(
    () => (isAiGenerated ? draft : null) || urlDraftSnapshot,
    [isAiGenerated, draft, urlDraftSnapshot]
  );

  /** 현재 활성 탭 */
  const [activeTab, setActiveTab] = useState('list');

  /**
   * 현재 선택된 사용자 ID (사용자 목록 탭 전용).
   * null이면 상세 패널이 닫혀 있고 1단 레이아웃이 적용된다.
   * ?userId 쿼리가 있으면 초기값으로 사용.
   */
  const [selectedUserId, setSelectedUserId] = useState(() => queryUserId || null);

  /**
   * UserDetailPanel 에 전달할 자동 오픈 action.
   * ?action= 쿼리가 유효한 값이면 세팅, 상세 패널이 마운트된 후 한 번만 소비된다.
   */
  const [pendingAction, setPendingAction] = useState(() =>
    queryUserId && VALID_ACTIONS.has(queryAction) ? queryAction : null
  );

  /**
   * URL search 에서 ACTION_QUERY_KEYS 에 해당하는 키를 제거한다.
   * userId 는 그대로 보존하여 상세 패널은 유지하되,
   * 모달 자동 오픈을 트리거하는 쿼리만 정리해 새로고침 시 모달 재오픈을 차단한다.
   *
   * setSearchParams 는 replace:true 로 호출하여 browser history stack 을 오염시키지 않는다.
   * 이미 정리할 키가 하나도 없으면 setSearchParams 를 호출하지 않아 불필요한 리렌더를 줄인다.
   */
  const cleanActionQueries = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    for (const key of ACTION_QUERY_KEYS) {
      if (next.has(key)) {
        next.delete(key);
        changed = true;
      }
    }
    if (changed) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  /**
   * UserDetailPanel 이 initialAction 을 소비한 직후 호출되는 콜백.
   *  - 컴포넌트 state(pendingAction) 를 비우고
   *  - URL 의 액션 관련 쿼리(action / reason / suspendUntil / targetRole / pointAmount / tokenAmount)를 제거
   * 두 가지를 함께 처리해야 새로고침 시 모달 재오픈이 발생하지 않는다.
   */
  const consumeInitialAction = useCallback(() => {
    setPendingAction(null);
    cleanActionQueries();
  }, [cleanActionQueries]);

  /** UserTable onSelectUser 콜백 */
  function handleSelectUser(userId) {
    setSelectedUserId(userId);
    /* 수동 선택 시 AI pending action 초기화 */
    setPendingAction(null);
  }

  /** 상세 패널 닫기 */
  function handleCloseDetail() {
    setSelectedUserId(null);
    setPendingAction(null);
    /* 상세를 닫는 순간에도 잔여 액션 쿼리는 제거. (사용자가 X 버튼으로 모달이 아닌
       상세 패널 자체를 닫는 흐름에서도 새로고침 모달 재오픈을 차단) */
    cleanActionQueries();
  }

  /**
   * ?userId 쿼리가 바뀌면 선택 사용자 동기화.
   * (브라우저 뒤로가기 등으로 URL 이 바뀌는 경우 대응)
   */
  useEffect(() => {
    if (queryUserId) {
       
      setSelectedUserId(queryUserId);
      if (VALID_ACTIONS.has(queryAction)) {
        setPendingAction(queryAction);
      }
      /* 사용자 목록 탭으로 자동 전환 */
      setActiveTab('list');
    }
  }, [queryUserId, queryAction]);

  /**
   * 액션(역할 변경/정지/복구) 완료 후 목록 새로고침용 key.
   * refreshKey 변경 시 UserTable이 재마운트되어 loadUsers 재실행.
   */
  const [refreshKey, setRefreshKey] = useState(0);

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <Wrapper>
      {/* ── 페이지 헤더 ── */}
      <PageHeader>
        <PageTitle>사용자 관리</PageTitle>
        <PageDesc>
          회원 목록·역할·정지/복구·활동 내역 관리 및 업적 마스터 데이터 관리
        </PageDesc>
      </PageHeader>

      {/* ── 서브탭 네비게이션 ── */}
      <TabNav>
        {TABS.map((tab) => (
          <TabButton
            key={tab.key}
            $active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </TabButton>
        ))}
      </TabNav>

      {/* ── 사용자 목록 탭 ── */}
      {activeTab === 'list' && (
        <TwoPane $hasDetail={!!selectedUserId}>
          {/* 좌측: 회원 목록 테이블 */}
          <ListPane>
            <UserTable
              refreshKey={refreshKey}
              selectedUserId={selectedUserId}
              onSelectUser={handleSelectUser}
            />
          </ListPane>

          {/* 우측: 상세 패널 (사용자 선택 시에만 렌더링) */}
          {selectedUserId && (
            <UserDetailPanel
              userId={selectedUserId}
              onClose={handleCloseDetail}
              onRefresh={handleRefresh}
              /**
               * AI 어시스턴트가 요청한 초기 오픈 액션.
               * UserDetailPanel 이 마운트되면 해당 mode 로 UserActionModal 을 자동 오픈.
               * 소비 후 null 로 초기화하여 재오픈 방지.
               */
              initialAction={pendingAction ? actionToModalMode(pendingAction) : null}
              onInitialActionConsumed={consumeInitialAction}
              /**
               * AI draft 초기값 — UserActionModal 폼 필드에 주입.
               * 1순위 form_prefill SSE state.draft (useAiPrefill), 2순위 URL 쿼리(buildUrlDraft).
               * 2026-04-29: navigation tool prefill 누락 회귀 차단을 위해 URL 변환 snapshot 추가.
               */
              aiDraft={effectiveAiDraft}
            />
          )}
        </TwoPane>
      )}

      {/* ── 업적 마스터 탭 ── */}
      {activeTab === 'achievement' && <AchievementMasterTab />}
    </Wrapper>
  );
}

/* ── styled-components ── */

const Wrapper = styled.div``;

/** 페이지 상단 헤더 영역 */
const PageHeader = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const PageTitle = styled.h2`
  font-size: ${({ theme }) => theme.fontSizes.xxl};
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const PageDesc = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textMuted};
`;

/** 서브탭 네비게이션 */
const TabNav = styled.nav`
  display: flex;
  border-bottom: 2px solid ${({ theme }) => theme.colors.border};
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
  gap: 0;
`;

const TabButton = styled.button`
  padding: 10px 20px;
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ $active, theme }) =>
    $active ? theme.fontWeights.semibold : theme.fontWeights.normal};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  border-bottom: 2px solid ${({ $active, theme }) =>
    $active ? theme.colors.primary : 'transparent'};
  margin-bottom: -2px;
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

/**
 * 2단 그리드 레이아웃.
 * $hasDetail=true  → 목록(1fr) + 상세(420px)
 * $hasDetail=false → 목록(1fr) 단독
 */
const TwoPane = styled.div`
  display: grid;
  grid-template-columns: ${({ $hasDetail }) =>
    $hasDetail ? '1fr 420px' : '1fr'};
  gap: ${({ theme }) => theme.spacing.lg};
  align-items: start;
  transition: grid-template-columns ${({ theme }) => theme.transitions.normal};
`;

/** 좌측 목록 패널 */
const ListPane = styled.div`
  min-width: 0; /* 그리드 셀 오버플로우 방지 */
`;
