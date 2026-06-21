import { useMemo } from 'react'
import type { Node } from '@xyflow/react'
import type { PipelineCharacterDto, PipelineLocationDto, PipelineShotDto } from '@super-app/contracts/pipeline'
import { PipelineArtifactInfoButtonWithDialog } from './PipelineArtifactInfoButton'
import type { PipelineNodeData } from '../pipeline/types'

export function PipelineDetailPanel({ selectedNode }: { selectedNode: Node | null }) {
  const content = useMemo(() => {
    if (!selectedNode) return null
    const data = selectedNode.data as unknown as PipelineNodeData

    if (data.phase === 'character' && data.entityData) {
      const c = data.entityData as PipelineCharacterDto
      return (
        <div className="space-y-4">
          <h3 className="m-0 text-base font-bold">{c.name}</h3>
          {c.referenceImageUrl && <img src={c.referenceImageUrl} alt={c.name} className="w-full rounded-xl" />}
          <p className="m-0 text-[13px] text-[#999999]">角色: {c.role || '未设定'}</p>
          {c.description && <p className="m-0 text-[13px] text-[#888888]">{c.description}</p>}
          {c.identityPrompt && (
            <details className="text-[12px] text-[#777777]">
              <summary className="cursor-pointer">Identity Prompt</summary>
              <pre className="mt-2 whitespace-pre-wrap text-[11px]">{c.identityPrompt}</pre>
            </details>
          )}
          <PipelineArtifactInfoButtonWithDialog
            title={c.name}
            fields={[
              { label: '角色名', value: c.name, copyable: true },
              { label: '角色', value: c.role },
              { label: '描述', value: c.description },
              { label: 'Identity Prompt', value: c.identityPrompt, copyable: true },
              { label: 'Negative Prompt', value: c.negativePrompt, copyable: true },
              { label: '参考图 URL', value: c.referenceImageUrl },
              { label: '三视图 URL', value: c.turnaroundSheetUrl },
            ]}
          />
        </div>
      )
    }

    if (data.phase === 'location' && data.entityData) {
      const l = data.entityData as PipelineLocationDto
      return (
        <div className="space-y-4">
          <h3 className="m-0 text-base font-bold">{l.name}</h3>
          {l.referenceImageUrl && <img src={l.referenceImageUrl} alt={l.name} className="w-full rounded-xl" />}
          <p className="m-0 text-[13px] text-[#999999]">类型: {l.type}</p>
          {l.scenePrompt && (
            <details className="text-[12px] text-[#777777]">
              <summary className="cursor-pointer">Scene Prompt</summary>
              <pre className="mt-2 whitespace-pre-wrap text-[11px]">{l.scenePrompt}</pre>
            </details>
          )}
          <PipelineArtifactInfoButtonWithDialog
            title={l.name}
            fields={[
              { label: '场景名', value: l.name, copyable: true },
              { label: '类型', value: l.type },
              { label: 'Scene Prompt', value: l.scenePrompt, copyable: true },
              { label: 'Negative Prompt', value: l.negativePrompt, copyable: true },
              { label: '参考图 URL', value: l.referenceImageUrl },
            ]}
          />
        </div>
      )
    }

    if (data.phase === 'shot' && data.entityData) {
      const s = data.entityData as PipelineShotDto
      return (
        <div className="space-y-4">
          <h3 className="m-0 text-base font-bold">{`镜头 #${s.shotIndex + 1}`}</h3>
          {s.videoUrl && <video src={s.videoUrl} controls className="w-full rounded-xl" />}
          <p className="m-0 text-[13px] text-[#999999]">时长: {s.duration}s</p>
          <p className="m-0 text-[13px] text-[#888888]">{s.narrative}</p>
          {s.videoPrompt && (
            <details className="text-[12px] text-[#777777]">
              <summary className="cursor-pointer">Video Prompt</summary>
              <pre className="mt-2 whitespace-pre-wrap text-[11px]">{s.videoPrompt}</pre>
            </details>
          )}
          <PipelineArtifactInfoButtonWithDialog
            title={`镜头 #${s.shotIndex + 1}`}
            fields={[
              { label: '镜头编号', value: String(s.shotIndex + 1) },
              { label: '叙事', value: s.narrative },
              { label: '时长', value: `${s.duration ?? 5}s` },
              { label: 'Video Prompt', value: s.videoPrompt, copyable: true },
              { label: 'Negative Prompt', value: s.negativePrompt, copyable: true },
              { label: '视频 URL', value: s.videoUrl },
            ]}
          />
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <h3 className="m-0 text-base font-bold">{data.label}</h3>
        <p className="m-0 text-[13px] text-[#999999]">状态: {data.status}</p>
        {data.errorMessage && (
          <p className="m-0 rounded-lg bg-red-500/10 p-3 text-[12px] text-red-400">{data.errorMessage}</p>
        )}
      </div>
    )
  }, [selectedNode])

  return content ? (
    <aside className="w-[320px] shrink-0 overflow-y-auto border-l border-[#2a2a2a] bg-[#181818] p-4">
      {content}
    </aside>
  ) : null
}
