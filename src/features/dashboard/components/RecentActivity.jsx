/**
 * 최근 활동 피드 컴포넌트.
 *
 * 최대 20건의 최근 활동을 리스트로 표시.
 * 각 항목: 타입 아이콘 + StatusBadge + 설명 + 상대 시간
 *
 * 활동 타입별 아이콘/색상:
 * - PAYMENT   : MdPayment,    primary  (#6366f1)
 * - REPORT    : MdFlag,       error    (#ef4444)
 * - USER_JOIN : MdPersonAdd,  success  (#10b981)
 * - REVIEW    : MdRateReview, info     (#3b82f6)
 * - POST      : MdArticle,    default  (#94a3b8)
 *
 * @param {Object}  props
 * @param {Array}   props.data    - DashboardPage 가 응답 객체에서 추출한 .activities 배열
 *                                  [{ type, description, targetId, createdAt }]
 *                                  (백엔드 DashboardDto.ActivityItem 과 1:1 매칭)
 * @param {boolean} props.loading - 로딩 여부
 */

import styled from 'styled-components';
import {
  MdPayment,
  MdFlag,
  MdPersonAdd,
  MdRateReview,
  MdArticle,
  MdRefresh,
} from 'react-icons/md';
import StatusBadge from '@/shared/components/StatusBadge';

/**
 * 활동 타입 메타데이터 맵.
 * icon     : react-icons 컴포넌트
 * color    : 아이콘 래퍼 배경색
 * iconColor: 아이콘 색상
 * badge    : StatusBadge status 값
 * label    : StatusBadge 표시 텍스트
 */
const TYPE_META = {
  PAYMENT: {
    icon: MdPayment,
    color: '#eef2ff',
    iconColor: '#6366f1',
    badge: 'info',
    label: '결제',
  },
  REPORT: {
    icon: MdFlag,
    color: '#fef2f2',
    iconColor: '#ef4444',
    badge: 'error',
    label: '신고',
  },
  USER_JOIN: {
    icon: MdPersonAdd,
    color: '#ecfdf5',
    iconColor: '#10b981',
    badge: 'success',
    label: '신규 가입',
  },
  REVIEW: {
    icon: MdRateReview,
    color: '#eff6ff',
    iconColor: '#3b82f6',
    badge: 'info',
    label: '리뷰',
  },
  POST: {
    icon: MdArticle,
    color: '#f8fafc',
    iconColor: '#94a3b8',
    badge: 'default',
    label: '게시글',
  },
};

/** 알 수 없는 타입의 폴백 메타 */
const FALLBACK_META = {
  icon: MdArticle,
  color: '#f8fafc',
  iconColor: '#94a3b8',
  badge: 'default',
  label: '기타',
};

/**
 * 상대 시간 변환 함수.
 * createdAt(ISO 문자열)을 사람이 읽기 쉬운 상대 시간으로 변환.
 *
 * 기준:
 * -   0 ~  59초 → "방금 전"
 * -   1 ~  59분 → "N분 전"
 * -   1 ~  23시 → "N시간 전"
 * -   1 ~  30일 → "N일 전"
 * -  31일 이상  → "YYYY.MM.DD" 절대 날짜
 *
 * @param {string} dateStr - ISO 8601 날짜 문자열
 * @returns {string} 상대 시간 문자열
 */
function timeAgo(dateStr) {
  if (!dateStr) return '-';

  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  /* 미래 날짜 방어 처리 */
  if (diffMs < 0) return '방금 전';

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay <= 30) return `${diffDay}일 전`;

  /* 30일 초과: 절대 날짜 표시 */
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/**
 * 활동 목록 새로고침 버튼.
 * onRefresh 콜백이 있을 때만 표시.
 */
