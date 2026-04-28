/**
 * AI 시계열 차트 카드 (Phase 4 후속, 2026-04-28).
 *
 * Agent 가 `chart_data` SSE 이벤트를 발행했을 때 assistant 메시지 하단에 렌더된다.
 * 보고서/요약 응답에서 stats_trends · dashboard_trends · stats_revenue 같은 시계열
 * 통계 결과를 시각화한다.
 *
 * 발행 조건 (Agent graph.py `_build_chart_payload`):
 *  - tool 이름이 `_CHART_TOOL_SPECS` 화이트리스트에 등록
 *  - data 가 dict 이고 등록된 data_key 안에 list[dict] 가 있을 것
 *  - 데이터포인트 수 >= 3
 *
 * 페이로드 스키마:
 *   {
 *     tool_name: string,
 *     title: string,                            // 카드 헤더
 *     chart_type: 'line' | 'bar',               // recharts 컴포넌트 분기
 *     unit: string,                             // tooltip 단위 표시
 *     x_axis: { key: string, values: string[] },
 *     series: [{ name: string, key: string, data: (number|null)[] }],
 *     total_points: number,
 *     truncated: boolean,
 *     navigate_path: string | null,
 *   }
 *
 * series.data 는 x_axis.values 와 인덱스 1:1 매칭. recharts 입력 포맷에 맞춰
 * `[{ x: '2026-04-21', dau: 1234, newUsers: 30, ... }, ...]` 로 변환한다.
 *
 * @param {Object} props
 * @param {Object} props.data chart_data 이벤트 페이로드 전체
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { useTheme } from 'styled-components';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MdShowChart, MdNavigateNext, MdBarChart, MdPieChart } from 'react-icons/md';

/** line/bar 시리즈 색상 — theme palette key 순서 (4 시리즈까지). */
const SERIES_COLOR_KEYS = ['primary', 'success', 'warning', 'info'];

/**
 * pie 슬라이스 색상 — DashboardCharts 의 PLAN_COLORS 와 동일 hex 팔레트.
 * theme palette 가 4색이라 슬라이스 5+ 케이스 (장르 분포 등) 대비 5번째부터 hex 연장.
 * 슬라이스 수가 팔레트보다 많으면 modulo 로 회귀.
 */
const PIE_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#a855f7', // purple
  '#14b8a6', // teal
  '#eab308', // yellow
];


