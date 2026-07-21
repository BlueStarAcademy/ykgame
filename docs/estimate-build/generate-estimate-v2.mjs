/**
 * Generate development estimate as HWPX + DOCX (ASCII filenames for Windows safety).
 * Run: node generate-estimate-v2.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { HwpxExporter } from "hwpx-ts";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..");

const thin = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "666666" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "666666" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "666666" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "666666" },
};

function cell(text, opts = {}) {
  const {
    bold = false,
    width = 2340,
    fill,
    align = AlignmentType.LEFT,
  } = opts;
  return new TableCell({
    borders: thin,
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill } : undefined,
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: String(text ?? ""),
            bold,
            size: 18,
            font: "Malgun Gothic",
          }),
        ],
      }),
    ],
  });
}

function table(rows, colWidths) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: rows.map((row, ri) =>
      new TableRow({
        children: row.map((text, ci) =>
          cell(text, {
            bold: ri === 0,
            width: colWidths[ci],
            fill: ri === 0 ? "E8EEF7" : undefined,
          }),
        ),
      }),
    ),
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    ...opts,
    children: [
      new TextRun({
        text,
        font: "Malgun Gothic",
        size: opts.size ?? 20,
        bold: opts.bold,
      }),
    ],
  });
}

function h(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        font: "Malgun Gothic",
        bold: true,
        size: level === HeadingLevel.HEADING_1 ? 28 : 24,
      }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { after: 60 },
    indent: { left: 360 },
    children: [
      new TextRun({
        text: `• ${text}`,
        font: "Malgun Gothic",
        size: 20,
      }),
    ],
  });
}

const coverTable = [
  ["구분", "내용"],
  ["문서번호", "YKGAME-EST-2026-001"],
  ["작성일", "2026년 7월 21일"],
  ["유효기간", "제출일로부터 30일"],
  ["제안 형태", "① 일반 외주 견적  ② 전담 개발·유지보수 계약 제안"],
  ["제안 개발비", "금 육천만원정 (60,000,000원) / 3개월"],
  ["유지보수", "월 2,000,000원 × 12개월, 이후 6개월 단위 연장"],
];

const contractGlance = [
  ["단계", "기간", "대금", "비고"],
  ["개발(구축)", "계약일로부터 3개월", "총 60,000,000원", "월 분할(2,000만×3회 권장)"],
  ["유지보수", "개발 완료 후 12개월", "월 2,000,000원", "장애·버그·운영 지원"],
  ["계약 연장", "유지보수 종료 후", "협의(기준 월 200만)", "6개월 단위 연장"],
  ["추가 개발", "상시", "별도 견적", "신규 기능·타 브랜드 등"],
];

const stackTable = [
  ["계층", "구성"],
  ["프론트엔드", "Next.js(App Router), React, Tailwind CSS, PWA"],
  ["3D 시뮬", "Three.js / React Three Fiber / Drei"],
  ["백엔드", "Next.js Route Handlers(REST), NextAuth(JWT)"],
  ["데이터", "PostgreSQL, Prisma ORM"],
  ["인프라", "클라우드 배포, Redis(캐시·레이트리밋), 헬스체크"],
  ["품질", "부하 테스트, API 멱등, 세션 충돌 방지"],
];

const mmTable = [
  ["모듈", "복잡도", "공수(MM)", "비고"],
  ["W1 시뮬·조작·어태치먼트", "L", "4.0", "3D+조작 핵심"],
  ["W2 지형·트럭·토사/암석", "L", "3.5", "역학·AI·티어"],
  ["W3 모드·스코어·성장", "L", "2.5", "튜토리얼·시즌"],
  ["W4 장비·가챠·작업장·정비·조형물", "L", "4.5", "경제 루프"],
  ["W5 퀘스트", "L", "2.0", "다중 진행·클레임"],
  ["W6 소셜·랭킹", "S", "0.5", "랭킹·전광판"],
  ["W7 플랫폼·PWA", "M", "1.5", "회원·홈"],
  ["W8 관리자", "M", "1.2", "운영 도구"],
  ["W9 쿠폰·광고·보상", "M", "1.3", "멱등·한도"],
  ["W10 영속성·동기화", "M", "1.0", "DB·클라 저장"],
  ["W11 UI/UX", "L", "2.5", "HUD·패널"],
  ["W12 인프라·품질", "M", "1.2", "배포·부하"],
  ["통합·폴리시·버퍼(15%)", "-", "3.9", "리스크·조율"],
  ["합계", "-", "약 29.6 MM", "약 30맨먼스"],
];

const outsourceCost = [
  ["항목", "산출", "금액(원)"],
  ["개발 공수", "30 MM × 평균 750만 원", "225,000,000"],
  ["프로젝트 관리·커뮤니케이션", "개발비의 8%", "18,000,000"],
  ["3D 에셋·사운드 외주 보정", "일식", "12,000,000"],
  ["예비비(리스크 10%)", "-", "25,500,000"],
  ["일반 외주 총액(부가세 별도)", "-", "약 280,500,000"],
];

const payment = [
  ["회차", "시점", "금액(원)", "지급 조건"],
  ["1차", "계약 체결 시", "20,000,000", "착수금"],
  ["2차", "계약 후 1개월 경과", "20,000,000", "중간 데모·진행 보고 승인"],
  ["3차", "계약 후 3개월·검수 완료", "20,000,000", "최종 인수 검수 승인"],
  ["합계", "-", "60,000,000", "-"],
];

const milestones = [
  ["월", "주요 산출"],
  ["1개월차", "시뮬·조작·지형 기초, 버켓 굴착/하역, 인증·홈 골격, 기본 HUD"],
  ["2개월차", "브레이커·집게·트럭, 튜토리얼·스코어·XP, 장비/가챠 초안, 퀘스트 기초"],
  ["3개월차", "작업장·정비·조형물·상점·쿠폰·광고·관리자·폴리시·배포·인수 검수"],
];

const compare = [
  ["비교 항목", "일반 외주(참고)", "전담 제안"],
  ["개발비", "약 2.8억 원", "6,000만 원"],
  ["기간", "4~6개월", "3개월"],
  ["커뮤니케이션", "다수 인력·핸드오프", "단일 창구·빠른 의사결정"],
  ["도메인 연속성", "인수인계 리스크", "이후 유지보수와 연속"],
];

const summary = [
  ["구분", "금액(원)", "비고"],
  ["A. 일반 외주 개발(참고)", "약 280,500,000", "팀 투입, 4~6개월"],
  ["B. 전담 개발(권유)", "60,000,000", "3개월, 분할 지급"],
  ["C. 유지보수 1년(권유)", "24,000,000", "월 200만 × 12"],
  ["B+C 첫 15개월 총액", "84,000,000", "개발 3개월+유지 12개월"],
  ["유지보수 연장", "12,000,000 / 6개월", "월 200만 기준"],
  ["추가 개발", "별도 견적", "유지보수 범위 외"],
];

const wbsBullets = {
  W1: [
    "SV08-1 계열 굴착기 3D, 붐/암/버켓 유압, 트랙 주행, 스윙, 다중 섀시",
    "듀얼 조이스틱·주행 레버·페달·세이프티/스로틀/경적, 터치 콕핏",
    "버켓·브레이커·집게·도저, 구역별 어태치먼트 규칙",
  ],
  W2: [
    "맵 티어, 굴착/덤프/크래시/힐/조형물 배치, 미니맵·전체맵",
    "덤프트럭·홀트럭 상태머신, 토사/암석 역학, 월드 픽업",
  ],
  W3: [
    "intro/ride/practice/tutorial/game, 튜토리얼 10단계",
    "시즌 점수·스타·랭킹·XP·레벨·능력 배분",
  ],
  W4: [
    "부위 강화, 기어·가챠·일일 무료, 스타 상점 버프",
    "작업장(덤프/크래시/힐), 정비소 유체 6종·룰렛, 조형물 페이즈",
  ],
  W5: [
    "일일·미션·반복·작업장 팻말·조형물 퀘스트, 멱등 클레임",
    "입장 버튼 완료 배지·수령 가능 붉은 점",
  ],
  W6: ["시즌 랭킹·전광판, 단일 세션 강제 (실시간 멀티는 범위 외)"],
  W7: ["랜딩·PWA·가입/로그인·홈·우편·쿠폰 인벤·문의"],
  W8: ["회원·쿠폰·확률·퀘스트·작업장·우편·공지·문의 관리"],
  W9: ["쿠폰 시즌 쿼터, 시간당 광고 보상, 보상 API 멱등·레이트리밋"],
  W10: ["PostgreSQL 영속화, 클라 세션/쿨다운/진행 저장"],
  W11: ["콕핏 HUD·패널·가챠/정비 연출·토스트·사운드·모바일 터치"],
  W12: ["배포·헬스·마이그레이션·부하 테스트·모니터링 기초"],
};

async function buildDocx() {
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: "소프트웨어 개발 견적서",
          bold: true,
          size: 36,
          font: "Malgun Gothic",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "프로젝트명: YK건기(얀마) 굴착기 시뮬레이터 및 플랫폼",
          bold: true,
          size: 22,
          font: "Malgun Gothic",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: "미개발 상태 가정 · 완성까지의 범위 산정",
          size: 18,
          font: "Malgun Gothic",
          color: "555555",
        }),
      ],
    }),
    table(coverTable, [2400, 6960]),
    h("1. 제안 요지"),
    p(
      "본 견적서는 YK건기 브랜드의 1인칭 굴착기 시뮬레이터 웹 게임과, 이를 뒷받침하는 회원·재화·장비·퀘스트·관리자·보상 경제 플랫폼을 “아직 미개발 상태”로 가정하고, 완성까지의 범위를 상세히 산정한 문서입니다.",
    ),
    p(
      "시장 일반 외주(팀 투입) 대비, 제안자는 동일 범위를 3개월에 집중 개발하고 개발비 6,000만 원을 3개월에 걸쳐 분할 수령하는 전담 계약을 권유합니다. 개발 완료 후 1년간 월 200만 원의 유지보수 계약을 권유하며, 유지보수 종료 후 6개월 단위로 연장할 수 있습니다. 유지보수 범위를 넘는 추가 개발은 별도 견적·비용이 발생합니다.",
    ),
    h("1.1 계약 구조 한눈에 보기", HeadingLevel.HEADING_2),
    table(contractGlance, [1800, 2600, 2400, 2560]),
    h("2. 사업 개요"),
    h("2.1 제품 목표", HeadingLevel.HEADING_2),
    bullet("브라우저(PWA)에서 동작하는 YK건기 굴착기 1인칭 시뮬레이터"),
    bullet("굴착·하역·브레이커·석재 운반과 점수·스타·경험치 성장"),
    bullet("장비(가챠)·상점·작업장·정비소·조형물·퀘스트로 리텐션"),
    bullet("회원·시즌 랭킹·쿠폰·광고 보상·관리자 운영 도구"),
    bullet("향후 타 브랜드 확장을 위한 플랫폼 골격"),
    h("2.2 기술 스택", HeadingLevel.HEADING_2),
    table(stackTable, [2400, 6960]),
    h("3. 개발 범위 상세(WBS) — 미개발 가정"),
    p("복잡도: L(대) / M(중) / S(소). 아래는 완성 제품에 포함되어야 할 세부 기능입니다.", {
      size: 18,
    }),
  ];

  for (const [key, items] of Object.entries(wbsBullets)) {
    children.push(
      h(`3.${key} ${key === "W1" ? "굴착기 시뮬·조작·어태치먼트 [L]" :
        key === "W2" ? "지형·작업 구역·트럭·토사/암석 [L]" :
        key === "W3" ? "게임 모드·스코어·성장 [L]" :
        key === "W4" ? "장비·가챠·상점·작업장·정비·조형물 [L]" :
        key === "W5" ? "퀘스트 체계 [L]" :
        key === "W6" ? "소셜·랭킹 [S]" :
        key === "W7" ? "플랫폼·회원·홈·PWA [M]" :
        key === "W8" ? "관리자 [M]" :
        key === "W9" ? "쿠폰·광고·보상 경제 [M]" :
        key === "W10" ? "영속성·동기화 [M]" :
        key === "W11" ? "인게임 UI/UX [L]" :
        "인프라·품질·배포 [M]"}`, HeadingLevel.HEADING_2),
    );
    for (const item of items) children.push(bullet(item));
  }

  children.push(
    h("3.범위 제외(추가 개발 대상)", HeadingLevel.HEADING_2),
    bullet("타 브랜드 7종 실게임 콘텐츠"),
    bullet("실시간 멀티플레이·길드·친구·채팅"),
    bullet("대규모 마케팅 이벤트 전용 단발 게임"),
    bullet("네이티브 앱스토어 배포(별도 정책 시)"),
    h("4. 공수 산정 및 일반 외주 견적"),
    p(
      "일반 외주(기획 1 + 클라이언트 2 + 서버 1 + 3D/연출 0.5 + QA/PM 0.5) 가정. 단가는 국내 시니어 중심 아웃소싱 참고치입니다.",
    ),
    h("4.1 모듈별 예상 공수", HeadingLevel.HEADING_2),
    table(mmTable, [3600, 1200, 1600, 2960]),
    h("4.2 일반 외주 금액(참고)", HeadingLevel.HEADING_2),
    table(outsourceCost, [3600, 3000, 2760]),
    p(
      "※ 팀·지역·에셋 범위에 따라 약 1.8억~3.2억 원 구간이 현실적입니다. 일정은 착수~인수 약 4~6개월.",
      { size: 18 },
    ),
    h("5. 전담 개발 계약 제안(권유안)"),
    p(
      "제안자는 상기 WBS 범위(제외 항목 제외)를 3개월 내 구축 완료하는 전담 계약을 제안합니다. 검증된 아키텍처·도메인 지식으로 외주 팀 대비 비용·기간을 절감합니다.",
    ),
    h("5.1 개발비", HeadingLevel.HEADING_2),
    table(
      [
        ["구분", "내용"],
        ["총 개발비", "금 육천만원정 (60,000,000원, 부가세 별도 협의)"],
        ["개발 기간", "계약 체결일로부터 3개월"],
        ["범위", "본 문서 제3장 WBS W1~W12 (제외 항목 제외)"],
        ["산출물", "소스코드, DB 스키마, 배포 구성, 운영·관리자 가이드"],
      ],
      [2400, 6960],
    ),
    h("5.2 대금 지급 일정(권장)", HeadingLevel.HEADING_2),
    table(payment, [1400, 2800, 2200, 2960]),
    p("필요 시 월말 균등 분할(매월 2,000만 원 × 3회)로 변경 가능합니다.", {
      size: 18,
    }),
    h("5.3 3개월 마일스톤", HeadingLevel.HEADING_2),
    table(milestones, [1800, 7560]),
    h("5.4 외주 대비 효과", HeadingLevel.HEADING_2),
    table(compare, [2400, 3480, 3480]),
    h("6. 유지보수 계약(권유)"),
    p(
      "개발 검수 완료일 다음날부터 12개월간 유지보수 계약을 권유합니다. 월 보수료 금 이백만원정(2,000,000원, 부가세 별도 협의).",
    ),
    h("6.1 포함 범위", HeadingLevel.HEADING_2),
    bullet("서비스 장애·치명/중요 버그 수정"),
    bullet("기존 기능의 소규모 파라미터·카피·밸런스 조정"),
    bullet("배포·마이그레이션 지원, 로그 기반 원인 분석"),
    bullet("월 1회 진행 공유"),
    bullet("보안 패치·의존성 긴급 대응(합리적 범위)"),
    h("6.2 제외(추가 개발비 대상)", HeadingLevel.HEADING_2),
    bullet("신규 화면·시스템·게임 모드·브랜드 콘텐츠"),
    bullet("대규모 UI 리디자인, 실시간 멀티, 네이티브 앱 전환"),
    bullet("마케팅 이벤트용 단발 콘텐츠, 외부 시스템 신규 연동"),
    p(
      "제외 항목은 별도 요구사항 정의 후 공수·단가로 추가 견적하며, 유지보수 월정액과 분리 청구합니다.",
    ),
    h("6.3 대금·연장", HeadingLevel.HEADING_2),
    table(
      [
        ["항목", "내용"],
        ["월 보수료", "2,000,000원 / 월"],
        ["최초 계약", "12개월 (합계 24,000,000원)"],
        ["연장", "종료 후 6개월 단위 연장 가능 (원칙 월 200만 원, 규모 확대 시 협의)"],
        ["연장 통지", "만료 30일 전 서면(이메일 포함) 합의"],
      ],
      [2400, 6960],
    ),
    h("7. 검수 및 인수"),
    bullet("중간 검수(1개월차): 데모 빌드·핵심 플레이 루프"),
    bullet("최종 검수(3개월차): WBS 체크리스트, 치명 결함 0"),
    bullet("검수 기간: 최종 산출물 제출 후 7영업일(협의 가능)"),
    bullet("경미 결함은 유지보수 기간 순차 조치 가능"),
    bullet("인수 시 소스·배포 권한·계정 인수인계"),
    h("8. 견적 가정 및 전제"),
    bullet("발주처는 브랜드 에셋(로고·실기·승인된 3D/사운드)을 적시 제공"),
    bullet("클라우드·도메인·광고 등 외부 계정은 발주처 명의"),
    bullet("WBS 초과 요구는 변경관리로 일정·비용 재산정"),
    bullet("약관·개인정보 법률 검토는 발주처 책임(초안 지원 가능)"),
    bullet("금액은 부가세 별도, 본 문서는 제안용(정식 계약 전 비구속)"),
    h("9. 총괄 견적 요약"),
    table(summary, [3600, 2800, 2960]),
    h("9.1 권유 계약 패키지", HeadingLevel.HEADING_2),
    p(
      "① 개발 계약: 3개월 / 6,000만 원(3회 분할) → ② 유지보수: 12개월 / 월 200만 원 → ③ 이후 6개월 단위 연장 → ④ 신규·확장 기능은 추가 개발 견적.",
      { bold: true },
    ),
    p("이상으로 견적 및 계약 제안을 드립니다."),
    p("제안자: ________________________"),
    p("연락처: ________________________"),
    p("일자: 2026년 7월 21일"),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [
        new TextRun({ text: "— 끝 —", font: "Malgun Gothic", size: 20 }),
      ],
    }),
  );

  const doc = new Document({
    creator: "YKGame Estimate",
    title: "YK건기 시뮬레이터 개발 견적서",
    description: "YKGAME-EST-2026-001",
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "YK건기 시뮬레이터 개발 견적서 | YKGAME-EST-2026-001",
                    size: 16,
                    font: "Malgun Gothic",
                    color: "666666",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "기밀 — 제안용 견적 문서  |  ",
                    size: 16,
                    font: "Malgun Gothic",
                    color: "666666",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    font: "Malgun Gothic",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  const out = path.join(OUT_DIR, "YKGame_Dev_Estimate_2026.docx");
  fs.writeFileSync(out, buf);
  return out;
}

async function buildHwpx() {
  const e = new HwpxExporter();
  const line = (t) => e.addParagraph(t);
  const blank = () => e.addLineBreak();

  e.addHeading("소프트웨어 개발 견적서", 1, "center");
  e.addParagraph("프로젝트명: YK건기(얀마) 굴착기 시뮬레이터 및 플랫폼", {
    bold: true,
    alignment: "center",
  });
  e.addParagraph("문서번호: YKGAME-EST-2026-001  |  작성일: 2026년 7월 21일", {
    alignment: "center",
  });
  blank();
  e.addTable(coverTable);
  blank();
  e.addHeading("1. 제안 요지", 1);
  line(
    "본 견적서는 YK건기 브랜드의 1인칭 굴착기 시뮬레이터 웹 게임과 회원·재화·장비·퀘스트·관리자·보상 플랫폼을 “아직 미개발 상태”로 가정하고 완성 범위를 산정합니다.",
  );
  line(
    "일반 외주 대비, 제안자는 동일 범위를 3개월에 개발하고 개발비 6,000만 원을 3개월에 걸쳐 분할 수령하는 전담 계약을 권유합니다. 이후 1년 유지보수(월 200만 원), 종료 후 6개월 단위 연장. 추가 개발은 별도 비용입니다.",
  );
  e.addHeading("1.1 계약 구조", 2);
  e.addTable(contractGlance);
  e.addHeading("2. 사업 개요", 1);
  e.addHeading("2.1 제품 목표", 2);
  for (const t of [
    "브라우저(PWA) YK건기 굴착기 1인칭 시뮬레이터",
    "굴착·하역·브레이커·석재 운반과 점수·스타·XP",
    "장비·상점·작업장·정비소·조형물·퀘스트",
    "회원·랭킹·쿠폰·광고·관리자",
  ]) {
    line(`• ${t}`);
  }
  e.addHeading("2.2 기술 스택", 2);
  e.addTable(stackTable);
  e.addHeading("3. 개발 범위(WBS) — 미개발 가정", 1);
  const titles = {
    W1: "굴착기 시뮬·조작·어태치먼트 [L]",
    W2: "지형·트럭·토사/암석 [L]",
    W3: "모드·스코어·성장 [L]",
    W4: "장비·가챠·작업장·정비·조형물 [L]",
    W5: "퀘스트 [L]",
    W6: "소셜·랭킹 [S]",
    W7: "플랫폼·PWA [M]",
    W8: "관리자 [M]",
    W9: "쿠폰·광고·보상 [M]",
    W10: "영속성 [M]",
    W11: "UI/UX [L]",
    W12: "인프라·품질 [M]",
  };
  for (const [k, items] of Object.entries(wbsBullets)) {
    e.addHeading(`3.${k} ${titles[k]}`, 2);
    for (const item of items) line(`• ${item}`);
  }
  e.addHeading("3.범위 제외", 2);
  for (const t of [
    "타 브랜드 실게임",
    "실시간 멀티·길드·채팅",
    "이벤트 단발 게임",
    "네이티브 앱스토어 배포",
  ]) {
    line(`• ${t}`);
  }
  e.addHeading("4. 공수·일반 외주 견적", 1);
  e.addHeading("4.1 모듈별 공수", 2);
  e.addTable(mmTable);
  e.addHeading("4.2 일반 외주 금액", 2);
  e.addTable(outsourceCost);
  line(
    "※ 참고: 약 1.8억~3.2억 원 구간, 일정 4~6개월. 위 표는 중간~상위 시나리오입니다.",
  );
  e.addHeading("5. 전담 개발 제안(권유)", 1);
  line(
    "총 개발비 금 육천만원정(60,000,000원), 기간 3개월. WBS W1~W12(제외 항목 제외).",
  );
  e.addHeading("5.2 대금 지급", 2);
  e.addTable(payment);
  e.addHeading("5.3 마일스톤", 2);
  e.addTable(milestones);
  e.addHeading("5.4 외주 대비", 2);
  e.addTable(compare);
  e.addHeading("6. 유지보수(권유)", 1);
  line(
    "검수 완료 다음날부터 12개월, 월 금 이백만원정(2,000,000원). 종료 후 6개월 단위 연장 가능.",
  );
  line("포함: 장애·중요 버그, 소규모 조정, 배포 지원, 월 1회 공유.");
  line(
    "제외(추가 개발비): 신규 기능·타 브랜드·대규모 리디자인·실시간 멀티 등.",
  );
  e.addHeading("7. 검수·인수", 1);
  line("• 1개월 중간 데모 / 3개월 최종 WBS 검수 / 치명 결함 0 / 7영업일 검수");
  e.addHeading("8. 전제", 1);
  line("• 에셋·계정은 발주처 제공, WBS 초과는 변경관리, 금액 부가세 별도, 제안용 비구속");
  e.addHeading("9. 총괄 요약", 1);
  e.addTable(summary);
  blank();
  line(
    "권유 패키지: ① 개발 3개월·6,000만(분할) → ② 유지보수 12개월·월 200만 → ③ 6개월 단위 연장 → ④ 추가 개발 별도 견적",
  );
  blank();
  line("제안자: ________________  연락처: ________________  일자: 2026-07-21");
  line("— 끝 —");

  const out = path.join(OUT_DIR, "YKGame_Dev_Estimate_2026.hwpx");
  await e.saveToFile(out);
  return out;
}

const docxPath = await buildDocx();
const hwpxPath = await buildHwpx();

// Validate HWPX zip integrity
const JSZip = (await import("jszip")).default;
const zip = await JSZip.loadAsync(fs.readFileSync(hwpxPath));
const names = Object.keys(zip.files);
if (!names.includes("mimetype") || !names.includes("Contents/section0.xml")) {
  throw new Error("Invalid HWPX structure: " + names.join(", "));
}
const mt = await zip.file("mimetype").async("string");
if (mt !== "application/hwp+zip") {
  throw new Error("Bad mimetype: " + mt);
}

console.log("OK DOCX", docxPath, fs.statSync(docxPath).size);
console.log("OK HWPX", hwpxPath, fs.statSync(hwpxPath).size);
console.log("HWPX entries:", names.join(", "));
