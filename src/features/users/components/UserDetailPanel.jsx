/**
 * 사용자 상세 패널 컴포넌트.
 *
 * 우측 sticky 패널로 렌더링되며 다음 섹션으로 구성된다:
 * 1. 프로필 섹션: 닉네임, 이메일, 역할, 상태, 가입일
 * 2. 포인트 섹션: 잔액, 등급
 * 3. 활동 카운트: 게시글 수, 리뷰 수, 댓글 수
 * 4. 액션 버튼: 역할 변경 / 계정 정지 or 계정 복구
 * 5. 하단 미니 탭: 활동 이력 | 포인트 내역 | 결제 내역 (lazy 로딩)
 *
 * @param {Object}   props
 * @param {string}   props.userId     - 조회할 사용자 ID
 * @param {Function} props.onClose    - 패널 닫기 콜백
 * @param {Function} props.onRefresh  - 외부 목록 갱신 콜백 (액션 완료 후 호출)
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import {
  MdClose,
  MdEdit,
  MdBlock,
  MdCheckCircle,
  MdPerson,
} from 'react-icons/md';
import {
  fetchUserDetail,
  fetchUserActivity,
  fetchUserPoints,
  fetchUserPayments,
} from '../api/usersApi';
import StatusBadge from '@/shared/components/StatusBadge';
import UserActionModal from './UserActionModal';

/** 날짜 포맷 헬퍼: ISO → YYYY.MM.DD HH:MM */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 계정 상태 → StatusBadge 매핑 */
const STATUS_BADGE = {
  ACTIVE:    { status: 'success', label: '활성' },
  SUSPENDED: { status: 'error',   label: '정지' },
  LOCKED:    { status: 'warning', label: '잠금' },
};

/** 역할 → StatusBadge 매핑 */
const ROLE_BADGE = {
  ADMIN: { status: 'info',    label: 'ADMIN' },
  USER:  { status: 'default', label: 'USER' },
};

/** 등급 → StatusBadge 매핑 */
const GRADE_BADGE = {
  NORMAL:   { status: 'default', label: 'NORMAL' },
  BRONZE:   { status: 'warning', label: 'BRONZE' },
  SILVER:   { status: 'info',    label: 'SILVER' },
  GOLD:     { status: 'warning', label: 'GOLD' },
  PLATINUM: { status: 'success', label: 'PLATINUM' },
};

/** 하단 미니 탭 정의 */
const MINI_TABS = [
  { id: 'activity', label: '활동 이력' },
  { id: 'points',   label: '포인트 내역' },
  { id: 'payments', label: '결제 내역' },
];

