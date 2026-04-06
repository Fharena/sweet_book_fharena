import { AppShell } from "@/components/app-shell";
import { DeliveryHubClient } from "@/components/delivery-hub-client";

export default function LaunchpadPage() {
  return (
    <AppShell
      eyebrow="데모 / 제출 허브"
      title="현재 세션, 백엔드 상태, 제출 흐름을 한곳에서 관리합니다."
      description="Triplogue의 샘플 세션, 실사진 draft, 테스트 책, 주문 결과, 웹훅 운영 진입점을 한 화면에 모았습니다. 발표 전 점검과 디버깅 기준점으로 바로 쓸 수 있습니다."
      aside={
        <div className="space-y-4">
          <article className="soft-card rounded-[28px] p-5">
            <p className="section-kicker">허브 목적</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              이 화면은 기능을 새로 만드는 곳이 아니라, 이미 만든 흐름을 빠르게 확인하고
              제출 직전 상태를 점검하기 위한 컨트롤 센터입니다.
            </p>
          </article>

          <article className="soft-card rounded-[28px] p-5">
            <p className="text-sm font-semibold text-slate-900">권장 사용 순서</p>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              <li>1. 샘플 세션 불러오기</li>
              <li>2. 검토/미리보기/주문 이동</li>
              <li>3. 웹훅 운영으로 추적 확인</li>
              <li>4. 제출 체크리스트 문서와 대조</li>
            </ol>
          </article>
        </div>
      }
    >
      <DeliveryHubClient />
    </AppShell>
  );
}
