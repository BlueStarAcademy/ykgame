import { readFileSync, writeFileSync } from "node:fs";

const FILES = {
  ko: "messages/ko.json",
  en: "messages/en.json",
  ja: "messages/ja.json",
};

const PATCH = {
  ko: {
    "yanmar.scene": {
      navGuide: {
        dig: "흙더미",
        dump: "하역",
        crash: "파쇄",
        stone: "석재",
      },
      digZone: "흙더미",
      digZoneNumbered: "흙더미 {index}",
      digZoneStatus: "{label} · 흙 {remaining} / {capacity}",
      dumpZone: "하역",
      soilUnload: "흙 하역",
      truckReturn: "복귀 {time}",
      tierExpand: "Lv.{level} 작업장 확장",
      levelUpBurst: "{level}레벨",
    },
    "yanmar.sitePrompt": {
      monument: "조형물",
      monumentEnter: "조형물 입장",
      monumentEnterAria: "조형물 입장, 수령 가능 스타 {stars}",
      monumentQuest: "미션 확인",
      monumentBuilding: "건설 현황",
      monumentClaimStars: "스타 수령 {stars}",
      monumentComplete: "건설완료",
      sportsMeetEnter: "운동회 입장",
      sportsMeetEnterAria: "운동회 입장, 입장권 {remaining}/{limit}",
      serviceBrand: "YK건기",
      serviceLabel: "서비스지점",
      serviceAria: "YK건기 서비스지점 열기",
      serviceAriaClaimable: "YK건기 서비스지점 열기, 교환 가능 {count}개",
      workshopManage: "관리하기",
      workshopOpenAria: "{name} 열기",
      workshopOpenAriaClaimable: "{name} 열기, 완료 퀘스트 {count}개",
    },
  },
  en: {
    "yanmar.scene": {
      navGuide: {
        dig: "Dirt pile",
        dump: "Unload",
        crash: "Breaker",
        stone: "Stone",
      },
      digZone: "Dirt pile",
      digZoneNumbered: "Dirt pile {index}",
      digZoneStatus: "{label} · Soil {remaining} / {capacity}",
      dumpZone: "Unload",
      soilUnload: "Soil unload",
      truckReturn: "Return {time}",
      tierExpand: "Lv.{level} site expansion",
      levelUpBurst: "Level {level}",
    },
    "yanmar.sitePrompt": {
      monument: "Monument",
      monumentEnter: "Enter monument",
      monumentEnterAria: "Enter monument, {stars} stars to claim",
      monumentQuest: "View mission",
      monumentBuilding: "Build status",
      monumentClaimStars: "Claim {stars} stars",
      monumentComplete: "Finish build",
      sportsMeetEnter: "Enter sports day",
      sportsMeetEnterAria: "Enter sports day, tickets {remaining}/{limit}",
      serviceBrand: "YK Machinery",
      serviceLabel: "Service center",
      serviceAria: "Open YK Machinery service center",
      serviceAriaClaimable:
        "Open YK Machinery service center, {count} exchanges available",
      workshopManage: "Manage",
      workshopOpenAria: "Open {name}",
      workshopOpenAriaClaimable: "Open {name}, {count} completed quests",
    },
  },
  ja: {
    "yanmar.scene": {
      navGuide: {
        dig: "土山",
        dump: "荷下ろし",
        crash: "破砕",
        stone: "石材",
      },
      digZone: "土山",
      digZoneNumbered: "土山 {index}",
      digZoneStatus: "{label} · 土 {remaining} / {capacity}",
      dumpZone: "荷下ろし",
      soilUnload: "土の荷下ろし",
      truckReturn: "帰還 {time}",
      tierExpand: "Lv.{level} 作業場拡張",
      levelUpBurst: "レベル{level}",
    },
    "yanmar.sitePrompt": {
      monument: "モニュメント",
      monumentEnter: "モニュメント入場",
      monumentEnterAria: "モニュメント入場、受取可能スター {stars}",
      monumentQuest: "ミッション確認",
      monumentBuilding: "建設状況",
      monumentClaimStars: "スター受取 {stars}",
      monumentComplete: "建設完了",
      sportsMeetEnter: "運動会入場",
      sportsMeetEnterAria: "運動会入場、入場券 {remaining}/{limit}",
      serviceBrand: "YK建機",
      serviceLabel: "サービス拠点",
      serviceAria: "YK建機サービス拠点を開く",
      serviceAriaClaimable: "YK建機サービス拠点を開く、交換可能 {count}件",
      workshopManage: "管理する",
      workshopOpenAria: "{name} を開く",
      workshopOpenAriaClaimable: "{name} を開く、完了クエスト {count}件",
    },
  },
};

function setPath(root, dottedPath, value) {
  const parts = dottedPath.split(".");
  let node = root;
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== "object" || node[part] === null) node[part] = {};
    node = node[part];
  }
  const leaf = parts.at(-1);
  node[leaf] = { ...(node[leaf] ?? {}), ...value };
}

for (const [locale, file] of Object.entries(FILES)) {
  const json = JSON.parse(readFileSync(file, "utf8"));
  for (const [path, value] of Object.entries(PATCH[locale])) {
    setPath(json, path, value);
  }
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  console.log(`patched ${file}`);
}