export default function RecentActivity({ data, loading, onRefresh }) {
  const activities = Array.isArray(data) ? data : [];

  return (
    <Wrapper>
      {/* ── 헤더 ── */}
      <Header>
        <Title>최근 활동</Title>
        <HeaderRight>
          <CountBadge>{loading ? '...' : `${activities.length}건`}</CountBadge>
          {onRefresh && (
            <RefreshButton onClick={onRefresh} disabled={loading} title="새로고침">
              <MdRefresh size={16} />
            </RefreshButton>
          )}
        </HeaderRight>
      </Header>

      {/* ── 활동 목록 ── */}
      <ListBody>
        {loading ? (
          /* 로딩 스켈레톤 (5줄) */
          Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i}>
              <SkeletonIcon />
              <SkeletonContent>
                <SkeletonLine $width="60%" />
                <SkeletonLine $width="40%" />
              </SkeletonContent>
            </SkeletonRow>
          ))
        ) : activities.length === 0 ? (
          <EmptyMsg>최근 활동이 없습니다.</EmptyMsg>
        ) : (
          activities.map((activity, idx) => {
            const meta = TYPE_META[activity.type] ?? FALLBACK_META;
            const Icon = meta.icon;
            /*
             * 안정적인 React key 합성.
             * 백엔드 ActivityItem 은 id 가 없고 (type, targetId, createdAt) 조합이 사실상 고유하다.
             * targetId 가 누락된 경우(폴백)에도 idx 를 함께 섞어 충돌을 방지한다.
             */
            const rowKey = `${activity.type ?? 'NA'}-${activity.targetId ?? 'NA'}-${activity.createdAt ?? idx}`;

            return (
              <ActivityRow key={rowKey}>
                {/* 타입별 아이콘 */}
                <IconWrapper $bg={meta.color}>
                  <Icon size={16} color={meta.iconColor} />
                </IconWrapper>

                {/* 설명 + 배지 */}
                <ActivityContent>
                  <ActivityTop>
                    <StatusBadge status={meta.badge} label={meta.label} />
                    <ActivityDesc>{activity.description ?? '-'}</ActivityDesc>
                  </ActivityTop>
                  <ActivityTime>{timeAgo(activity.createdAt)}</ActivityTime>
                </ActivityContent>
              </ActivityRow>
            );
          })
        )}
      </ListBody>
    </Wrapper>
  );
}

/* ── styled-components ── */

const Wrapper = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  box-shadow: ${({ theme }) => theme.shadows.card};
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.xl};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Title = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.heading};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

/** 건수 표시 뱃지 */
const CountBadge = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bgHover};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: 2px 8px;
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
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.bgHover};
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ListBody = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;

  /* 최대 높이 설정 후 스크롤 — 활동이 많아도 페이지 길이를 유지 */
  max-height: 480px;
  overflow-y: auto;
`;

const ActivityRow = styled.li`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`;

/** 타입 아이콘 원형 래퍼 */
const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: ${({ $bg }) => $bg};
  flex-shrink: 0;
  margin-top: 2px;
`;

const ActivityContent = styled.div`
  flex: 1;
  min-width: 0; /* 텍스트 overflow 처리를 위한 min-width */
`;

const ActivityTop = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const ActivityDesc = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  /* 긴 설명은 말줄임 처리 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 400px;
`;

const ActivityTime = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

const EmptyMsg = styled.p`
  padding: ${({ theme }) => theme.spacing.xxl};
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.md};
`;

/* ── 스켈레톤 로딩 UI ── */

const SkeletonRow = styled.li`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};

  &:last-child {
    border-bottom: none;
  }
`;

const SkeletonBase = styled.div`
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.bgHover} 25%,
    ${({ theme }) => theme.colors.border} 50%,
    ${({ theme }) => theme.colors.bgHover} 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;

  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

const SkeletonIcon = styled(SkeletonBase)`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
`;

const SkeletonContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const SkeletonLine = styled(SkeletonBase)`
  height: 12px;
  width: ${({ $width }) => $width ?? '100%'};
`;
