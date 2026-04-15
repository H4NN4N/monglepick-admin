/**
 * 모니터링 스택 접속 가이드 (조회 전용).
 *
 * VM3(10.20.0.12)에 구축된 Prometheus + Grafana + Alertmanager + ELK 스택의
 * 외부 접속 URL, 기본 Basic Auth 계정, 각 도구의 용도/사용법, 주요 알림 룰 요약을
 * 한 페이지에서 조망할 수 있도록 제공한다.
 *
 * 단일 진실 원본은 `docs/모니터링_관찰성_스택.md` — 본 컴포넌트는 그 문서의 §2 외부 접근,
 * §4 알림 룰, §6 Grafana 구성, §6.5 Kibana 구성 요약본이다. 실제 자격 증명은 코드에
 * 박지 않고, 관리자가 이 탭을 통해 "어디로 가면 무엇을 볼 수 있는지" 만 안내한다.
 *
 * 설계 원칙:
 *  - 네트워크 API 호출 없음(순수 정적 가이드). 서비스 상태/헬스체크는 ServiceStatus 가 담당.
 *  - URL/계정 변경 시 본 파일 상수만 수정하면 되도록 `TOOLS`, `ALERT_RULES` 배열로 분리.
 *  - 링크는 `target="_blank"` + `rel="noopener noreferrer"` (Basic Auth 팝업 경유).
 */

import styled from 'styled-components';
import {
  MdOpenInNew,
  MdDashboard,
  MdSearch,
  MdQueryStats,
  MdNotificationsActive,
  MdContentCopy,
} from 'react-icons/md';

/**
 * 외부 접근 공통 정보.
 * VM1 Nginx(:8082)가 Basic Auth 1차 + 각 도구 2차 인증으로 중계한다.
 */
const EXTERNAL_HOST = 'http://210.109.15.187:8082';
const BASIC_AUTH_USER = 'admin';
const BASIC_AUTH_PASSWORD = 'monglepick2026!';

/**
 * 모니터링 도구 카드 정의.
 * 순서: 대시보드(Grafana) → 로그(Kibana) → 메트릭(Prometheus) → 알림(Alertmanager).
 */
const TOOLS = [
  {
    key: 'grafana',
    name: 'Grafana',
    subtitle: '메트릭 대시보드',
    icon: MdDashboard,
    url: `${EXTERNAL_HOST}/grafana/`,
    secondAuth: 'GRAFANA_USER / GRAFANA_PASSWORD (.env)',
    purpose: 'VM/컨테이너/앱/DB/GPU 메트릭의 시계열 대시보드',
    tips: [
      '추천 대시보드: `Monglepick Overview` — SLO(Targets UP/DOWN, 5xx율, GPU, p95 latency) 한눈에',
      '`infra/app/db/logs` 폴더에 Node/JVM/MySQL/Redis/ES/GPU + monglepick-logs(ES 12패널)',
      '오른쪽 상단 시간 범위(1h/6h/24h) + Auto refresh(10s~1m) 권장',
    ],
  },
  {
    key: 'kibana',
    name: 'Kibana',
    subtitle: '로그 탐색',
    icon: MdSearch,
    url: `${EXTERNAL_HOST}/kibana/`,
    secondAuth: 'elastic / ELASTIC_PASSWORD',
    purpose: 'Spring/Agent/Recommend/Nginx JSON 로그의 통합 검색과 실시간 스트림',
    tips: [
      '대시보드 → `[몽글픽] 로그 개요 — 실시간` 에서 전 서비스 한눈 조망',
      '서비스별: `Spring Backend 로그`, `FastAPI Agent + Recommend 로그`(trace_id 추적), `Nginx Access 로그`',
      'Discover → `logs-monglepick-*` 인덱스 패턴 + `log_level: ERROR` 필터로 에러만 필터링',
    ],
  },
  {
    key: 'prometheus',
    name: 'Prometheus',
    subtitle: '메트릭 원본 + 타겟 상태',
    icon: MdQueryStats,
    url: `${EXTERNAL_HOST}/prometheus/`,
    secondAuth: '없음 (1차 Basic Auth 만)',
    purpose: '스크레이프 타겟 UP/DOWN 확인과 PromQL 원본 쿼리',
    tips: [
      '`Status → Targets` 에서 14개 스크레이프 잡의 UP/DOWN 즉시 확인',
      '`Status → Rules` 에서 20개 알림 룰(5개 그룹)과 현재 상태',
      'Graph 탭에서 임의 PromQL 즉석 실행(예: `rate(http_server_requests_seconds_count[5m])`)',
    ],
  },
  {
    key: 'alertmanager',
    name: 'Alertmanager',
    subtitle: '알림 라우팅/현황',
    icon: MdNotificationsActive,
    url: `${EXTERNAL_HOST}:9093/`,
    secondAuth: '없음 (내부망 + 1차 Basic Auth 필요)',
    purpose: '현재 발화 중(firing) 알림 목록과 음소거(silence)',
    tips: [
      'Alerts 탭 → firing/suppressed 필터',
      'Silences → 점검/배포 시 일정 구간 알림 음소거',
      '※ Slack/PagerDuty webhook 미연결 상태(TODO). 알림은 본 UI로만 확인',
    ],
  },
];

