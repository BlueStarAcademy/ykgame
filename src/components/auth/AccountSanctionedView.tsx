import Link from "next/link";

export function AccountSanctionedView({
  nickname,
  reason,
}: {
  nickname: string;
  reason: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 py-6">
      <section className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-5 shadow-lg">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-500">
          Account Restricted
        </p>
        <h1 className="mt-2 text-xl font-black text-slate-900">게임 입장이 제한되었습니다</h1>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-bold text-slate-800">{nickname}</span> 계정은 현재 이용이
          정지되어 홈·게임에 입장할 수 없습니다.
        </p>
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-500">
            제재 사유
          </p>
          <p className="mt-1.5 text-sm font-bold leading-relaxed text-red-800">{reason}</p>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
          문의가 필요하면 운영 채널로 연락해 주세요. 제재가 해제되면 다시 이용할 수
          있습니다.
        </p>
        <Link
          href="/"
          className="mt-5 flex w-full items-center justify-center rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800"
        >
          랜딩으로 돌아가기
        </Link>
      </section>
    </div>
  );
}
