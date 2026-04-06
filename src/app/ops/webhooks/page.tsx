import { AppShell } from "@/components/app-shell";
import { WebhookOpsClient } from "@/components/webhook-ops-client";

export default function WebhookOpsPage() {
  return (
    <AppShell
      eyebrow="웹훅 운영"
      title="Sweetbook 웹훅 운영 패널"
      description="등록, 테스트 전송, 최근 전송 이력과 실제 수신 이벤트를 한 화면에서 점검하면서 중복 delivery와 검증 실패까지 한 번에 확인할 수 있도록 구성했습니다."
      aside={
        <div className="space-y-4">
          <article className="soft-card rounded-[28px] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow text-[11px] font-semibold">운영 기준</p>
                <h3 className="mt-3 font-display text-3xl leading-none text-slate-900">
                  등록 즉시 확인하고, 이후엔 안전하게 숨기는 흐름
                </h3>
              </div>
              <span className="gradient-chip rounded-full px-3 py-1 text-[11px] font-semibold text-[var(--accent)]">
                실시간
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["시크릿", "첫 등록 응답에만 전체 노출"],
                ["검증", "timestamp.payload HMAC-SHA256"],
                ["재시도", "2xx 실패 시 최대 3회 재전송"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.82)] px-4 py-4"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                    {label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="soft-card rounded-[28px] p-5">
            <p className="text-sm font-semibold text-slate-900">운영 메모</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              실제 운영 전환 시에는 `X-Webhook-Delivery`로 중복 수신을 막고, 30초 안에
              응답한 뒤 무거운 후속 처리는 비동기로 넘기는 구조가 안전합니다. 현재 화면은
              같은 deliveryUid를 그룹으로 묶고, 검증 실패와 시크릿 미설정 상태를 따로
              드러내도록 구성했습니다.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["중복 delivery 그룹화", "비동기 후속 처리", "시크릿 상태 노출"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[var(--line)] bg-white/75 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {item}
                </span>
              ))}
            </div>
          </article>
        </div>
      }
    >
      <WebhookOpsClient />
    </AppShell>
  );
}
