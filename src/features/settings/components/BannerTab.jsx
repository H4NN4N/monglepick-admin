/**
 * 배너 관리 서브탭.
 * 배너 CRUD + 목록 테이블.
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { fetchBanners, createBanner, updateBanner, deleteBanner } from '../api/settingsApi';

export default function BannerTab() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [form, setForm] = useState({ title: '', imageUrl: '', linkUrl: '', displayOrder: 0, isActive: true });

  const loadBanners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBanners();
      setBanners(Array.isArray(data) ? data : data?.content || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBanners(); }, [loadBanners]);

  const openModal = (banner = null) => {
    if (banner) {
      setEditingBanner(banner);
      setForm({ title: banner.title, imageUrl: banner.imageUrl, linkUrl: banner.linkUrl, displayOrder: banner.displayOrder, isActive: banner.isActive });
    } else {
      setEditingBanner(null);
      setForm({ title: '', imageUrl: '', linkUrl: '', displayOrder: 0, isActive: true });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingBanner) {
        await updateBanner(editingBanner.id || editingBanner.bannerId, form);
      } else {
        await createBanner(form);
      }
      setModalOpen(false);
      loadBanners();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try { await deleteBanner(id); loadBanners(); } catch (err) { alert(err.message); }
  };

  return (
    <Wrapper>
      <Header>
        <h3>배너 관리</h3>
        <AddButton onClick={() => openModal()}>+ 배너 등록</AddButton>
      </Header>
      {loading && <Message>로딩 중...</Message>}
      {error && <Message $error>오류: {error}</Message>}
      <Table>
        <thead><tr><th>제목</th><th>이미지</th><th>순서</th><th>활성</th><th>액션</th></tr></thead>
        <tbody>
          {banners.map((b) => (
            <tr key={b.id || b.bannerId}>
              <td>{b.title}</td>
              <td>{b.imageUrl ? <Thumb src={b.imageUrl} alt="" /> : '-'}</td>
              <td>{b.displayOrder}</td>
              <td>{b.isActive ? '활성' : '비활성'}</td>
              <td>
                <ActionBtn onClick={() => openModal(b)}>수정</ActionBtn>
                <ActionBtn $danger onClick={() => handleDelete(b.id || b.bannerId)}>삭제</ActionBtn>
              </td>
            </tr>
          ))}
          {!loading && banners.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center' }}>등록된 배너가 없습니다.</td></tr>}
        </tbody>
      </Table>

      {modalOpen && (
        <Overlay onClick={() => setModalOpen(false)}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <h4>{editingBanner ? '배너 수정' : '배너 등록'}</h4>
            <Label>제목</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Label>이미지 URL</Label>
            <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
            <Label>링크 URL</Label>
            <Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="https://..." />
            <Label>표시 순서</Label>
            <Input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
            <Label><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> 활성</Label>
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

const Wrapper = styled.div``;
const Header = styled.div`display:flex;justify-content:space-between;align-items:center;margin-bottom:${({theme})=>theme.spacing.lg};h3{font-size:${({theme})=>theme.fontSizes.lg};}`;
const AddButton = styled.button`padding:${({theme})=>theme.spacing.sm} ${({theme})=>theme.spacing.md};background:${({theme})=>theme.colors.primary};color:#fff;border:none;border-radius:${({theme})=>theme.radii.md};cursor:pointer;font-size:${({theme})=>theme.fontSizes.sm};`;
const Message = styled.p`text-align:center;padding:${({theme})=>theme.spacing.lg};color:${({$error,theme})=>$error?theme.colors.danger:theme.colors.textMuted};`;
const Table = styled.table`width:100%;border-collapse:collapse;th,td{padding:${({theme})=>theme.spacing.sm} ${({theme})=>theme.spacing.md};text-align:left;border-bottom:1px solid ${({theme})=>theme.colors.border};}th{font-weight:${({theme})=>theme.fontWeights.semibold};font-size:${({theme})=>theme.fontSizes.sm};color:${({theme})=>theme.colors.textMuted};}`;
const Thumb = styled.img`width:60px;height:30px;object-fit:cover;border-radius:4px;`;
const ActionBtn = styled.button`padding:4px 10px;margin-right:4px;border:1px solid ${({$danger,$primary,theme})=>$danger?theme.colors.danger:$primary?theme.colors.primary:theme.colors.border};background:${({$danger,$primary,theme})=>$danger?theme.colors.danger:$primary?theme.colors.primary:'transparent'};color:${({$danger,$primary})=>$danger||$primary?'#fff':'inherit'};border-radius:${({theme})=>theme.radii.sm};cursor:pointer;font-size:${({theme})=>theme.fontSizes.xs};`;
const Overlay = styled.div`position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;`;
const Modal = styled.div`background:${({theme})=>theme.colors.bgCard};border-radius:${({theme})=>theme.radii.lg};padding:${({theme})=>theme.spacing.xl};width:500px;h4{margin-bottom:${({theme})=>theme.spacing.md};}`;
const Label = styled.label`display:block;margin:${({theme})=>theme.spacing.sm} 0 4px;font-size:${({theme})=>theme.fontSizes.sm};font-weight:${({theme})=>theme.fontWeights.semibold};`;
const Input = styled.input`width:100%;padding:${({theme})=>theme.spacing.sm};border:1px solid ${({theme})=>theme.colors.border};border-radius:${({theme})=>theme.radii.sm};font-size:${({theme})=>theme.fontSizes.sm};`;
const ModalActions = styled.div`display:flex;justify-content:flex-end;gap:${({theme})=>theme.spacing.sm};margin-top:${({theme})=>theme.spacing.lg};`;
