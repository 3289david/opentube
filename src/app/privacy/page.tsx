export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 text-gray-300">
      <h1 className="text-3xl font-bold text-white mb-2">개인정보 처리방침</h1>
      <p className="text-gray-500 text-sm mb-8">최종 수정일: 2026년 6월 4일</p>

      <div className="space-y-8 text-sm leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">제1조 (수집하는 정보)</h2>
          <p className="mb-3">본 서비스는 최소한의 정보만 수집합니다:</p>
          <div className="bg-[#1a1a1a] rounded-lg p-4 space-y-2 text-gray-400">
            <div className="flex gap-3"><span className="text-white w-32 flex-shrink-0">세션 식별자</span><span>익명 랜덤 UUID (이름, 이메일 등 개인정보 없음)</span></div>
            <div className="flex gap-3"><span className="text-white w-32 flex-shrink-0">시청 기록</span><span>로컬 DB에만 저장, 외부 전송 없음</span></div>
            <div className="flex gap-3"><span className="text-white w-32 flex-shrink-0">다운로드 목록</span><span>로컬 서버 DB에만 저장</span></div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">제2조 (정보 이용 목적)</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-400">
            <li>서비스 기능 제공 (라이브러리, 시청 기록, 추천 등)</li>
            <li>세션 간 데이터 격리 (다른 사용자와 데이터 분리)</li>
            <li>시청 위치 저장 (이어보기 기능)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">제3조 (제3자 제공)</h2>
          <p className="mb-2">수집된 정보는 외부에 제공되지 않습니다. 단, 서비스 특성상 다음 외부 서비스에 일부 요청이 전달됩니다:</p>
          <div className="bg-[#1a1a1a] rounded-lg p-4 space-y-2 text-gray-400">
            <div className="flex gap-3"><span className="text-white w-32 flex-shrink-0">YouTube API</span><span>영상 메타데이터, 검색 결과 조회 (Google LLC)</span></div>
            <div className="flex gap-3"><span className="text-white w-32 flex-shrink-0">yt-dlp</span><span>영상 다운로드 (로컬 처리, 외부 전송 없음)</span></div>
            <div className="flex gap-3"><span className="text-white w-32 flex-shrink-0">GitHub (선택)</span><span>yt-dlp 컴포넌트 로딩 (원격 EJS 컴포넌트)</span></div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">제4조 (정보 보관 및 삭제)</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-400">
            <li>모든 데이터는 로컬 서버(SQLite DB)에만 저장됩니다.</li>
            <li>설정 &gt; 데이터 초기화 메뉴에서 언제든지 모든 데이터를 삭제할 수 있습니다.</li>
            <li>세션 토큰은 브라우저 localStorage에 저장됩니다 (서버에 비밀번호 저장 없음).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">제5조 (익명성 원칙)</h2>
          <p>본 서비스는 완전 익명을 원칙으로 합니다. 회원가입, 이메일, 전화번호 등 개인 식별 정보를 수집하지 않습니다. 세션 닉네임은 무작위로 생성되며 본인이 선택할 수 없습니다.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">제6조 (쿠키 및 추적)</h2>
          <p>본 서비스는 광고 쿠키, 추적 코드, 분석 도구를 사용하지 않습니다. 세션 유지를 위한 토큰만 localStorage에 저장됩니다.</p>
        </section>

        <div className="border-t border-[#333] pt-6 text-xs text-gray-600">
          <p>개인정보 관련 문의: 본 서비스는 개인 운영 서비스입니다.</p>
        </div>
      </div>
    </div>
  )
}
