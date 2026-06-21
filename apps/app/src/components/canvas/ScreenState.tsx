/**
 * 加载/错误状态屏幕
 */
export function ScreenState({ title, description }: { title: string; description: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#141414]">
      <div className="rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] px-8 py-6 text-center">
        <h2 className="m-0 text-lg font-semibold text-[#e5e5e5]">{title}</h2>
        <p className="mt-2 text-[13px] text-[#999999]">{description}</p>
      </div>
    </main>
  )
}
