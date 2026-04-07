/**
 * 리뷰 관리 탭 컴포넌트.
 *
 * 기능:
 * - 리뷰 목록 테이블 (영화ID, 작성자ID, 평점, 내용 미리보기, 카테고리, 스포일러, 블라인드, 좋아요, 작성일, 액션)
 * - 상단: movieId 검색 input + minRating select + categoryCode select + 새로고침
 * - 카테고리 필터로 도장깨기 인증 리뷰 모니터링 가능 (categoryCode='COURSE')
 * - 삭제 확인 다이얼로그 + 페이지네이션
 */

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdDelete, MdSearch, MdStar } from 'react-icons/md';
import { fetchReviews, deleteReview } from '../api/contentApi';
import StatusBadge from '@/shared/components/StatusBadge';

/** 최소 평점 필터 옵션 */
const MIN_RATING_OPTIONS = [
  { value: '', label: '전체 평점' },
  { value: '1', label: '1점 이상' },
  { value: '2', label: '2점 이상' },
  { value: '3', label: '3점 이상' },
  { value: '4', label: '4점 이상' },
  { value: '5', label: '5점' },
];

/**
 * 리뷰 작성 카테고리 enum 옵션 (Backend ReviewCategoryCode 매칭).
 *
 * 백엔드 enum: THEATER_RECEIPT / COURSE / WORLDCUP / WISHLIST / AI_RECOMMEND / PLAYLIST
 * 도장깨기 인증 리뷰 모니터링: 'COURSE' 선택 시 도장깨기 단계 인증 리뷰만 조회.
 */
const CATEGORY_OPTIONS = [
  { value: '', label: '전체 카테고리' },
  { value: 'COURSE', label: '도장깨기 인증' },
  { value: 'THEATER_RECEIPT', label: '극장 영수증 인증' },
  { value: 'WORLDCUP', label: '월드컵' },
  { value: 'WISHLIST', label: '위시리스트' },
  { value: 'AI_RECOMMEND', label: 'AI 추천' },
  { value: 'PLAYLIST', label: '플레이리스트' },
];

/** 카테고리 코드 → 한글 라벨 매핑 (테이블 셀 표시용) */
const CATEGORY_LABEL_MAP = CATEGORY_OPTIONS
  .filter((o) => o.value)
  .reduce((acc, o) => ({ ...acc, [o.value]: o.label }), {});

/** 페이지당 항목 수 */
const PAGE_SIZE = 10;

/**
 * 날짜 문자열을 YYYY.MM.DD HH:MM 형식으로 포맷.
 * @param {string} dateStr - ISO 날짜 문자열
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 정수 rating 값을 별(★) 문자열로 변환.
 * @param {number} rating - 1~5
 * @returns {string} 예: "★★★☆☆"
 */
function ratingToStars(rating) {
  const n = Math.round(rating ?? 0);
  return '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - Math.min(5, n)));
}