/**
 * 주요 알림 룰 요약(문서 §4, 20개 중 대표 11개).
 * 실제 룰 파일: VM3 `prometheus/rules/base.yml`.
 */
const ALERT_RULES = [
  { name: 'InstanceDown',           condition: 'up == 0, 2m',                        severity: 'critical' },
  { name: 'NodeCriticalDiskUsage',  condition: 'disk > 95%, 2m',                     severity: 'critical' },
  { name: 'NodeHighDiskUsage',      condition: 'disk > 85%, 5m',                     severity: 'warning'  },
  { name: 'NodeHighMemoryUsage',    condition: 'mem > 90%, 10m',                     severity: 'warning'  },
  { name: 'HttpServer5xxRateHigh',  condition: '5xx > 5%, 5m',                       severity: 'critical' },
  { name: 'JvmHeapHigh',            condition: 'heap > 90%, 10m',                    severity: 'warning'  },
  { name: 'MysqlDown',              condition: 'mysql_up == 0, 1m',                  severity: 'critical' },
  { name: 'RedisDown',              condition: 'redis_up == 0, 1m',                  severity: 'critical' },
  { name: 'ElasticsearchClusterRed',condition: 'cluster color = red, 1m',            severity: 'critical' },
  { name: 'GpuMemoryHigh',          condition: 'gpu mem > 90%, 5m',                  severity: 'warning'  },
  { name: 'VllmDown',               condition: 'up{job="vllm"} == 0, 2m',            severity: 'critical' },
];

/**
 * 클립보드 복사 유틸.
 * navigator.clipboard 미지원 환경을 위한 textarea fallback 포함.
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback: hidden textarea + execCommand
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function MonitoringGuide() {
  return (
    <Section>
      <SectionHeader>
        <SectionTitle>모니터링 스택 접속</SectionTitle>
        <DocLink
          href="https://github.com/monglepick"
          onClick={(e) => e.preventDefault()}
          title="상세 문서: docs/모니터링_관찰성_스택.md"
        >
          docs/모니터링_관찰성_스택.md
        </DocLink>
      </SectionHeader>

      {/* ── 공통 Basic Auth 안내 배너 ─────────────────────────────────── */}
      <AuthBanner>
        <AuthTitle>🔐 공통 1차 인증 (VM1 Nginx Basic Auth)</AuthTitle>
        <AuthGrid>
          <AuthItem>
            <AuthLabel>엔드포인트</AuthLabel>
            <AuthValueRow>
              <AuthValue>{EXTERNAL_HOST}</AuthValue>
              <CopyButton
                type="button"
                onClick={() => copyToClipboard(EXTERNAL_HOST)}
                title="복사"
              >
                <MdContentCopy size={14} />
              </CopyButton>
            </AuthValueRow>
          </AuthItem>
          <AuthItem>
            <AuthLabel>사용자</AuthLabel>
            <AuthValueRow>
              <AuthValue>{BASIC_AUTH_USER}</AuthValue>
              <CopyButton
                type="button"
                onClick={() => copyToClipboard(BASIC_AUTH_USER)}
                title="복사"
              >
                <MdContentCopy size={14} />
              </CopyButton>
            </AuthValueRow>
          </AuthItem>
          <AuthItem>
            <AuthLabel>비밀번호</AuthLabel>
            <AuthValueRow>
              <AuthValue>{BASIC_AUTH_PASSWORD}</AuthValue>
              <CopyButton
                type="button"
                onClick={() => copyToClipboard(BASIC_AUTH_PASSWORD)}
                title="복사"
              >
                <MdContentCopy size={14} />
              </CopyButton>
            </AuthValueRow>
          </AuthItem>
        </AuthGrid>
        <AuthNote>
          외부 접속은 VM1(210.109.15.187) 8082 포트 경유. 보안그룹에서 관리자 IP 만
          허용되거나 0.0.0.0/0 에 개방되어 있을 수 있으므로 공용 네트워크 사용 시 주의.
          각 도구는 추가로 2차 인증이 필요하다.
        </AuthNote>
      </AuthBanner>

      {/* ── 도구 카드 4종 ─────────────────────────────────────────────── */}
      <CardGrid>
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <ToolCard key={tool.key}>
              <ToolHead>
                <ToolIconWrap>
                  <Icon size={22} />
                </ToolIconWrap>
                <ToolHeadText>
                  <ToolName>{tool.name}</ToolName>
                  <ToolSubtitle>{tool.subtitle}</ToolSubtitle>
                </ToolHeadText>
                <OpenLink
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="새 창으로 열기"
                >
                  <MdOpenInNew size={18} />
                </OpenLink>
              </ToolHead>

              <ToolUrlRow>
                <ToolUrl>{tool.url}</ToolUrl>
                <CopyButton
                  type="button"
                  onClick={() => copyToClipboard(tool.url)}
                  title="URL 복사"
                >
                  <MdContentCopy size={14} />
                </CopyButton>
              </ToolUrlRow>

              <ToolMeta>
                <MetaLabel>2차 인증</MetaLabel>
                <MetaValue>{tool.secondAuth}</MetaValue>
              </ToolMeta>
              <ToolMeta>
                <MetaLabel>용도</MetaLabel>
                <MetaValue>{tool.purpose}</MetaValue>
              </ToolMeta>

              <TipList>
                {tool.tips.map((tip, i) => (
                  <TipItem key={i}>{tip}</TipItem>
                ))}
              </TipList>
            </ToolCard>
          );
        })}
      </CardGrid>

      {/* ── 주요 알림 룰 요약 ─────────────────────────────────────────── */}
      <AlertsBlock>
        <SubTitle>주요 알림 룰 (20개 중 대표 {ALERT_RULES.length}개)</SubTitle>
        <AlertsTable>
          <thead>
            <tr>
              <Th>알림</Th>
              <Th>임계 조건</Th>
              <Th>심각도</Th>
            </tr>
          </thead>
          <tbody>
            {ALERT_RULES.map((rule) => (
              <tr key={rule.name}>
                <Td><Code>{rule.name}</Code></Td>
                <Td><MonoText>{rule.condition}</MonoText></Td>
                <Td>
                  <SeverityPill $level={rule.severity}>
                    {rule.severity}
                  </SeverityPill>
                </Td>
              </tr>
            ))}
          </tbody>
        </AlertsTable>
        <AlertNote>
          전체 룰은 VM3 <MonoText>prometheus/rules/base.yml</MonoText> 또는
          Prometheus UI → <MonoText>Status → Rules</MonoText> 에서 확인.
          Slack/PagerDuty webhook 연동 전까지는 Alertmanager UI 로만 확인 가능.
        </AlertNote>
      </AlertsBlock>
    </Section>
  );
}

