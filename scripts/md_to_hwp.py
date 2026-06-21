"""Markdown -> HWPX -> HWP 변환 스크립트 (한/글이 설치된 Windows 환경)."""
from __future__ import annotations

import sys
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent / "docs"

FILES = [
    ("제안서_YK건기_브랜드_캐주얼_게임.md", "제안서_YK건기_브랜드_캐주얼_게임"),
    ("견적서_YK건기_브랜드_캐주얼_게임.md", "견적서_YK건기_브랜드_캐주얼_게임"),
]


def md_to_hwpx(md_path: Path, hwpx_path: Path) -> None:
    from pyhwpxlib.api import convert_md_file_to_hwpx

    convert_md_file_to_hwpx(str(md_path), str(hwpx_path))


def hwpx_to_hwp(hwpx_path: Path, hwp_path: Path) -> None:
    from pyhwpx import Hwp

    hwp = Hwp(visible=False)
    try:
        ok = hwp.open(str(hwpx_path))
        if not ok:
            raise RuntimeError(f"한/글에서 파일을 열 수 없습니다: {hwpx_path}")
        ok = hwp.save_as(str(hwp_path), format="HWP")
        if not ok:
            raise RuntimeError(f"HWP 저장 실패: {hwp_path}")
    finally:
        try:
            hwp.quit()
        except Exception:
            pass


def main() -> int:
    for md_name, base_name in FILES:
        md_path = DOCS / md_name
        hwpx_path = DOCS / f"{base_name}.hwpx"
        hwp_path = DOCS / f"{base_name}.hwp"

        if not md_path.exists():
            print(f"[SKIP] 없음: {md_path}")
            continue

        print(f"[1/2] MD -> HWPX: {md_path.name}")
        md_to_hwpx(md_path, hwpx_path)
        print(f"      -> {hwpx_path}")

        print(f"[2/2] HWPX -> HWP: {hwpx_path.name}")
        try:
            hwpx_to_hwp(hwpx_path, hwp_path)
            print(f"      -> {hwp_path}")
        except Exception as exc:
            print(f"[WARN] HWP 변환 실패 ({exc})")
            print(f"       HWPX 파일을 한/글에서 열어 '다른 이름으로 저장' -> HWP 로 변환하세요.")
            print(f"       파일: {hwpx_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
