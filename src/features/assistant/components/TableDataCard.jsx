/**
 * AI 표 데이터 카드 (Phase 4, 2026-04-27).
 *
 * Agent 가 `table_data` SSE 이벤트를 발행했을 때 assistant 메시지 하단에 렌더된다.
 * narrator 의 자연어 답변(보통 6~10문장 보고서/요약)과 짝을 이뤄 **숫자가 많은 응답을
 * 한눈에 보여주기 위한 보조 카드**로 동작한다.
 *
 * 발행 조건 (Agent graph.py `_build_table_payload`):
 *  - tool 결과 data 가 list 또는 Spring Data Page 응답
 *  - row_count >= 3
 *  - 첫 행이 dict (스칼라 list 는 제외)
 *
 * 페이로드 스키마:
 *   {
 *     tool_name: string,            // 어떤 read tool 이 만든 표인지 (디버그용 배지)
 *     title: string,                // 카드 헤더 라벨
 *     columns: string[],            // 첫 행 키 기반, 최대 6개
 *     rows: object[],               // 최대 10행, 각 행은 { col: cell_value } 모양
 *     total_rows: number,           // 원본 전체 건수 (Page 면 totalElements)
 *     truncated: boolean,           // total_rows > rows.length
 *     navigate_path: string | null, // "전체 보기" 버튼 링크. null 이면 버튼 미렌더
 *   }
 *
 * 셀 값은 Agent 측에서 스칼라/JSON 짧게 자른 값이 와서 그대로 렌더하면 된다.
 *
 * @param {Object} props
 * @param {Object} props.data table_data 이벤트 페이로드 전체
 */

import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { MdTableChart, MdNavigateNext } from 'react-icons/md';


export default function TableDataCard({ data }) {
  const navigate = useNavigate();

  if (!data || !Array.isArray(data.columns) || !Array.isArray(data.rows)) return null;

  const {
    tool_name,
    title,
    columns,
    rows,
    total_rows,
    truncated,
    navigate_path,
  } = data;

  /** 셀 값을 안전하게 표시용 문자열로 변환. */
  const formatCell = (value) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? '예' : '아니오';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const handleNavigate = () => {
    if (navigate_path) navigate(navigate_path);
  };

  // 카드가 너무 비어보이지 않도록 빈 표는 렌더 자체를 스킵.
  if (columns.length === 0 || rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <HeaderIcon>
          <MdTableChart size={16} />
        </HeaderIcon>
        <HeaderText>{title || '조회 결과'}</HeaderText>
        <HeaderMeta>
          {/* 표시 행 / 전체 행 — truncated 면 "외 N건" 표기 */}
          {truncated
            ? `${rows.length}건 표시 · 전체 ${total_rows.toLocaleString()}건`
            : `${rows.length}건`}
        </HeaderMeta>
        {tool_name && <ToolBadge>{tool_name}</ToolBadge>}
      </CardHeader>

      {/* 가로 스크롤 — 컬럼 6개 + 좁은 화면 대응 */}
      <TableScroll>
        <Table>
          <thead>
            <tr>
              {columns.map((c) => (
                <Th key={c}>{c}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                {columns.map((c) => (
                  <Td key={c} title={formatCell(row[c])}>
                    {formatCell(row[c])}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </TableScroll>

      {/* "전체 보기" 버튼 — navigate_path 가 있을 때만 노출 */}
      {navigate_path && (
        <Footer>
          <ViewAllButton type="button" onClick={handleNavigate} title={navigate_path}>
            <span>전체 화면에서 보기</span>
            <MdNavigateNext size={16} />
          </ViewAllButton>
        </Footer>
      )}
    </Card>
  );
}


/* ── styled-components ── */

const Card = styled.div`
  margin-top: ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.bgMain};
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.bgSubtle};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const HeaderIcon = styled.span`
  display: inline-flex;
  color: ${({ theme }) => theme.colors.info};
`;

const HeaderText = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const HeaderMeta = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-left: ${({ theme }) => theme.spacing.xs};
`;

const ToolBadge = styled.code`
  margin-left: auto;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TableScroll = styled.div`
  overflow-x: auto;
  max-height: 320px;
  overflow-y: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.fontSizes.xs};
`;

const Th = styled.th`
  text-align: left;
  padding: 8px 10px;
  background: ${({ theme }) => theme.colors.bgSubtle};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;
`;

const Td = styled.td`
  padding: 8px 10px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textPrimary};
  /* 긴 텍스트는 1줄로 잘라 표 형태 유지 + title 속성으로 전체 노출 */
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.bgSubtle};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const ViewAllButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.bgMain};
  color: ${({ theme }) => theme.colors.primary};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryLight};
  }
`;