/* ── styled-components ──────────────────────────────────────────────── */

const Section = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.heading};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
`;

/** 문서 참조 — 실제 링크 없음(프로젝트 내부 문서), title 로 경로만 노출 */
const DocLink = styled.a`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  font-family: ${({ theme }) => theme.fonts.mono};
  cursor: help;
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const AuthBanner = styled.div`
  background: ${({ theme }) => theme.colors.bgSubtle || theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-left: 3px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const AuthTitle = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const AuthGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const AuthItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const AuthLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const AuthValueRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const AuthValue = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  word-break: break-all;
`;

const AuthNote = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  line-height: 1.6;
  margin: 0;
`;

const CopyButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textSecondary};
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
    color: ${({ theme }) => theme.colors.text};
  }
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const ToolCard = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.xl};
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
`;

const ToolHead = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const ToolIconWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  flex-shrink: 0;
`;

const ToolHeadText = styled.div`
  flex: 1;
  min-width: 0;
`;

const ToolName = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  line-height: 1.2;
`;

const ToolSubtitle = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 2px;
`;

const OpenLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textSecondary};
  text-decoration: none;
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const ToolUrlRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.bgHover};
  border-radius: 6px;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const ToolUrl = styled.span`
  flex: 1;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  word-break: break-all;
`;

const ToolMeta = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} 0;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border-top: 1px solid ${({ theme }) => theme.colors.borderLight};

  &:first-of-type {
    border-top: none;
  }
`;

const MetaLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  flex-shrink: 0;
  width: 64px;
`;

const MetaValue = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.5;
`;

const TipList = styled.ul`
  list-style: none;
  padding: 0;
  margin: ${({ theme }) => theme.spacing.md} 0 0 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const TipItem = styled.li`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.6;
  padding-left: ${({ theme }) => theme.spacing.md};
  position: relative;

  &::before {
    content: '•';
    position: absolute;
    left: 0;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const AlertsBlock = styled.div`
  background: ${({ theme }) => theme.colors.bgCard};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.layout.cardRadius};
  padding: ${({ theme }) => theme.spacing.xl};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const SubTitle = styled.h4`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  margin: 0 0 ${({ theme }) => theme.spacing.md} 0;
`;

const AlertsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

const Th = styled.th`
  text-align: left;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.textMuted};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Td = styled.td`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
`;

const Code = styled.code`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
`;

const MonoText = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

/** 심각도 pill — critical(적), warning(황) */
const SeverityPill = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  text-transform: uppercase;
  background: ${({ $level, theme }) =>
    $level === 'critical'
      ? (theme.colors.errorLight || 'rgba(239, 68, 68, 0.12)')
      : (theme.colors.warningLight || 'rgba(245, 158, 11, 0.15)')};
  color: ${({ $level, theme }) =>
    $level === 'critical' ? theme.colors.error : theme.colors.warning};
`;

const AlertNote = styled.p`
  margin: ${({ theme }) => theme.spacing.md} 0 0 0;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  line-height: 1.6;
`;
