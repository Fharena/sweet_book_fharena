import { AppShell } from "@/components/app-shell";
import { WebhookOpsClient } from "@/components/webhook-ops-client";

export default function WebhookOpsPage() {
  return (
    <AppShell
      eyebrow="Webhook Ops"
      title="Sweetbook 웹훅 운영 패널"
      description="등록, 테스트 전송, 최근 delivery 이력, 최근 수신 이벤트를 한 화면에서 점검하면서 주문 상태 이벤트를 안전하게 붙일 수 있도록 구성했습니다."
      aside={
        <div className="space-y-4">
          <article className="soft-card rounded-[28px] p-5">
            <p className="eyebrow text-[11px] font-semibold">문서 확인 포인트</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <li>최초 등록 응답에서만 전체 secretKey가 제공됩니다.</li>
              <li>서명 검증은 `timestamp.payload` 기준 HMAC-SHA256입니다.</li>
              <li>2xx 응답이 아니면 최대 3회 자동 재시도됩니다.</li>
            </ul>
          </article>

          <article className="soft-card rounded-[28px] p-5">
            <p className="text-sm font-semibold text-slate-900">운영 메모</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              실제 운영 전환 시에는 `X-Webhook-Delivery`로 중복 수신을 막고, 30초
              안에 응답한 뒤 무거운 후속 처리는 비동기로 넘기는 구조가 안전합니다.
            </p>
          </article>
        </div>
      }
    >
      <WebhookOpsClient />
    </AppShell>
  );
}
