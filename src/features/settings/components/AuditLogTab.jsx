import { useCallback, useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { MdClose, MdRefresh, MdSearch } from 'react-icons/md';
import { fetchAuditLogs } from '../api/settingsApi';

const PAGE_SIZE = 20;

const ACTION_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'ADMIN_LOGIN', label: '관리자로그인' },
  { value: 'USER_SUSPEND', label: '사용자정지' },
  { value: 'USER_UNSUSPEND', label: '정지해제' },
  { value: 'USER_ROLE_UPDATE', label: '역할변경' },
  { value: 'POINT_MANUAL', label: '포인트지급' },
  { value: 'PAYMENT_REFUND', label: '환불' },
  { value: 'SUPPORT_FAQ_CREATE', label: 'FAQ등록' },
  { value: 'SUPPORT_FAQ_UPDATE', label: 'FAQ수정' },
  { value: 'SUPPORT_FAQ_DELETE', label: 'FAQ삭제' },
];

const ACTION_BADGE_COLORS = {
  ADMIN_LOGIN: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  USER_SUSPEND: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  USER_UNSUSPEND: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  USER_ROLE_UPDATE: { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  POINT_MANUAL: { bg: '#fefce8', text: '#a16207', border: '#fde68a' },
  PAYMENT_REFUND: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
  SUPPORT_FAQ_CREATE: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
  SUPPORT_FAQ_UPDATE: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
  SUPPORT_FAQ_DELETE: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
  default: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
};

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function toIsoSecond(value, endOfDay = false) {
  if (!value) return undefined;
  return `${value}T${endOfDay ? '23:59:59' : '00:00:00'}`;
}

function formatJson(raw) {
  if (raw == null || raw === '') return '없음';
  if (typeof raw === 'object') return JSON.stringify(raw, null, 2);
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return String(raw);
  }
}