export default function ChartDataCard({ data }) {
  const theme = useTheme();
  const navigate = useNavigate();

  /**
   * series 별 색상은 theme.colors[primary|success|warning|info] 를 순서대로 매핑.
   * 5번째 이후는 무지개 회귀 (마지막 색 반복) — 등록된 차트 시리즈가 4개 이하라 실용상 충분.
   */
  const colorFor = (idx) => {
    const key = SERIES_COLOR_KEYS[idx] || SERIES_COLOR_KEYS[SERIES_COLOR_KEYS.length - 1];
    return theme.colors[key] || theme.colors.primary;
  };

  /**
   * payload → recharts 입력 변환.
   * `[{ x: 'YYYY-MM-DD', [series.name]: value, ... }, ...]`
   *
   * useMemo 로 메모이즈 — 같은 payload 재렌더 시 변환 비용 제거.
   */
  const rechartsData = useMemo(() => {
    if (!data) return [];
    const xs = data.x_axis?.values || [];
    const series = Array.isArray(data.series) ? data.series : [];
    return xs.map((xVal, i) => {
      const row = { x: xVal };
      for (const s of series) {
        row[s.name] = Array.isArray(s.data) ? s.data[i] ?? null : null;
      }
      return row;
    });
  }, [data]);

  if (!data || rechartsData.length === 0) return null;

  const {
    tool_name,
    title,
    chart_type,
    unit,
    series = [],
    total_points,
    truncated,
    navigate_path,
  } = data;

  const isBar = chart_type === 'bar';
  const isPie = chart_type === 'pie';

  /**
   * pie 차트 입력은 line/bar 와 데이터 형태가 달라 별도 변환.
   * x_axis.values[i] → name, series[0].data[i] → value 의 배열로 zip.
   * 단일 시리즈만 지원 — pie 에 다중 시리즈는 의미 없음 (첫 series 만 사용).
   */
  const pieData = useMemo(() => {
    if (!isPie || !data) return [];
    const xs = data.x_axis?.values || [];
    const firstSeries = Array.isArray(data.series) && data.series[0];
    const vals = firstSeries?.data || [];
    return xs
      .map((name, i) => ({ name: String(name), value: vals[i] }))
      .filter((d) => d.value !== null && d.value !== undefined);
  }, [data, isPie]);

  /** Y축 값 포맷 — 단위가 "원" 이면 천단위 콤마, 그 외 숫자만. */
  const formatY = (value) => {
    if (value === null || value === undefined) return '';
    if (unit === '원') return value.toLocaleString();
    if (typeof value === 'number' && Math.abs(value) >= 1000) return value.toLocaleString();
    return String(value);
  };

  /** Tooltip 값 포맷 — 단위 표시 포함. */
  const tooltipFormatter = (value, name) => {
    if (value === null || value === undefined) return ['—', name];
    const formatted = (typeof value === 'number')
      ? value.toLocaleString()
      : String(value);
    const suffix = unit && unit !== '혼합' ? ` ${unit}` : '';
    return [`${formatted}${suffix}`, name];
  };

  const handleNavigate = () => {
    if (navigate_path) navigate(navigate_path);
  };

  const ChartComponent = isBar ? BarChart : LineChart;

  // 헤더 아이콘 — chart_type 별 분기.
  const HeaderIconElement = isPie
    ? <MdPieChart size={16} />
    : isBar
      ? <MdBarChart size={16} />
      : <MdShowChart size={16} />;

  // 메타 라벨 — pie 는 "N개 슬라이스" 가 더 자연스러움.
  const metaLabel = isPie
    ? (truncated
        ? `${pieData.length}개 슬라이스 · 전체 ${total_points.toLocaleString()}개`
        : `${pieData.length}개 슬라이스`)
    : (truncated
        ? `최근 ${rechartsData.length}개 · 전체 ${total_points.toLocaleString()}개`
        : `${rechartsData.length}개`);

  return (
    <Card>
      <CardHeader>
        <HeaderIcon>{HeaderIconElement}</HeaderIcon>
        <HeaderText>{title || '차트'}</HeaderText>
        <HeaderMeta>{metaLabel}</HeaderMeta>
        {tool_name && <ToolBadge>{tool_name}</ToolBadge>}
      </CardHeader>

      <ChartArea>
        {/* ResponsiveContainer 는 부모 너비/높이에 맞춰 자동 리사이즈.
            line/bar 220px / pie 240px (Legend 포함 균형). */}
        <ResponsiveContainer width="100%" height={isPie ? 240 : 220}>
          {isPie ? (
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                isAnimationActive={false}
              >
                {pieData.map((_, idx) => (
                  <Cell
                    key={`slice-${idx}`}
                    fill={PIE_COLORS[idx % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: theme.colors.bgMain,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={tooltipFormatter}
                labelStyle={{ color: theme.colors.textMuted, fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          ) : (
            <ChartComponent
              data={rechartsData}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={theme.colors.border} strokeDasharray="3 3" />
              <XAxis
                dataKey="x"
                tick={{ fontSize: 11, fill: theme.colors.textMuted }}
                stroke={theme.colors.border}
              />
              <YAxis
                tick={{ fontSize: 11, fill: theme.colors.textMuted }}
                stroke={theme.colors.border}
                tickFormatter={formatY}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: theme.colors.bgMain,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={tooltipFormatter}
                labelStyle={{ color: theme.colors.textMuted, fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map((s, idx) => isBar ? (
                <Bar
                  key={s.key}
                  dataKey={s.name}
                  fill={colorFor(idx)}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.name}
                  stroke={colorFor(idx)}
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </ChartComponent>
          )}
        </ResponsiveContainer>
      </ChartArea>

      {/* "전체 화면에서 보기" 버튼 — navigate_path 가 있을 때만 노출 */}
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
  color: ${({ theme }) => theme.colors.primary};
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

const ChartArea = styled.div`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xs}
           ${({ theme }) => theme.spacing.xs};
  background: ${({ theme }) => theme.colors.bgMain};
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
