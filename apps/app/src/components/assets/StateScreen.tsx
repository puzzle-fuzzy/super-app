import { panelKicker } from '../../utils/asset-helpers'

export function StateScreen({ title, description }: { title: string; description: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#141414] p-10 text-center">
      <div>
        <p className={panelKicker}>Super 素材库</p>
        <h1 className="mt-2.5 text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#e5e5e5]">
          {title}
        </h1>
        <p className="text-[#999999]">{description}</p>
      </div>
    </main>
  )
}
