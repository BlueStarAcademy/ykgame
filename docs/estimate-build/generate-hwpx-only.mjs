/**
 * HWPX only — safe when DOCX is locked open in Word/Hangul.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { HwpxExporter } from "hwpx-ts";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "..", "YKGame_Dev_Estimate_2026.hwpx");

const e = new HwpxExporter();
const line = (t) => e.addParagraph(t);
const blank = () => e.addLineBreak();

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
  ["인프라", "클라우드 배포, Redis, 헬스체크"],
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
  ["프로젝트 관리", "개발비의 8%", "18,000,000"],
  ["3D 에셋·사운드 보정", "일식", "12,000,000"],
  ["예비비(10%)", "-", "25,500,000"],
  ["일반 외주 총액(부가세 별도)", "-", "약 280,500,000"],
];
const payment = [
  ["회차", "시점", "금액(원)", "지급 조건"],
  ["1차", "계약 체결 시", "20,000,000", "착수금"],
  ["2차", "계약 후 1개월", "20,000,000", "중간 데모 승인"],
  ["3차", "3개월·검수 완료", "20,000,000", "최종 인수 승인"],
  ["합계", "-", "60,000,000", "-"],
];
const milestones = [
  ["월", "주요 산출"],
  ["1개월차", "시뮬·조작·지형, 버켓 굴착/하역, 인증·홈, HUD"],
  ["2개월차", "브레이커·집게·트럭, 튜토리얼·스코어·XP, 장비/가챠, 퀘스트"],
  ["3개월차", "작업장·정비·조형물·상점·쿠폰·광고·관리자·배포·인수"],
];
const compare = [
  ["비교", "일반 외주", "전담 제안"],
  ["개발비", "약 2.8억 원", "6,000만 원"],
  ["기간", "4~6개월", "3개월"],
  ["커뮤니케이션", "다수 인력", "단일 창구"],
  ["연속성", "인수인계 리스크", "유지보수와 연속"],
];
const summary = [
  ["구분", "금액(원)", "비고"],
  ["A. 일반 외주(참고)", "약 280,500,000", "팀 투입 4~6개월"],
  ["B. 전담 개발(권유)", "60,000,000", "3개월 분할"],
  ["C. 유지보수 1년", "24,000,000", "월 200만×12"],
  ["B+C 15개월", "84,000,000", "개발+유지"],
  ["유지보수 연장", "12,000,000/6개월", "월 200만"],
  ["추가 개발", "별도 견적", "유지보수 범위 외"],
];
const wbs = {
  W1: ["굴착기 3D·유압·주행·스윙·다중 섀시", "듀얼 조이스틱·레버·페달·터치 콕핏", "버켓·브레이커·집게·도저"],
  W2: ["맵 티어·구역 배치·미니맵", "덤프/홀트럭·토사/암석·월드 픽업"],
  W3: ["모드·튜토리얼 10단계", "시즌 점수·스타·랭킹·XP·레벨"],
  W4: ["기어·가챠·상점 버프", "작업장·정비소·조형물"],
  W5: ["일일·미션·반복·팻말·조형물 퀘스트", "입장 버튼 배지"],
  W6: ["시즌 랭킹·전광판 (실시간 멀티 제외)"],
  W7: ["랜딩·PWA·회원·홈·우편·쿠폰·문의"],
  W8: ["회원·쿠폰·확률·퀘스트·우편·공지 관리"],
  W9: ["쿠폰 쿼터·광고 보상·멱등 API"],
  W10: ["DB 영속화·클라 진행 저장"],
  W11: ["HUD·패널·연출·사운드·모바일"],
  W12: ["배포·헬스·부하 테스트"],
};
const titles = {
  W1: "시뮬·조작·어태치먼트 [L]",
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
  "본 견적서는 YK건기 굴착기 시뮬레이터와 회원·재화·장비·퀘스트·관리자·보상 플랫폼을 “미개발 상태”로 가정하고 완성 범위를 산정합니다.",
);
line(
  "일반 외주 대비, 제안자는 3개월·6,000만 원(분할) 전담 개발을 권유합니다. 이후 1년 유지보수(월 200만 원), 종료 후 6개월 단위 연장. 추가 개발은 별도 비용입니다.",
);
e.addHeading("1.1 계약 구조", 2);
e.addTable(contractGlance);
e.addHeading("2. 사업 개요", 1);
e.addHeading("2.1 제품 목표", 2);
for (const t of [
  "PWA 굴착기 1인칭 시뮬레이터",
  "굴착·하역·브레이커·석재와 점수·스타·XP",
  "장비·상점·작업장·정비소·조형물·퀘스트",
  "회원·랭킹·쿠폰·광고·관리자",
]) {
  line("• " + t);
}
e.addHeading("2.2 기술 스택", 2);
e.addTable(stackTable);
e.addHeading("3. 개발 범위(WBS) — 미개발 가정", 1);
for (const [k, items] of Object.entries(wbs)) {
  e.addHeading("3." + k + " " + titles[k], 2);
  for (const item of items) line("• " + item);
}
e.addHeading("3.범위 제외", 2);
for (const t of [
  "타 브랜드 실게임",
  "실시간 멀티·길드·채팅",
  "이벤트 단발 게임",
  "네이티브 앱스토어 배포",
]) {
  line("• " + t);
}
e.addHeading("4. 공수·일반 외주 견적", 1);
e.addHeading("4.1 모듈별 공수", 2);
e.addTable(mmTable);
e.addHeading("4.2 일반 외주 금액", 2);
e.addTable(outsourceCost);
line("※ 참고: 약 1.8억~3.2억 원, 일정 4~6개월.");
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
line(
  "• 에셋·계정은 발주처 제공, WBS 초과는 변경관리, 금액 부가세 별도, 제안용 비구속",
);
e.addHeading("9. 총괄 요약", 1);
e.addTable(summary);
blank();
line(
  "권유 패키지: ① 개발 3개월·6,000만(분할) → ② 유지보수 12개월·월 200만 → ③ 6개월 단위 연장 → ④ 추가 개발 별도 견적",
);
blank();
line("제안자: ________________  연락처: ________________  일자: 2026-07-21");
line("— 끝 —");

await e.saveToFile(OUT);

const z = await JSZip.loadAsync(fs.readFileSync(OUT));
const names = Object.keys(z.files);
if (!names.includes("mimetype") || !names.includes("Contents/section0.xml")) {
  throw new Error("Invalid HWPX: " + names.join(", "));
}
const mt = await z.file("mimetype").async("string");
if (mt !== "application/hwp+zip") throw new Error("Bad mimetype: " + mt);

console.log("Wrote", OUT);
console.log("Size", fs.statSync(OUT).size);
console.log("Entries", names.join(", "));
