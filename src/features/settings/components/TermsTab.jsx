/**
 * 약관/정책 관리 서브탭.
 * 약관 CRUD + 목록 테이블.
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { fetchTerms, createTerm, updateTerm, deleteTerm } from '../api/settingsApi';

export default function TermsTab() {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  /* 모달 상태 */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', type: 'SERVICE', isRequired: true });

  /** 목록 로드 */
  const loadTerms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTerms();
      setTerms(Array.isArray(data) ? data : data?.content || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTerms(); }, [loadTerms]);

  /** 등록/수정 모달 열기 */
  const openModal = (term = null) => {
    if (term) {
      setEditingTerm(term);
      setForm({ title: term.title, content: term.content, type: term.type, isRequired: term.isRequired });
    } else {
      setEditingTerm(null);
      setForm({ title: '', content: '', type: 'SERVICE', isRequired: true });
    }
    setModalOpen(true);
  };

  /** 저장 */
  const handleSave = async () => {
    try {
      if (editingTerm) {
        await updateTerm(editingTerm.id || editingTerm.termId, form);
      } else {
        await createTerm(form);
      }
      setModalOpen(false);
      loadTerms();
    } catch (err) {
      alert(err.message);
    }
  };

  /** 삭제 */
  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteTerm(id);
      loadTerms();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <Wrapper>
      <Header>
        <h3>약관/정책 관리</h3>
        <AddButton onClick={() => openModal()}>+ 약관 등록</AddButton>
      </Header>

      {loading && <Message>로딩 중...</Message>}
      {error && <Message $error>오류: {error}</Message>}

      <Table>
        <thead>
          <tr>
            <th>제목</th>
            <th>유형</th>
            <th>필수여부</th>
            <th>작성일</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {terms.map((t) => (
            <tr key={t.id || t.termId}>
              <td>{t.title}</td>
              <td>{t.type}</td>
              <td>{t.isRequired ? '필수' : '선택'}</td>
              <td>{t.createdAt?.slice(0, 10)}</td>
              <td>
                <ActionBtn onClick={() => openModal(t)}>수정</ActionBtn>
                <ActionBtn $danger onClick={() => handleDelete(t.id || t.termId)}>삭제</ActionBtn>
              </td>
            </tr>
          ))}
          {!loading && terms.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center' }}>등록된 약관이 없습니다.</td></tr>
          )}
        </tbody>
      </Table>

      {/* 등록/수정 모달 */}
      {modalOpen && (
        <Overlay onClick={() => setModalOpen(false)}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <h4>{editingTerm ? '약관 수정' : '약관 등록'}</h4>
            <Label>제목</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Label>유형</Label>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="SERVICE">서비스 이용약관</option>
              <option value="PRIVACY">개인정보 처리방침</option>
              <option value="MARKETING">마케팅 수신 동의</option>
            </Select>
            <Label>
              <input type="checkbox" checked={form.isRequired} onChange={(e) => setForm({ ...form, isRequired: e.target.checked })} />
              {' '}필수 동의
            </Label>
            <Label>내용</Label>
            <Textarea rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            <ModalActions>
              <ActionBtn onClick={() => setModalOpen(false)}>취소</ActionBtn>
              <ActionBtn $primary onClick={handleSave}>저장</ActionBtn>
            </ModalActions>
          </Modal>
        </Overlay>
      )}
    </Wrapper>
  );
}

/* ── styled-components ── */
const Wrapper = styled.div``;
const Header = styled.div`display:flex;justify-content:space-between;align-items:center;margin-bottom:${({theme})=>theme.spacing.lg};h3{font-size:${({theme})=>theme.fontSizes.lg};}`;
const AddButton = styled.button`padding:${({theme})=>theme.spacing.sm} ${({theme})=>theme.spacing.md};background:${({theme})=>theme.colors.primary};color:#fff;border:none;border-radius:${({theme})=>theme.radii.md};cursor:pointer;font-size:${({theme})=>theme.fontSizes.sm};`;
const Message = styled.p`text-align:center;padding:${({theme})=>theme.spacing.lg};color:${({$error,theme})=>$error?theme.colors.danger:theme.colors.textMuted};`;
const Table = styled.table`width:100%;border-collapse:collapse;th,td{padding:${({theme})=>theme.spacing.sm} ${({theme})=>theme.spacing.md};text-align:left;border-bottom:1px solid ${({theme})=>theme.colors.border};}th{font-weight:${({theme})=>theme.fontWeights.semibold};font-size:${({theme})=>theme.fontSizes.sm};color:${({theme})=>theme.colors.textMuted};}`;
const ActionBtn = styled.button`padding:4px 10px;margin-right:4px;border:1px solid ${({$danger,$primary,theme})=>$danger?theme.colors.danger:$primary?theme.colors.primary:theme.colors.border};background:${({$danger,$primary,theme})=>$danger?theme.colors.danger:$primary?theme.colors.primary:'transparent'};color:${({$danger,$primary})=>$danger||$primary?'#fff':'inherit'};border-radius:${({theme})=>theme.radii.sm};cursor:pointer;font-size:${({theme})=>theme.fontSizes.xs};`;
const Overlay = styled.div`position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;`;
const Modal = styled.div`background:${({theme})=>theme.colors.bgCard};border-radius:${({theme})=>theme.radii.lg};padding:${({theme})=>theme.spacing.xl};width:500px;max-height:80vh;overflow-y:auto;h4{margin-bottom:${({theme})=>theme.spacing.md};}`;
const Label = styled.label`display:block;margin:${({theme})=>theme.spacing.sm} 0 4px;font-size:${({theme})=>theme.fontSizes.sm};font-weight:${({theme})=>theme.fontWeights.semibold};`;
const Input = styled.input`width:100%;padding:${({theme})=>theme.spacing.sm};border:1px solid ${({theme})=>theme.colors.border};border-radius:${({theme})=>theme.radii.sm};font-size:${({theme})=>theme.fontSizes.sm};`;
const Select = styled.select`width:100%;padding:${({theme})=>theme.spacing.sm};border:1px solid ${({theme})=>theme.colors.border};border-radius:${({theme})=>theme.radii.sm};`;
const Textarea = styled.textarea`width:100%;padding:${({theme})=>theme.spacing.sm};border:1px solid ${({theme})=>theme.colors.border};border-radius:${({theme})=>theme.radii.sm};font-size:${({theme})=>theme.fontSizes.sm};resize:vertical;`;
const ModalActions = styled.div`display:flex;justify-content:flex-end;gap:${({theme})=>theme.spacing.sm};margin-top:${({theme})=>theme.spacing.lg};`;
