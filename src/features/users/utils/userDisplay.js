export const WITHDRAWN_ACCOUNT_LABEL = '탈퇴한 계정';

export function isWithdrawnUser(user) {
  return Boolean(user?.isDeleted || user?.deleted || user?.deletedAt);
}

export function getDisplayEmail(user) {
  if (isWithdrawnUser(user)) return user?.email ?? WITHDRAWN_ACCOUNT_LABEL;
  return user?.email ?? '-';
}

export function getUserDisplayName(user) {
  if (!user) return '-';
  if (isWithdrawnUser(user)) return `${WITHDRAWN_ACCOUNT_LABEL} (${user.userId ?? '-'})`;
  return user.nickname ?? user.email ?? user.userId ?? '-';
}

export function formatHistorySummary(user) {
  const parts = [
    ['게시글', user?.postCount],
    ['리뷰', user?.reviewCount],
    ['댓글', user?.commentCount],
    ['결제', user?.paymentCount ?? user?.orderCount],
    ['문의', user?.ticketCount ?? user?.inquiryCount],
  ];

  return parts
    .map(([label, value]) => `${label} ${Number(value ?? 0).toLocaleString()}건`)
    .join(' · ');
}
