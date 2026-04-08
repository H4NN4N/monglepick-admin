/**
 * 감사 로그 서브탭 (읽기 전용).
 *
 * 2026-04-08: 설정 → 시스템 탭으로 이동. 조회 전용 성격이 시스템 모니터링(서비스 상태/
 * DB 상태/Ollama/Config)과 동일하여 통합. 설정 탭은 순수 CRUD 전용으로 정리함.
 *
 * 기능:
 * - 관리자 활동 로그 목록 테이블 (actionType, targetType, targetId, description, adminId, IP, 시간)
 * - actionType 검색 필터 + 새로고침 버튼
 * - 페이지네이션 (10건/페이지)
 *
 * 데이터 변경 없이 조회만 가능한 읽기 전용 탭.
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdSearch } from 'react-icons/md';
import { fetchAuditLogs } from '@/features/settings/api/settingsApi';

/** 날짜+시간 포맷 함수 */
function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** actionType 배지 색상 결정 함수 */
function getActionBadgeStatus(actionType) {
  if (!actionType) return 'default';
  const upper = actionType.toUpperCase();
  if (upper.includes('DELETE') || upper.includes('REMOVE')) return 'error';
  if (upper.includes('CREATE') || upper.includes('ADD')) return 'success';
  if (upper.includes('UPDATE') || upper.includes('MODIFY')) return 'warning';
  if (upper.includes('LOGIN') || upper.includes('ACCESS')) return 'info';
  return 'default';
}

