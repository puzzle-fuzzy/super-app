import { ArrowRight, Box, Image, Key, Send } from 'lucide-react'

import { clientEnv } from '@super-app/env/client'

const FEATURES = [
  {
    icon: Image,
    title: '资产库',
    desc: '上传、预览和管理图片、视频、音频、文档以及 AI 生成素材。',
    href: clientEnv.SUPER_PUBLIC_ASSETS_APP_URL,
  },
  {
    icon: Box,
    title: '画布',
    desc: '创建可视化项目，把资产拖入画布并保存为云端文档。',
    href: clientEnv.SUPER_PUBLIC_CANVAS_APP_URL,
  },
  {
    icon: Send,
    title: 'P2P 传输',
    desc: '点对点文件与文本传输，无需上传服务器即可在设备间交换。',
    href: clientEnv.SUPER_PUBLIC_TRANSFER_APP_URL,
  },
  {
    icon: Key,
    title: 'API 控制台',
    desc: '管理 API 密钥、查看调用记录并接入模型能力。',
    href: clientEnv.SUPER_PUBLIC_CONSOLE_APP_URL,
  },
]

export function SiteApp() {
  return (
    <main className="min-h-screen bg-[#141414] text-[#e5e5e5]">
      <section className="mx-auto w-full max-w-[1800px] px-8 py-8 pb-16 max-[920px]:px-4.5 max-[920px]:py-6 max-[620px]:px-3.5 max-[620px]:py-5">
        {/* Header */}
        <header className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-[#3a3a3a] text-sm font-bold text-[#999999]">
              S
            </span>
            <strong className="text-base font-semibold tracking-tight">Super</strong>
          </div>
          <a
            href={clientEnv.SUPER_PUBLIC_AUTH_APP_URL}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-[#e5e5e5] px-5 text-[13px] font-semibold text-[#141414] no-underline transition-colors hover:bg-white"
          >
            开始使用
            <ArrowRight size={15} />
          </a>
        </header>

        {/* Hero */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-bold tracking-[0.16em] text-[#666666]">
            UNIFIED CLOUD WORKSPACE
          </p>
          <h1 className="mx-auto mb-4 max-w-175 text-[clamp(40px,7vw,72px)] font-bold leading-[1.04] tracking-[-0.02em]">
            你的创意资产与 AI 工作区
          </h1>
          <p className="mx-auto mb-8 max-w-130 text-[17px] leading-[1.75] text-[#999999]">
            Super 提供资产上传、画布编辑、P2P 传输和模型接口管理，帮你把灵感变为成果。
          </p>
          <div className="flex items-center justify-center gap-3">
            <a
              href={clientEnv.SUPER_PUBLIC_AUTH_APP_URL}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-[#e5e5e5] px-6 text-[13px] font-semibold text-[#141414] no-underline transition-colors hover:bg-white"
            >
              免费注册
              <ArrowRight size={15} />
            </a>
            <a
              href={clientEnv.SUPER_PUBLIC_DOCS_URL}
              className="inline-flex h-10 cursor-pointer items-center rounded-[10px] border border-[#2a2a2a] bg-transparent px-6 text-[13px] font-medium text-[#e5e5e5] no-underline transition-colors hover:border-[#3a3a3a]"
            >
              查看文档
            </a>
          </div>
        </div>

        {/* Features */}
        <div className="mb-16 grid grid-cols-2 gap-3.5 max-[680px]:grid-cols-1">
          {FEATURES.map((feature) => (
            <a
              key={feature.title}
              href={feature.href}
              className="flex gap-4 rounded-[18px] border border-[#2a2a2a] bg-[#1c1c1c] p-6 text-[#e5e5e5] no-underline transition-all duration-160 hover:-translate-y-0.75 hover:border-[#3a3a3a] hover:bg-[#202020]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#2a2a2a] text-[#999999]">
                <feature.icon size={18} />
              </span>
              <div>
                <h3 className="mb-1.5 text-[17px] font-semibold tracking-[-0.01em]">
                  {feature.title}
                </h3>
                <p className="m-0 text-[14px] leading-[1.6] text-[#999999]">{feature.desc}</p>
              </div>
            </a>
          ))}
        </div>

        {/* Footer */}
        <footer className="border-t border-[#2a2a2a] pt-8 text-center">
          <p className="text-[13px] text-[#666666]">&copy; 2026 Super. All rights reserved.</p>
        </footer>
      </section>
    </main>
  )
}
