export function LoadingState() {
  return (
    <section
      className="flex min-h-[260px] items-center justify-center gap-2.5 text-sm text-[#999999]"
      aria-label="资产加载中"
    >
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-[#3a3a3a] border-t-[#e5e5e5]"
        aria-hidden="true"
      />
      <p className="m-0">正在加载素材...</p>
    </section>
  )
}
