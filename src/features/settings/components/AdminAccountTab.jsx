/**
 * 관리자 계정 관리 서브탭.
 * 관리자 목록 조회 + 역할 변경.
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { fetchAdmins, updateAdminRole } from '../api/settingsApi';

export default function AdminAccountTab() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdmins();
      setAdmins(Array.isArray(data) ? data : data?.content || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  /** 역할 변경 */
  const handleRoleChange = async (id, newRole) => {
    if (!window.confirm(`역할을 ${newRole}(으)로 변경하시겠습니까?`)) return;
    try {
      await updateAdminRole(id, { role: newRole });
      loadAdmins();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <Wrapper>
      <h3>관리자 계정</h3>
      {loading && <Message>로딩 중...</Message>}
      {error && <Message $error>오류: {error}</Message>}
      <Table>
        <thead><tr><th>ID</th><th>이메일</th><th>닉네임</th><th>역할</th><th>마지막 로그인</th><th>액션</th></tr></thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.adminId || a.id}>
              <td>{a.adminId || a.id}</td>
              <td>{a.email}</td>
              <td>{a.nickname || '-'}</td>
              <td>{a.role || a.adminRole}</td>
              <td>{a.lastLoginAt?.slice(0, 19).replace('T', ' ') || '-'}</td>
              <td>
                <RoleSelect
                  value={a.role || a.adminRole || 'ADMIN'}
                  onChange={(e) => handleRoleChange(a.adminId || a.id, e.target.value)}
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </RoleSelect>
              </td>
            </tr>
          ))}
          {!loading && admins.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center' }}>관리자가 없습니다.</td></tr>}
        </tbody>
      </Table>
    </Wrapper>
  );
}

const Wrapper = styled.div`h3{font-size:${({theme})=>theme.fontSizes.lg};margin-bottom:${({theme})=>theme.spacing.lg};}`;
const Message = styled.p`text-align:center;padding:${({theme})=>theme.spacing.lg};color:${({$error,theme})=>$error?theme.colors.danger:theme.colors.textMuted};`;
const Table = styled.table`width:100%;border-collapse:collapse;th,td{padding:${({theme})=>theme.spacing.sm} ${({theme})=>theme.spacing.md};text-align:left;border-bottom:1px solid ${({theme})=>theme.colors.border};}th{font-weight:${({theme})=>theme.fontWeights.semibold};font-size:${({theme})=>theme.fontSizes.sm};color:${({theme})=>theme.colors.textMuted};}`;
const RoleSelect = styled.select`padding:4px 8px;border:1px solid ${({theme})=>theme.colors.border};border-radius:${({theme})=>theme.radii.sm};font-size:${({theme})=>theme.fontSizes.sm};`;
