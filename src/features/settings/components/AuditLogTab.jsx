/**
 * 감사 로그 서브탭.
 * 관리자 활동 로그 조회 (읽기 전용).
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { fetchAuditLogs } from '../api/settingsApi';

export default function AuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAuditLogs({ page, size: 20 });
      setLogs(Array.isArray(data) ? data : data?.content || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  return (
    <Wrapper>
      <h3>감사 로그</h3>
      {loading && <Message>로딩 중...</Message>}
      {error && <Message $error>오류: {error}</Message>}
      <Table>
        <thead><tr><th>관리자</th><th>액션</th><th>대상 유형</th><th>대상 ID</th><th>IP</th><th>일시</th></tr></thead>
        <tbody>
          {logs.map((l, i) => (
            <tr key={l.auditId || i}>
              <td>{l.adminId}</td>
              <td>{l.actionType}</td>
              <td>{l.targetType}</td>
              <td>{l.targetId}</td>
              <td>{l.ipAddress || '-'}</td>
              <td>{l.createdAt?.slice(0, 19).replace('T', ' ')}</td>
            </tr>
          ))}
          {!loading && logs.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center' }}>로그가 없습니다.</td></tr>}
        </tbody>
      </Table>
      <Paging>
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button>
        <span>{page + 1} 페이지</span>
        <button onClick={() => setPage(page + 1)}>다음</button>
      </Paging>
    </Wrapper>
  );
}

const Wrapper = styled.div`h3{font-size:${({theme})=>theme.fontSizes.lg};margin-bottom:${({theme})=>theme.spacing.lg};}`;
const Message = styled.p`text-align:center;padding:${({theme})=>theme.spacing.lg};color:${({$error,theme})=>$error?theme.colors.danger:theme.colors.textMuted};`;
const Table = styled.table`width:100%;border-collapse:collapse;th,td{padding:${({theme})=>theme.spacing.sm} ${({theme})=>theme.spacing.md};text-align:left;border-bottom:1px solid ${({theme})=>theme.colors.border};}th{font-weight:${({theme})=>theme.fontWeights.semibold};font-size:${({theme})=>theme.fontSizes.sm};color:${({theme})=>theme.colors.textMuted};}td{font-size:${({theme})=>theme.fontSizes.sm};}`;
const Paging = styled.div`display:flex;align-items:center;justify-content:center;gap:${({theme})=>theme.spacing.md};margin-top:${({theme})=>theme.spacing.lg};button{padding:4px 12px;border:1px solid ${({theme})=>theme.colors.border};border-radius:${({theme})=>theme.radii.sm};background:transparent;cursor:pointer;&:disabled{opacity:0.4;cursor:default;}}span{font-size:${({theme})=>theme.fontSizes.sm};}`;