export default function UserDetailPanel({ userId, onClose, onRefresh }) {
  /* ── 사용자 상세 상태 ── */
  const [detail, setDetail]               = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError]     = useState(null);

  /* ── 미니 탭 상태 ── */
  /** 현재 활성 미니 탭 ID */
  const [activeTab, setActiveTab] = useState('activity');
  /** 탭별 데이터 캐시: { activity: [], points: [], payments: [] } */
  const [tabData, setTabData]     = useState({});
  /** 탭별 로딩 상태 */
  const [tabLoading, setTabLoading] = useState({});
  /** 탭별 에러 메시지 */
  const [tabError, setTabError]   = useState({});
  /** 한 번이라도 로드된 탭 목록 (중복 요청 방지) */
  const [loadedTabs, setLoadedTabs] = useState(new Set());

  /* ── 액션 모달 상태 ── */
  /** 열려 있는 모달 모드: 'role' | 'suspend' | 'activate' | null */
  const [modalMode, setModalMode] = useState(null);

  /**
   * 사용자 상세 정보 조회.
   * userId 변경 시 기존 상태를 초기화하고 새로 요청한다.
   */
  const loadDetail = useCallback(async () => {
    if (!userId) return;
    try {
      setDetailLoading(true);
      setDetailError(null);
      setDetail(null);
      // 탭 캐시도 초기화 (다른 사용자 선택 시 오염 방지)
      setTabData({});
      setLoadedTabs(new Set());
      setActiveTab('activity');
      const result = await fetchUserDetail(userId);
      setDetail(result);
    } catch (err) {
      setDetailError(err.message || '상세 정보를 불러올 수 없습니다.');
    } finally {
      setDetailLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  /**
   * 미니 탭 데이터 로딩.
   * 이미 로드된 탭은 재요청하지 않는다 (lazy 캐싱).
   *
   * @param {string} tabId - 'activity' | 'points' | 'payments'
   */
  const loadTabData = useCallback(async (tabId) => {
    if (!userId || loadedTabs.has(tabId)) return;

    try {
      setTabLoading((prev) => ({ ...prev, [tabId]: true }));
      setTabError((prev) => ({ ...prev, [tabId]: null }));

      let result;
      if (tabId === 'activity') {
        result = await fetchUserActivity(userId, { page: 0, size: 10 });
      } else if (tabId === 'points') {
        result = await fetchUserPoints(userId, { page: 0, size: 10 });
      } else if (tabId === 'payments') {
        result = await fetchUserPayments(userId, { page: 0, size: 10 });
      }

      const items = result?.content ?? result ?? [];
      setTabData((prev) => ({ ...prev, [tabId]: items }));
      setLoadedTabs((prev) => new Set([...prev, tabId]));
    } catch (err) {
      setTabError((prev) => ({
        ...prev,
        [tabId]: err.message || '데이터를 불러올 수 없습니다.',
      }));
    } finally {
      setTabLoading((prev) => ({ ...prev, [tabId]: false }));
    }
  }, [userId, loadedTabs]);

  /**
   * 미니 탭 전환 핸들러.
   * 처음 방문하는 탭에 한해 API를 호출한다.
   */
  function handleTabChange(tabId) {
    setActiveTab(tabId);
    loadTabData(tabId);
  }

  /* 컴포넌트 마운트 시 첫 번째 탭(activity) 자동 로드 */
  useEffect(() => {
    if (userId && !loadedTabs.has('activity')) {
      loadTabData('activity');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /**
   * 액션 완료 콜백.
   * 모달을 닫고, 상세 정보를 재조회하며, 외부 목록도 갱신한다.
   */
  function handleActionSuccess() {
    setModalMode(null);
    // 탭 캐시를 무효화하여 다음 조회 시 최신 데이터를 가져오도록 함
    setLoadedTabs(new Set());
    loadDetail();
    onRefresh?.();
  }

  /* ── 렌더링 ── */

  return (
    <Panel>
      {/* ── 패널 헤더 (sticky) ── */}
      <PanelHeader>
        <PanelTitle>
          {detailLoading ? '불러오는 중...' : (detail?.nickname ?? detail?.email ?? '사용자 상세')}
        </PanelTitle>
        <CloseButton onClick={onClose} title="닫기">
          <MdClose size={18} />
        </CloseButton>
      </PanelHeader>

      {/* ── 에러 상태 ── */}
      {detailError && (
        <ErrorSection>
          <ErrorMsg>{detailError}</ErrorMsg>
        </ErrorSection>
      )}

      {/* ── 로딩 상태 ── */}
      {detailLoading && (
        <LoadingSection>불러오는 중...</LoadingSection>
      )}

      {/* ── 상세 내용 ── */}
      {!detailLoading && detail && (
        <>
          {/* 1. 프로필 섹션 */}
          <Section>
            <SectionTitle>
              <MdPerson size={14} />
              프로필
            </SectionTitle>
            <ProfileGrid>
              <MetaItem>
                <MetaLabel>닉네임</MetaLabel>
                <MetaValue>{detail.nickname ?? '-'}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>이메일</MetaLabel>
                <MetaValue title={detail.email}>{detail.email ?? '-'}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>역할</MetaLabel>
                <StatusBadge
                  status={ROLE_BADGE[detail.userRole]?.status ?? 'default'}
                  label={ROLE_BADGE[detail.userRole]?.label ?? (detail.userRole ?? '-')}
                />
              </MetaItem>
              <MetaItem>
                <MetaLabel>상태</MetaLabel>
                <StatusBadge
                  status={STATUS_BADGE[detail.status]?.status ?? 'default'}
                  label={STATUS_BADGE[detail.status]?.label ?? (detail.status ?? '-')}
                />
              </MetaItem>
              <MetaItem>
                <MetaLabel>가입일</MetaLabel>
                <MetaValue>{formatDate(detail.createdAt)}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>최근 로그인</MetaLabel>
                <MetaValue>{formatDate(detail.lastLoginAt)}</MetaValue>
              </MetaItem>
            </ProfileGrid>
          </Section>

          {/* 2. 포인트 / 등급 섹션 */}
          <Section>
            <SectionTitle>포인트 / 등급</SectionTitle>
            <StatRow>
              <StatCard>
                <StatLabel>보유 포인트</StatLabel>
                <StatValue $accent>
                  {(detail.pointBalance ?? 0).toLocaleString()}P
                </StatValue>
              </StatCard>
              <StatCard>
                <StatLabel>등급</StatLabel>
                <StatusBadge
                  status={GRADE_BADGE[detail.grade]?.status ?? 'default'}
                  label={GRADE_BADGE[detail.grade]?.label ?? (detail.grade ?? '-')}
                />
              </StatCard>
            </StatRow>
          </Section>

          {/* 3. 활동 카운트 섹션 */}
          <Section>
            <SectionTitle>활동 통계</SectionTitle>
            <StatRow>
              <StatCard>
                <StatLabel>게시글</StatLabel>
                <StatValue>{(detail.postCount ?? 0).toLocaleString()}</StatValue>
              </StatCard>
              <StatCard>
                <StatLabel>리뷰</StatLabel>
                <StatValue>{(detail.reviewCount ?? 0).toLocaleString()}</StatValue>
              </StatCard>
              <StatCard>
                <StatLabel>댓글</StatLabel>
                <StatValue>{(detail.commentCount ?? 0).toLocaleString()}</StatValue>
              </StatCard>
            </StatRow>
          </Section>

          {/* 4. 액션 버튼 섹션 */}
          <Section>
            <SectionTitle>관리 액션</SectionTitle>
            <ActionRow>
              {/* 역할 변경 버튼 */}
              <ActionButton
                $variant="primary"
                onClick={() => setModalMode('role')}
                title="역할 변경"
              >
                <MdEdit size={14} />
                역할 변경
              </ActionButton>

              {/* 계정 정지 / 복구 버튼 (상태에 따라 토글) */}
              {detail.status === 'SUSPENDED' ? (
                <ActionButton
                  $variant="success"
                  onClick={() => setModalMode('activate')}
                  title="계정 복구"
                >
                  <MdCheckCircle size={14} />
                  계정 복구
                </ActionButton>
              ) : (
                <ActionButton
                  $variant="danger"
                  onClick={() => setModalMode('suspend')}
                  title="계정 정지"
                  disabled={detail.userRole === 'ADMIN'} // 관리자 계정 정지 방지
                >
                  <MdBlock size={14} />
                  계정 정지
                </ActionButton>
              )}

              {/* 제재 이력 조회 (Phase 6-1 보강) */}
              <ActionButton
                $variant="default"
                onClick={() => setModalMode('history')}
                title="제재 이력 조회"
              >
                제재 이력
              </ActionButton>

              {/* 수동 포인트 조정 (Phase 6-2) */}
              <ActionButton
                $variant="primary"
                onClick={() => setModalMode('points')}
                title="수동 포인트 지급/회수"
              >
                포인트 조정
              </ActionButton>

              {/* 수동 AI 이용권 발급 (Phase 6-3) */}
              <ActionButton
                $variant="primary"
                onClick={() => setModalMode('grant-tokens')}
                title="수동 AI 이용권 발급"
              >
                이용권 발급
              </ActionButton>
            </ActionRow>
            {/* 관리자 계정 정지 불가 안내 */}
            {detail.userRole === 'ADMIN' && detail.status !== 'SUSPENDED' && (
              <AdminNotice>관리자 계정은 정지할 수 없습니다.</AdminNotice>
            )}
          </Section>

          {/* 5. 하단 미니 탭 섹션 */}
          <Section $noBorder>
            {/* 미니 탭 네비게이션 */}
            <MiniTabNav>
              {MINI_TABS.map((tab) => (
                <MiniTabButton
                  key={tab.id}
                  $active={activeTab === tab.id}
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                </MiniTabButton>
              ))}
            </MiniTabNav>

            {/* 탭 콘텐츠 */}
            <MiniTabContent>
              {tabLoading[activeTab] ? (
                <TabLoading>불러오는 중...</TabLoading>
              ) : tabError[activeTab] ? (
                <TabErrorMsg>{tabError[activeTab]}</TabErrorMsg>
              ) : !tabData[activeTab] || tabData[activeTab].length === 0 ? (
                <TabEmpty>내역이 없습니다.</TabEmpty>
              ) : (
                <TabList>
                  {tabData[activeTab].map((item, idx) => (
                    /* 각 탭 데이터에 고유 id가 있으면 사용, 없으면 복합 key */
                    <TabListItem key={item.id ?? `${activeTab}-${idx}`}>
                      {/* 활동 이력 행 */}
                      {activeTab === 'activity' && (
                        <>
                          <TabItemLeft>
                            <TabItemType>{item.type ?? item.activityType ?? '-'}</TabItemType>
                            <TabItemDesc>{item.description ?? item.content ?? '-'}</TabItemDesc>
                          </TabItemLeft>
                          <TabItemDate>{formatDate(item.createdAt)}</TabItemDate>
                        </>
                      )}

                      {/* 포인트 내역 행 */}
                      {activeTab === 'points' && (
                        <>
                          <TabItemLeft>
                            <TabItemType>{item.type ?? item.changeType ?? '-'}</TabItemType>
                            <TabItemDesc>{item.description ?? item.reason ?? '-'}</TabItemDesc>
                          </TabItemLeft>
                          <TabItemRight>
                            <TabItemAmount
                              $positive={(item.amount ?? item.changeAmount ?? 0) > 0}
                            >
                              {(item.amount ?? item.changeAmount ?? 0) > 0 ? '+' : ''}
                              {(item.amount ?? item.changeAmount ?? 0).toLocaleString()}P
                            </TabItemAmount>
                            <TabItemDate>{formatDate(item.createdAt)}</TabItemDate>
                          </TabItemRight>
                        </>
                      )}

                      {/* 결제 내역 행 */}
                      {activeTab === 'payments' && (
                        <>
                          <TabItemLeft>
                            <TabItemType>{item.type ?? item.paymentType ?? '-'}</TabItemType>
                            <TabItemDesc>{item.description ?? item.productName ?? '-'}</TabItemDesc>
                          </TabItemLeft>
                          <TabItemRight>
                            <TabItemAmount $positive={false}>
                              {(item.amount ?? 0).toLocaleString()}원
                            </TabItemAmount>
                            <TabItemDate>{formatDate(item.createdAt)}</TabItemDate>
                          </TabItemRight>
                        </>
                      )}
                    </TabListItem>
                  ))}
                </TabList>
              )}
            </MiniTabContent>
          </Section>
        </>
      )}

      {/* ── 액션 모달 ── */}
      <UserActionModal
        isOpen={modalMode !== null}
        mode={modalMode}
        user={detail ? {
          userId:   detail.userId,
          nickname: detail.nickname,
          email:    detail.email,
          userRole: detail.userRole,
          status:   detail.status,
        } : null}
        onClose={() => setModalMode(null)}
        onSuccess={handleActionSuccess}
      />
    </Panel>
  );
}

/* ── styled-components ── */

/**
 * 패널 컨테이너.
 * sticky 위치로 고정되며, 최대 높이를 초과하면 내부 스크롤.
 */
const Panel = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  overflow-y: auto;
  max-height: calc(100vh - 200px);
  position: sticky;
  top: ${({ theme }) => theme.layout.headerHeight};
`;

/** 패널 헤더 (스크롤해도 고정) */
const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgHover};
  position: sticky;
  top: 0;
  z-index: 10;
`;

const PanelTitle = styled.h4`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.textMuted};
  flex-shrink: 0;
  &:hover {
    background: ${({ theme }) => theme.colors.border};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

/** 에러/로딩 전용 섹션 */
const ErrorSection = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
`;

const ErrorMsg = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.error};
  background: ${({ theme }) => theme.colors.errorBg};
  border-radius: 4px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
`;

const LoadingSection = styled.div`
  padding: ${({ theme }) => theme.spacing.xxl};
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

/**
 * 각 정보 섹션.
 * $noBorder prop이 true면 하단 구분선을 제거한다.
 */
const Section = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ $noBorder, theme }) =>
    $noBorder ? 'none' : `1px solid ${theme.colors.borderLight}`};
`;

const SectionTitle = styled.h5`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

/** 2열 그리드 (프로필 메타 정보) */
const ProfileGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};
`;

const MetaItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0; /* 오버플로우 방지 */
`;

const MetaLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const MetaValue = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textPrimary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/** 통계 카드 행 */
const StatRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const StatCard = styled.div`
  flex: 1;
  background: ${({ theme }) => theme.colors.bgHover};
  border: 1px solid ${({ theme }) => theme.colors.borderLight};
  border-radius: 6px;
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const StatLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const StatValue = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ $accent, theme }) =>
    $accent ? theme.colors.primary : theme.colors.textPrimary};
`;

/** 액션 버튼 행 */
const ActionRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  border-radius: 4px;
  transition: all ${({ theme }) => theme.transitions.fast};

  /* $variant에 따른 색상 */
  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'primary':
        return `
          border: 1px solid ${theme.colors.primary};
          color: ${theme.colors.primary};
          background: ${theme.colors.primaryLight};
          &:hover:not(:disabled) { background: ${theme.colors.primary}; color: #fff; }
        `;
      case 'danger':
        return `
          border: 1px solid ${theme.colors.error};
          color: ${theme.colors.error};
          background: ${theme.colors.errorBg};
          &:hover:not(:disabled) { background: ${theme.colors.error}; color: #fff; }
        `;
      case 'success':
        return `
          border: 1px solid ${theme.colors.success};
          color: ${theme.colors.success};
          background: transparent;
          &:hover:not(:disabled) { background: ${theme.colors.success}; color: #fff; }
        `;
      default:
        return `
          border: 1px solid ${theme.colors.border};
          color: ${theme.colors.textSecondary};
        `;
    }
  }}

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