export default function AuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailLog, setDetailLog] = useState(null);
  const [filters, setFilters] = useState({ actionType: '', fromDate: '', toDate: '' });
  const [appliedFilters, setAppliedFilters] = useState({ actionType: '', fromDate: '', toDate: '' });

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, size: PAGE_SIZE };
      if (appliedFilters.actionType) params.actionType = appliedFilters.actionType;
      if (appliedFilters.fromDate) params.fromDate = toIsoSecond(appliedFilters.fromDate);
      if (appliedFilters.toDate) params.toDate = toIsoSecond(appliedFilters.toDate, true);

      const data = await fetchAuditLogs(params);
      setLogs(data?.content ?? []);
      setTotalPages(data?.totalPages ?? 0);
      setTotalElements(data?.totalElements ?? 0);
    } catch (err) {
      setError(err.message ?? '감사 로그 조회에 실패했습니다.');
      setLogs([]);
      setTotalPages(0);
      setTotalElements(0);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  function handleFilterChange(name, value) {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function handleSearch(e) {
    e.preventDefault();
    setAppliedFilters(filters);
    setPage(0);
  }

  function handleReset() {
    const emptyFilters = { actionType: '', fromDate: '', toDate: '' };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(0);
  }

  return (
    <Container>
      <Toolbar>
        <TitleGroup>
          <SectionTitle>감사 로그</SectionTitle>
          <TotalText>총 {totalElements.toLocaleString()}건</TotalText>
        </TitleGroup>
        <IconButton type="button" onClick={loadLogs} disabled={loading} title="새로고침">
          <MdRefresh size={16} />
        </IconButton>
      </Toolbar>

      <FilterForm onSubmit={handleSearch}>
        <Field>
          <FieldLabel>행위 유형</FieldLabel>
          <Select value={filters.actionType} onChange={(e) => handleFilterChange('actionType', e.target.value)}>
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}{option.value ? ` (${option.value})` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel>시작일</FieldLabel>
          <DateInput type="date" value={filters.fromDate} max={filters.toDate || undefined} onChange={(e) => handleFilterChange('fromDate', e.target.value)} />
        </Field>
        <DateSeparator>~</DateSeparator>
        <Field>
          <FieldLabel>종료일</FieldLabel>
          <DateInput type="date" value={filters.toDate} min={filters.fromDate || undefined} onChange={(e) => handleFilterChange('toDate', e.target.value)} />
        </Field>
        <ButtonRow>
          <PrimaryButton type="submit"><MdSearch size={15} />조회</PrimaryButton>
          <SecondaryButton type="button" onClick={handleReset}>초기화</SecondaryButton>
        </ButtonRow>
      </FilterForm>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      <TableWrap>
        {loading && <LoadingOverlay><Spinner /></LoadingOverlay>}
        <Table>
          <thead>
            <tr>
              <Th $w="160px">일시</Th>
              <Th $w="170px">행위 유형</Th>
              <Th $w="180px">대상</Th>
              <Th>설명</Th>
              <Th $w="130px">IP 주소</Th>
              <Th $w="90px">변경 내역</Th>
            </tr>
          </thead>
          <tbody>
            {!loading && logs.length === 0 ? (
              <tr><td colSpan={6}><CenterCell>감사 로그가 없습니다</CenterCell></td></tr>
            ) : (
              logs.map((log) => {
                const colors = ACTION_BADGE_COLORS[log.actionType] ?? ACTION_BADGE_COLORS.default;
                const hasDetail = log.beforeData != null || log.afterData != null;
                return (
                  <tr key={log.id}>
                    <Td><TimeText>{formatDateTime(log.createdAt)}</TimeText></Td>
                    <Td><ActionBadge $colors={colors}>{log.actionType ?? '-'}</ActionBadge></Td>
                    <Td><MonoText>{log.targetType ?? '-'} / {log.targetId ?? '-'}</MonoText></Td>
                    <Td><Description title={log.description ?? '-'}>{log.description ?? '-'}</Description></Td>
                    <Td><MonoText>{log.ipAddress ?? '-'}</MonoText></Td>
                    <Td>
                      {hasDetail ? <DetailButton type="button" onClick={() => setDetailLog(log)}>상세</DetailButton> : <MutedText>-</MutedText>}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </TableWrap>

      {totalPages > 1 && (
        <Pagination>
          <PageButton type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>이전</PageButton>
          <PageInfo>{page + 1} / {totalPages}</PageInfo>
          <PageButton type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>다음</PageButton>
        </Pagination>
      )}

      {detailLog && <DetailModal log={detailLog} onClose={() => setDetailLog(null)} />}
    </Container>
  );
}

function DetailModal({ log, onClose }) {
  return (
    <Overlay onClick={onClose}>
      <ModalBox onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>변경 내역 상세</ModalTitle>
          <CloseButton type="button" onClick={onClose} aria-label="닫기"><MdClose size={20} /></CloseButton>
        </ModalHeader>
        <JsonGrid>
          <JsonColumn><JsonTitle>변경 전</JsonTitle><JsonBox>{formatJson(log.beforeData)}</JsonBox></JsonColumn>
          <JsonColumn><JsonTitle>변경 후</JsonTitle><JsonBox>{formatJson(log.afterData)}</JsonBox></JsonColumn>
        </JsonGrid>
      </ModalBox>
    </Overlay>
  );
}

const Container = styled.div``;
const Toolbar = styled.div`display:flex;align-items:center;justify-content:space-between;gap:${({ theme }) => theme.spacing.md};margin-bottom:${({ theme }) => theme.spacing.md};`;
const TitleGroup = styled.div`display:flex;align-items:baseline;gap:${({ theme }) => theme.spacing.sm};`;
const SectionTitle = styled.h3`font-size:${({ theme }) => theme.fontSizes.lg};font-weight:${({ theme }) => theme.fontWeights.semibold};color:${({ theme }) => theme.colors.textPrimary};`;
const TotalText = styled.span`font-size:${({ theme }) => theme.fontSizes.xs};color:${({ theme }) => theme.colors.textMuted};`;
const IconButton = styled.button`display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid ${({ theme }) => theme.colors.border};border-radius:4px;color:${({ theme }) => theme.colors.textSecondary};&:hover:not(:disabled){background:${({ theme }) => theme.colors.bgHover};}&:disabled{opacity:.4;}`;
const FilterForm = styled.form`display:flex;align-items:flex-end;flex-wrap:wrap;gap:${({ theme }) => theme.spacing.sm};padding:${({ theme }) => theme.spacing.md};margin-bottom:${({ theme }) => theme.spacing.md};background:${({ theme }) => theme.colors.bgHover};border:1px solid ${({ theme }) => theme.colors.borderLight};border-radius:${({ theme }) => theme.layout.cardRadius};`;
const Field = styled.label`display:flex;flex-direction:column;gap:4px;`;
const FieldLabel = styled.span`font-size:${({ theme }) => theme.fontSizes.xs};color:${({ theme }) => theme.colors.textMuted};`;
const Select = styled.select`height:34px;min-width:250px;padding:0 10px;border:1px solid ${({ theme }) => theme.colors.border};border-radius:4px;background:#fff;color:${({ theme }) => theme.colors.textPrimary};font-size:${({ theme }) => theme.fontSizes.sm};&:focus{outline:none;border-color:${({ theme }) => theme.colors.primary};}`;
const DateInput = styled.input`height:34px;padding:0 10px;border:1px solid ${({ theme }) => theme.colors.border};border-radius:4px;background:#fff;color:${({ theme }) => theme.colors.textPrimary};font-size:${({ theme }) => theme.fontSizes.sm};font-family:${({ theme }) => theme.fonts.base};&:focus{outline:none;border-color:${({ theme }) => theme.colors.primary};}`;
const DateSeparator = styled.span`height:34px;display:inline-flex;align-items:center;color:${({ theme }) => theme.colors.textMuted};`;
const ButtonRow = styled.div`display:flex;gap:${({ theme }) => theme.spacing.sm};`;
const PrimaryButton = styled.button`display:inline-flex;align-items:center;gap:4px;height:34px;padding:0 13px;border-radius:4px;background:${({ theme }) => theme.colors.primary};color:#fff;font-size:${({ theme }) => theme.fontSizes.sm};font-weight:${({ theme }) => theme.fontWeights.medium};&:hover{background:${({ theme }) => theme.colors.primaryHover};}`;
const SecondaryButton = styled.button`height:34px;padding:0 12px;border:1px solid ${({ theme }) => theme.colors.border};border-radius:4px;color:${({ theme }) => theme.colors.textSecondary};font-size:${({ theme }) => theme.fontSizes.sm};&:hover{background:${({ theme }) => theme.colors.bgCard};}`;
const ErrorMsg = styled.p`margin-bottom:${({ theme }) => theme.spacing.md};padding:${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};border-radius:4px;background:${({ theme }) => theme.colors.errorBg};color:${({ theme }) => theme.colors.error};font-size:${({ theme }) => theme.fontSizes.sm};`;
const TableWrap = styled.div`position:relative;overflow-x:auto;min-height:180px;border:1px solid ${({ theme }) => theme.colors.border};border-radius:${({ theme }) => theme.layout.cardRadius};`;
const Table = styled.table`width:100%;min-width:940px;border-collapse:collapse;font-size:${({ theme }) => theme.fontSizes.sm};`;
const Th = styled.th`width:${({ $w }) => $w ?? 'auto'};padding:10px 12px;background:${({ theme }) => theme.colors.bgHover};border-bottom:1px solid ${({ theme }) => theme.colors.border};color:${({ theme }) => theme.colors.textSecondary};font-size:${({ theme }) => theme.fontSizes.xs};font-weight:${({ theme }) => theme.fontWeights.semibold};text-align:left;white-space:nowrap;`;
const Td = styled.td`padding:10px 12px;border-bottom:1px solid ${({ theme }) => theme.colors.borderLight};color:${({ theme }) => theme.colors.textPrimary};vertical-align:middle;`;
const TimeText = styled.span`color:${({ theme }) => theme.colors.textMuted};font-size:${({ theme }) => theme.fontSizes.xs};white-space:nowrap;`;
const ActionBadge = styled.span`display:inline-flex;align-items:center;max-width:150px;padding:2px 8px;border:1px solid ${({ $colors }) => $colors.border};border-radius:4px;background:${({ $colors }) => $colors.bg};color:${({ $colors }) => $colors.text};font-size:11px;font-weight:600;white-space:nowrap;`;
const MonoText = styled.span`font-family:${({ theme }) => theme.fonts.mono};font-size:${({ theme }) => theme.fontSizes.xs};color:${({ theme }) => theme.colors.textSecondary};word-break:break-all;`;
const Description = styled.span`display:block;max-width:560px;color:${({ theme }) => theme.colors.textSecondary};font-size:${({ theme }) => theme.fontSizes.xs};line-height:1.5;overflow-wrap:anywhere;white-space:normal;`;
const DetailButton = styled.button`height:28px;padding:0 10px;border:1px solid ${({ theme }) => theme.colors.border};border-radius:4px;color:${({ theme }) => theme.colors.textSecondary};font-size:${({ theme }) => theme.fontSizes.xs};&:hover{background:${({ theme }) => theme.colors.bgHover};color:${({ theme }) => theme.colors.textPrimary};}`;
const MutedText = styled.span`color:${({ theme }) => theme.colors.textMuted};`;
const CenterCell = styled.div`padding:${({ theme }) => theme.spacing.xxxl};color:${({ theme }) => theme.colors.textMuted};font-size:${({ theme }) => theme.fontSizes.sm};text-align:center;`;
const spin = keyframes`to{transform:rotate(360deg);}`;
const LoadingOverlay = styled.div`position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.72);`;
const Spinner = styled.div`width:30px;height:30px;border:3px solid ${({ theme }) => theme.colors.borderLight};border-top-color:${({ theme }) => theme.colors.primary};border-radius:50%;animation:${spin} .8s linear infinite;`;
const Pagination = styled.div`display:flex;align-items:center;justify-content:center;gap:${({ theme }) => theme.spacing.md};margin-top:${({ theme }) => theme.spacing.lg};`;
const PageButton = styled.button`padding:5px 14px;border:1px solid ${({ theme }) => theme.colors.border};border-radius:4px;color:${({ theme }) => theme.colors.textSecondary};font-size:${({ theme }) => theme.fontSizes.sm};&:hover:not(:disabled){background:${({ theme }) => theme.colors.bgHover};}&:disabled{opacity:.4;}`;
const PageInfo = styled.span`color:${({ theme }) => theme.colors.textMuted};font-size:${({ theme }) => theme.fontSizes.sm};`;
const Overlay = styled.div`position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:${({ theme }) => theme.spacing.lg};background:rgba(0,0,0,.5);`;
const ModalBox = styled.div`width:min(960px,100%);max-height:90vh;overflow-y:auto;padding:${({ theme }) => theme.spacing.xxl};border-radius:${({ theme }) => theme.layout.cardRadius};background:${({ theme }) => theme.colors.bgCard};box-shadow:${({ theme }) => theme.shadows.lg};`;
const ModalHeader = styled.div`display:flex;align-items:center;justify-content:space-between;margin-bottom:${({ theme }) => theme.spacing.lg};`;
const ModalTitle = styled.h3`color:${({ theme }) => theme.colors.textPrimary};font-size:${({ theme }) => theme.fontSizes.heading};font-weight:${({ theme }) => theme.fontWeights.semibold};`;
const CloseButton = styled.button`display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:4px;color:${({ theme }) => theme.colors.textSecondary};&:hover{background:${({ theme }) => theme.colors.bgHover};}`;
const JsonGrid = styled.div`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${({ theme }) => theme.spacing.md};@media(max-width:760px){grid-template-columns:1fr;}`;
const JsonColumn = styled.div`min-width:0;`;
const JsonTitle = styled.div`margin-bottom:${({ theme }) => theme.spacing.xs};color:${({ theme }) => theme.colors.textSecondary};font-size:${({ theme }) => theme.fontSizes.sm};font-weight:${({ theme }) => theme.fontWeights.semibold};`;
const JsonBox = styled.pre`min-height:240px;max-height:520px;overflow:auto;padding:${({ theme }) => theme.spacing.md};border-radius:6px;background:#0f172a;color:#e2e8f0;font-family:${({ theme }) => theme.fonts.mono};font-size:${({ theme }) => theme.fontSizes.xs};line-height:1.6;white-space:pre-wrap;word-break:break-all;`;
