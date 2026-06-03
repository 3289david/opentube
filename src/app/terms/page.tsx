export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 text-gray-300">
      <h1 className="text-3xl font-bold text-white mb-2">이용약관</h1>
      <p className="text-gray-500 text-sm mb-8">최종 수정일: 2026년 6월 4일</p>

      <div className="space-y-8 text-sm leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">제1조 (서비스 소개)</h2>
          <p>OpenTube(이하 "본 서비스")는 개인 사용 목적의 비공개 미디어 관리 도구입니다. 본 서비스는 사용자가 합법적으로 이용할 권리를 가진 콘텐츠를 개인 저장 및 관리하기 위한 목적으로 제공됩니다.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">제2조 (이용 조건)</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-400">
            <li>본 서비스는 오직 개인적, 비상업적 목적으로만 사용할 수 있습니다.</li>
            <li>사용자는 저작권법 및 관련 법령을 준수할 책임이 있습니다.</li>
            <li>저작권자의 허락 없이 콘텐츠를 다운로드하거나 배포하는 행위는 금지됩니다.</li>
            <li>본 서비스를 이용한 모든 법적 책임은 사용자 본인에게 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">제3조 (저작권 및 지식재산권)</h2>
          <p className="mb-2">본 서비스를 통해 접근하거나 저장된 콘텐츠의 저작권은 각 원저작자에게 있습니다. 사용자는 다음 사항을 준수해야 합니다:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-400">
            <li>개인 시청 목적 이외의 콘텐츠 복제·배포·공유 금지</li>
            <li>YouTube 서비스 약관(Terms of Service) 준수</li>
            <li>저작권법 제30조(사적 이용을 위한 복제) 범위 내에서만 이용</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">제4조 (면책 조항)</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-400">
            <li>본 서비스는 "있는 그대로(AS-IS)" 제공되며 어떠한 보증도 하지 않습니다.</li>
            <li>서비스 운영자는 사용자의 콘텐츠 이용으로 인한 법적 분쟁에 대해 책임지지 않습니다.</li>
            <li>서비스 중단, 데이터 손실 등에 대한 책임을 지지 않습니다.</li>
            <li>본 서비스는 YouTube와 무관한 독립적인 도구입니다. YouTube, Google LLC와 제휴 관계가 없습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">제5조 (서비스 변경 및 종료)</h2>
          <p>서비스 운영자는 사전 고지 없이 서비스를 변경하거나 종료할 수 있습니다. 이로 인한 손해에 대해 책임을 지지 않습니다.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">제6조 (준거법)</h2>
          <p>본 약관은 대한민국 법률에 따라 해석되며, 분쟁 발생 시 대한민국 법원을 관할 법원으로 합니다.</p>
        </section>

        <div className="border-t border-[#333] pt-6 text-xs text-gray-600">
          <p>본 약관에 동의하지 않으실 경우 서비스 이용을 중단해 주세요.</p>
          <p className="mt-1">문의: 본 서비스는 개인 운영 서비스입니다.</p>
        </div>
      </div>
    </div>
  )
}