/** 관리자 계정 정지 불가 안내 텍스트 */
const AdminNotice = styled.p`
  margin-top: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

/* ── 미니 탭 ── */

const MiniTabNav = styled.div`
  display: flex;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const MiniTabButton = styled.button`
  padding: 6px 12px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ $active, theme }) =>
    $active ? theme.fontWeights.semibold : theme.fontWeights.normal};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  border-bottom: 2px solid ${({ $active, theme }) =>
    $active ? theme.colors.primary : 'transparent'};
  margin-bottom: -1px;
  transition: all ${({ theme }) => theme.transitions.fast};
  white-space: nowrap;
  &:hover { color: ${({ theme }) => theme.colors.primary}; }
`;

const MiniTabContent = styled.div`
  min-height: 80px;
`;

const TabLoading = styled.p`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`;

const TabErrorMsg = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.error};
  padding: ${({ theme }) => theme.spacing.sm};
`;

const TabEmpty = styled.p`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`;

const TabList = styled.ul`
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const TabListItem = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: 7px ${({ theme }) => theme.spacing.sm};
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.bgHover};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`;

const TabItemLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
`;

const TabItemRight = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
`;

/** 활동 유형 / 결제 유형 라벨 */
const TabItemType = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

/** 활동 설명 텍스트 */
const TabItemDesc = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
`;

/** 포인트/금액: $positive true면 초록색, false면 기본색 */
const TabItemAmount = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ $positive, theme }) =>
    $positive ? theme.colors.success : theme.colors.textPrimary};
  font-family: ${({ theme }) => theme.fonts.mono};
`;

const TabItemDate = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-family: ${({ theme }) => theme.fonts.mono};
  white-space: nowrap;
`;
