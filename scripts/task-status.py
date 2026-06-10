#!/usr/bin/env python3
"""docs/tasks/ 파이프라인 작업 현황을 표로 출력한다.

각 작업 폴더(docs/tasks/<YYYY-MM-DD>-<slug>/)에 대해 research.md /
implementation.md / qa-report.md 존재 여부와 qa-report.md의 판정을 한 줄로 보여준다.
파일 규약: .claude/skills/README.md (인계 계약), .claude/skills/qa/SKILL.md (판정 형식)
"""

import re
import sys
from pathlib import Path

STAGE_FILES = ("research.md", "implementation.md", "qa-report.md")
VERDICTS = ("CONDITIONAL PASS", "PASS", "FAIL")  # 긴 것 먼저 매칭
VERDICT_LINE = re.compile(r"^-\s*판정\s*:\s*(.+)$")

PRESENT = "O"
ABSENT = "-"


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def parse_verdict(qa_report: Path) -> str:
    try:
        text = qa_report.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return "읽기 실패(인코딩)"
    except OSError:
        return "읽기 실패"
    for line in text.splitlines():
        m = VERDICT_LINE.match(line.strip())
        if m:
            value = m.group(1).strip()
            for verdict in VERDICTS:
                if value.upper().startswith(verdict):
                    return verdict
            return value  # 규약 외 값은 그대로 노출
    return ABSENT


def collect_rows(tasks_dir: Path) -> list[tuple[str, str, str, str, str]]:
    rows = []
    for folder in sorted(p for p in tasks_dir.iterdir() if p.is_dir()):
        present = [PRESENT if (folder / f).is_file() else ABSENT for f in STAGE_FILES]
        verdict = parse_verdict(folder / "qa-report.md") if present[2] == PRESENT else ABSENT
        rows.append((folder.name, *present, verdict))
    return rows


def main() -> int:
    # Windows에서 파이프 출력 시 로케일 인코딩(cp949)으로 한글이 깨지는 것 방지
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    tasks_dir = repo_root() / "docs" / "tasks"
    if not tasks_dir.is_dir():
        print(f"docs/tasks 폴더가 없습니다: {tasks_dir}")
        return 0
    rows = collect_rows(tasks_dir)
    if not rows:
        print(f"작업 폴더가 없습니다: {tasks_dir}")
        return 0

    headers = ("작업 폴더", "research", "implementation", "qa", "판정")
    widths = [max(len(headers[i]), *(len(r[i]) for r in rows)) for i in range(len(headers))]
    line = "  ".join(h.ljust(widths[i]) for i, h in enumerate(headers))
    print(line)
    print("  ".join("-" * w for w in widths))
    for row in rows:
        print("  ".join(cell.ljust(widths[i]) for i, cell in enumerate(row)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
