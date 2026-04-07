import { readFileSync } from "node:fs";
import path from "node:path";

import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { BackendHealthCard } from "@/components/backend-health-card";

type DocSection = {
  id: string;
  title: string;
  description: string;
  fileName: string;
};

const docSections: DocSection[] = [
  {
    id: "demo-script",
    title: "5분 데모 스크립트",
    description: "발표 흐름과 핵심 멘트를 빠르게 다시 맞추는 문서입니다.",
    fileName: "demo-script.md",
  },
  {
    id: "submission-checklist",
    title: "제출 체크리스트",
    description: "제출 직전 환경 변수, 화면, 문서 누락 여부를 다시 점검합니다.",
    fileName: "submission-checklist.md",
  },
  {
    id: "operations-runbook",
    title: "운영/주문 런북",
    description: "실제 주문과 웹훅 운영 검증 순서를 따라갈 때 쓰는 문서입니다.",
    fileName: "operations-order-runbook.md",
  },
  {
    id: "git-rules",
    title: "Git 운영 규칙",
    description: "작업 브랜치와 기준 PR, merge 기준을 고정한 문서입니다.",
    fileName: "git-operation-rules.md",
  },
];

function readDocContent(fileName: string) {
  const filePath = path.join(process.cwd(), "docs", fileName);

  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "문서를 읽지 못했습니다. docs 폴더와 파일 경로를 다시 확인해 주세요.";
  }
}

export default function OpsDocsPage() {
  const sections = docSections.map((section) => ({
    ...section,
    content: readDocContent(section.fileName),
  }));

  return (
    <AppShell
      eyebrow="운영 문서"
      title="발표와 제출 문서를 앱 안에서 바로 확인합니다."
      description="launchpad에서 연결되는 발표, 제출, 주문 운영 문서를 한 화면에 모았습니다. 브라우저 안에서 바로 열어보고 데모 직전 점검 기준으로 쓸 수 있습니다."
      aside={
        <div className="space-y-4">
          <article className="soft-card rounded-[28px] p-5">
            <p className="section-kicker">문서 사용 순서</p>
            <ol className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
              <li>1. 데모 스크립트로 발표 흐름 확인</li>
              <li>2. 체크리스트로 누락 항목 점검</li>
              <li>3. 주문/웹훅 런북으로 실제 운영 순서 점검</li>
              <li>4. Git 규칙으로 브랜치와 PR 기준 확인</li>
            </ol>
          </article>

          <article className="soft-card rounded-[28px] p-5">
            <p className="text-sm font-semibold text-slate-900">빠른 이동</p>
            <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
              <p>
                <Link href="/ops/launchpad" className="font-semibold text-[var(--accent)]">
                  /ops/launchpad
                </Link>
                {" "}현재 세션과 제출 허브
              </p>
              <p>
                <Link href="/checkout" className="font-semibold text-[var(--accent)]">
                  /checkout
                </Link>
                {" "}테스트 책 생성과 주문 결과
              </p>
              <p>
                <Link href="/ops/webhooks" className="font-semibold text-[var(--accent)]">
                  /ops/webhooks
                </Link>
                {" "}운영 로그와 웹훅 테스트
              </p>
            </div>
          </article>

          <BackendHealthCard title="문서 확인 전 백엔드 상태" compact />
        </div>
      }
    >
      <div className="space-y-6">
        <section className="soft-card rounded-[32px] p-6">
          <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4">
            <p className="section-kicker">문서 목차</p>
            <p className="text-sm leading-6 text-slate-600">
              launchpad와 제출 직전 점검에서 자주 열어볼 문서를 바로 이동할 수 있게 구성했습니다.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {sections.map((section) => (
              <Link
                key={section.id}
                href={`#${section.id}`}
                className="rounded-full border border-[var(--line)] bg-white/82 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
              >
                {section.title}
              </Link>
            ))}
          </div>
        </section>

        {sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="soft-card rounded-[32px] p-6 scroll-mt-24"
          >
            <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4">
              <p className="section-kicker">{section.title}</p>
              <p className="text-sm leading-6 text-slate-600">{section.description}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                docs/{section.fileName}
              </p>
            </div>

            <pre className="mt-5 overflow-x-auto rounded-[28px] border border-[var(--line)] bg-[rgba(255,255,255,0.84)] px-5 py-5 text-sm leading-7 text-slate-700 whitespace-pre-wrap break-words">
              {section.content}
            </pre>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