export default function ReviewTab() {
  /* ── 목록 상태 ── */
  const [reviews, setReviews] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ── 필터/페이지 상태 ── */
  const [movieIdInput, setMovieIdInput] = useState(''); // 입력 버퍼
  const [movieId, setMovieId] = useState('');           // 확정된 검색값
  const [minRating, setMinRating] = useState('');
  const [categoryCode, setCategoryCode] = useState(''); // 작성 카테고리 enum 이름 필터
  const [page, setPage] = useState(0);

  /* ── 삭제 확인 다이얼로그 상태 ── */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /** 리뷰 목록 조회 */
  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, size: PAGE_SIZE };
      if (movieId) params.movieId = movieId;
      if (minRating) params.minRating = minRating;
      if (categoryCode) params.categoryCode = categoryCode;
      const result = await fetchReviews(params);
      setReviews(result?.content ?? []);
      setTotalPages(result?.totalPages ?? 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, movieId, minRating, categoryCode]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  /** movieId 검색 확정 (엔터 또는 버튼 클릭) */
  function handleSearch() {
    setMovieId(movieIdInput.trim());
    setPage(0);
  }

  /** 검색 input 엔터 처리 */
  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSearch();
  }

  /** minRating 필터 변경 시 첫 페이지로 초기화 */
  function handleMinRatingChange(e) {
    setMinRating(e.target.value);
    setPage(0);
  }

  /** 카테고리 필터 변경 시 첫 페이지로 초기화 */
  function handleCategoryChange(e) {
    setCategoryCode(e.target.value);
    setPage(0);
  }

  /** 삭제 다이얼로그 열기 */
  function openDeleteDialog(review) {
    setDeleteTarget(review);
  }

  /** 삭제 다이얼로그 닫기 */
  function closeDeleteDialog() {
    setDeleteTarget(null);
  }

  /** 리뷰 삭제 실행 */
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await deleteReview(deleteTarget.id);
      closeDeleteDialog();
      loadReviews();
    } catch (err) {
      alert(err.message || '삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <Container>
      {/* ── 툴바: 영화 ID 검색 + 최소 평점 + 새로고침 ── */}
      <Toolbar>
        <ToolbarLeft>
          {/* 영화 ID 검색 */}
          <SearchWrap>
            <SearchInput
              type="text"
              placeholder="영화 ID 검색..."
              value={movieIdInput}
              onChange={(e) => setMovieIdInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <SearchButton onClick={handleSearch}>
              <MdSearch size={16} />
            </SearchButton>
          </SearchWrap>
          {/* 최소 평점 select */}
          <FilterSelect value={minRating} onChange={handleMinRatingChange}>
            {MIN_RATING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </FilterSelect>
          {/* 작성 카테고리 select — 'COURSE' 선택 시 도장깨기 인증 리뷰 모니터링 */}
          <FilterSelect
            value={categoryCode}
            onChange={handleCategoryChange}
            title="작성 카테고리 필터"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </FilterSelect>
        </ToolbarLeft>
        <ToolbarRight>
          <IconButton onClick={loadReviews} disabled={loading} title="새로고침">
            <MdRefresh size={16} />
          </IconButton>
        </ToolbarRight>
      </Toolbar>

      {/* ── 에러 메시지 ── */}
      {error && <ErrorMsg>{error}</ErrorMsg>}

      {/* ── 리뷰 목록 테이블 ── */}
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th $w="120px">영화 ID</Th>
              <Th $w="110px">작성자 ID</Th>
              <Th $w="90px">평점</Th>
              <Th>내용 미리보기</Th>
              <Th $w="100px">카테고리</Th>
              <Th $w="70px">스포일러</Th>
              <Th $w="80px">블라인드</Th>
              <Th $w="70px">좋아요</Th>
              <Th $w="140px">작성일</Th>
              <Th $w="70px">액션</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10}>
                  <CenterCell>불러오는 중...</CenterCell>
                </td>
              </tr>
            ) : reviews.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <CenterCell>리뷰가 없습니다.</CenterCell>
                </td>
              </tr>
            ) : (
              reviews.map((review) => (
                <Tr key={review.id}>
                  {/* 영화 ID */}
                  <Td>
                    <MutedText>{review.movieId ?? '-'}</MutedText>
                  </Td>
                  {/* 작성자 ID */}
                  <Td>
                    <MutedText>{review.userId ?? '-'}</MutedText>
                  </Td>
                  {/* 평점: 별 표시 + 숫자 */}
                  <Td>
                    <RatingWrap>
                      <StarText>{ratingToStars(review.rating)}</StarText>
                      <RatingNum>{review.rating ?? '-'}</RatingNum>
                    </RatingWrap>
                  </Td>
                  {/* 내용 미리보기 (100자 truncate) */}
                  <Td>
                    <PreviewText>
                      {review.content ? review.content.slice(0, 100) : '-'}
                    </PreviewText>
                  </Td>
                  {/* 작성 카테고리 (도장깨기 인증 모니터링용) */}
                  <Td>
                    {review.reviewCategoryCode ? (
                      <CategoryBadge $highlight={review.reviewCategoryCode === 'COURSE'}>
                        {CATEGORY_LABEL_MAP[review.reviewCategoryCode] ?? review.reviewCategoryCode}
                      </CategoryBadge>
                    ) : (
                      <MutedText>-</MutedText>
                    )}
                  </Td>
                  {/* 스포일러 여부 */}
                  <Td>
                    <StatusBadge
                      status={review.spoiler ? 'warning' : 'default'}
                      label={review.spoiler ? '스포일러' : '-'}
                    />
                  </Td>
                  {/* 블라인드 여부 */}
                  <Td>
                    <StatusBadge
                      status={review.isBlinded ? 'error' : 'default'}
                      label={review.isBlinded ? '블라인드' : '정상'}
                    />
                  </Td>
                  {/* 좋아요 수 */}
                  <Td>
                    <MutedText>{(review.likeCount ?? 0).toLocaleString()}</MutedText>
                  </Td>
                  {/* 작성일 */}
                  <Td>
                    <MutedText>{formatDate(review.createdAt)}</MutedText>
                  </Td>
                  {/* 삭제 버튼 */}
                  <Td>
                    <DangerButton onClick={() => openDeleteDialog(review)}>
                      <MdDelete size={13} /> 삭제
                    </DangerButton>
                  </Td>
                </Tr>
              ))
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
          <PageInfo>{page + 1} / {totalPages}</PageInfo>
          <PageButton onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages}>
            다음
          </PageButton>
        </Pagination>
      )}

      {/* ── 삭제 확인 다이얼로그 ── */}
      {deleteTarget && (
        <Overlay onClick={closeDeleteDialog}>
          <DialogBox onClick={(e) => e.stopPropagation()}>
            <DialogTitle>리뷰 삭제</DialogTitle>
            <DialogDesc>
              <strong>영화 ID: {deleteTarget.movieId}</strong> 의 리뷰를 삭제합니다.
              <br />
              <ContentSnippet>
                "{deleteTarget.content ? deleteTarget.content.slice(0, 60) : '(내용 없음)'}"
              </ContentSnippet>
              <br />이 작업은 되돌릴 수 없습니다.
            </DialogDesc>
            <DialogFooter>
              <CancelButton onClick={closeDeleteDialog}>취소</CancelButton>
              <DeleteConfirmButton onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? '삭제 중...' : '삭제'}
              </DeleteConfirmButton>
            </DialogFooter>
          </DialogBox>
        </Overlay>
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
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const SearchWrap = styled.div`
  display: flex;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  overflow: hidden;
`;

const SearchInput = styled.input`
  padding: 6px 10px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: none;
  outline: none;
  width: 180px;
`;

const SearchButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  background: ${({ theme }) => theme.colors.bgHover};
  border-left: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: background ${({ theme }) => theme.transitions.fast};
  &:hover { background: ${({ theme }) => theme.colors.border}; }
`;

const FilterSelect = styled.select`
  padding: 6px 10px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  outline: none;
  background: white;
  &:focus { border-color: ${({ theme }) => theme.colors.primary}; }
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
  &:hover { background: ${({ theme }) => theme.colors.bgHover}; }
  &:disabled { opacity: 0.4; }
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
  &:last-child { border-bottom: none; }
  &:hover { background: ${({ theme }) => theme.colors.bgHover}; }
`;

const Td = styled.td`
  padding: 10px 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  vertical-align: middle;
`;

/** 평점 별+숫자 묶음 */
const RatingWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

/** 별 문자 (황금색) */
const StarText = styled.span`
  color: #f59e0b;
  font-size: 12px;
  letter-spacing: -1px;
`;

const RatingNum = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

/** 내용 말줄임 미리보기 */
const PreviewText = styled.span`
  display: block;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

/**
 * 카테고리 배지 — review_category_code 표시.
 *
 * $highlight=true(=COURSE) 일 때 도장깨기 인증 강조 색상 적용.
 */
const CategoryBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  border-radius: 10px;
  color: ${({ $highlight, theme }) =>
    $highlight ? '#fff' : theme.colors.textSecondary};
  background: ${({ $highlight, theme }) =>
    $highlight ? theme.colors.primary : theme.colors.bgHover};
  border: 1px solid ${({ $highlight, theme }) =>
    $highlight ? theme.colors.primary : theme.colors.border};
  white-space: nowrap;
`;

const MutedText = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`;

const DangerButton = styled.button`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px 8px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 3px;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: all ${({ theme }) => theme.transitions.fast};
  &:hover {
    border-color: ${({ theme }) => theme.colors.error};
    color: ${({ theme }) => theme.colors.error};
  }
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
  &:hover:not(:disabled) { background: ${({ theme }) => theme.colors.bgHover}; }
  &:disabled { opacity: 0.4; }
`;

const PageInfo = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

/* ── 삭제 다이얼로그 ── */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
`;

const DialogBox = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  width: 100%;
  max-width: 420px;
  padding: ${({ theme }) => theme.spacing.xxl};
  box-shadow: ${({ theme }) => theme.shadows.lg};
`;

const DialogTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const DialogDesc = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.7;
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

/** 삭제 다이얼로그 내 내용 스니펫 */
const ContentSnippet = styled.span`
  display: inline-block;
  margin-top: ${({ theme }) => theme.spacing.xs};
  font-style: italic;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const DialogFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const CancelButton = styled.button`
  padding: 7px 16px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.textSecondary};
  &:hover { background: ${({ theme }) => theme.colors.bgHover}; }
`;

const DeleteConfirmButton = styled.button`
  padding: 7px 16px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  background: ${({ theme }) => theme.colors.error};
  color: #fff;
  border-radius: 4px;
  &:hover:not(:disabled) { opacity: 0.85; }
  &:disabled { opacity: 0.5; }
`;