/** actionType 배지 색상 맵 (인라인 사용) */
const ACTION_STATUS_COLORS = {
  error: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  success: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  warning: { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  info: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  default: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
};

export default function AuditLogTab() {
  /* ── 목록 상태 ── */
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ── 검색/필터 상태 ── */
  const [searchInput, setSearchInput] = useState(''); // 입력 중인 검색어
  const [actionTypeFilter, setActionTypeFilter] = useState(''); // 실제 적용된 검색어

  /* ── 페이지네이션 상태 ── */
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const PAGE_SIZE = 10;

  /** 감사 로그 목록 조회 */
  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, size: PAGE_SIZE };
      // actionType 필터가 있으면 파라미터에 추가
      if (actionTypeFilter.trim()) {
        params.actionType = actionTypeFilter.trim();
      }
      const result = await fetchAuditLogs(params);
      setLogs(result?.content ?? (Array.isArray(result) ? result : []));
      setTotalPages(result?.totalPages ?? 0);
    } catch (err) {
      setError(err.message ?? '감사 로그 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [page, actionTypeFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  /** 검색 실행 (Enter 키 또는 검색 버튼) */
  function handleSearch(e) {
    e.preventDefault();
    // 필터 변경 시 첫 페이지로 초기화
    setPage(0);
    setActionTypeFilter(searchInput);
  }

  /** 검색 초기화 */
  function handleReset() {
    setSearchInput('');
    setPage(0);
    setActionTypeFilter('');
  }

  return (
    <Container>
      {/* ── 툴바 ── */}
      <Toolbar>
        <ToolbarLeft>
          <SectionTitle>감사 로그</SectionTitle>
        </ToolbarLeft>
        <ToolbarRight>
          {/* actionType 검색 폼 */}
          <SearchForm onSubmit={handleSearch}>
            <SearchInputWrap>
              <MdSearch size={15} />
              <SearchInput
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="액션 유형으로 검색 (예: DELETE)"
              />
            </SearchInputWrap>
            <SearchButton type="submit">검색</SearchButton>
            {/* 검색어가 적용된 경우 초기화 버튼 표시 */}
            {actionTypeFilter && (
              <ResetButton type="button" onClick={handleReset}>
                초기화
              </ResetButton>
            )}
          </SearchForm>
          <IconButton onClick={loadLogs} disabled={loading} title="새로고침">
            <MdRefresh size={16} />
          </IconButton>
        </ToolbarRight>
      </Toolbar>

      {/* 적용된 필터 표시 */}
      {actionTypeFilter && (
        <FilterBadge>
          검색 중: <strong>{actionTypeFilter}</strong>
        </FilterBadge>
      )}

      {/* ── 에러 메시지 ── */}
      {error && <ErrorMsg>{error}</ErrorMsg>}

      {/* ── 목록 테이블 ── */}
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th $w="130px">액션 유형</Th>
              <Th $w="110px">대상 유형</Th>
              <Th $w="110px">대상 ID</Th>
              <Th>설명</Th>
              <Th $w="110px">관리자 ID</Th>
              <Th $w="120px">IP 주소</Th>
              <Th $w="150px">시간</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>
                  <CenterCell>불러오는 중...</CenterCell>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <CenterCell>
                    {actionTypeFilter
                      ? `"${actionTypeFilter}" 검색 결과가 없습니다.`
                      : '감사 로그가 없습니다.'}
                  </CenterCell>
                </td>
              </tr>
            ) : (
              logs.map((log, idx) => {
                // 고유 키: auditId 우선, 없으면 인덱스 fallback
                const key = log.auditId ?? log.id ?? idx;
                const badgeStatus = getActionBadgeStatus(log.actionType);
                const badgeColors = ACTION_STATUS_COLORS[badgeStatus];
                return (
                  <Tr key={key}>
                    <Td>
                      {/* actionType 인라인 배지 */}
                      <ActionBadge
                        $bg={badgeColors.bg}
                        $text={badgeColors.text}
                        $border={badgeColors.border}
                      >
                        {log.actionType ?? '-'}
                      </ActionBadge>
                    </Td>
                    <Td>
                      <MonoText>{log.targetType ?? '-'}</MonoText>
                    </Td>
                    <Td>
                      <MonoText>{log.targetId ?? '-'}</MonoText>
                    </Td>
                    <Td>
                      <DescText title={log.description}>
                        {log.description ?? '-'}
                      </DescText>
                    </Td>
                    <Td>
                      <MonoText>{log.adminId ?? '-'}</MonoText>
                    </Td>
                    <Td>
                      <MonoText>{log.ipAddress ?? log.ip ?? '-'}</MonoText>
                    </Td>
                    <Td>
                      <TimeText>{formatDateTime(log.createdAt)}</TimeText>
                    </Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </TableWrap>

      {/* ── 페이지네이션 ── */}
      {totalPages > 1 && (
        <Pagination>
          <PageButton onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
            이전
          </PageButton>
          <PageInfo>
            {page + 1} / {totalPages}
          </PageInfo>
          <PageButton
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= totalPages}
          >
            다음
          </PageButton>
        </Pagination>
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

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
`;

const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

/* 검색 폼 래퍼 */
const SearchForm = styled.form`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const SearchInputWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  height: 32px;
  background: white;
  color: ${({ theme }) => theme.colors.textMuted};
  &:focus-within {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const SearchInput = styled.input`
  border: none;
  outline: none;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  width: 200px;
  color: ${({ theme }) => theme.colors.textPrimary};
  background: transparent;
  &::placeholder {
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const SearchButton = styled.button`
  padding: 5px 12px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  border-radius: 4px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  &:hover {
    background: ${({ theme }) => theme.colors.primaryHover};
  }
`;

const ResetButton = styled.button`
  padding: 5px 10px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.textSecondary};
  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
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
  transition: background ${({ theme }) => theme.transitions.fast};
  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
  &:disabled {
    opacity: 0.4;
  }
`;

/* 적용된 필터 표시 뱃지 */
const FilterBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  padding: 4px 10px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  border-radius: 20px;
  border: 1px solid ${({ theme }) => theme.colors.primary};
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
  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`;

const Td = styled.td`
  padding: 10px 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  vertical-align: middle;
`;

/* actionType 인라인 배지 */
const ActionBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  background: ${({ $bg }) => $bg};
  color: ${({ $text }) => $text};
  border: 1px solid ${({ $border }) => $border};
  white-space: nowrap;
  letter-spacing: 0.3px;
`;

/* 고정폭 텍스트 (ID, IP 등) */
const MonoText = styled.span`
  font-family: 'Courier New', monospace;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

/* 설명 텍스트 (말줄임) */
const DescText = styled.span`
  display: block;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

/* 시간 텍스트 */
const TimeText = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
`;

const CenterCell = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xxxl};
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
  padding: 5px 14px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.textSecondary};
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.bgHover};
  }
  &:disabled {
    opacity: 0.4;
  }
`;

const PageInfo = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;
