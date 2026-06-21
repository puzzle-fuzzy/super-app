import { Save } from 'lucide-react'
import { Select } from '@super-app/ui-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogKicker,
  DialogBody,
} from '@/components/ui/dialog'

import type { AssetDto } from '@super-app/contracts/assets'
import type { SubjectType } from '@super-app/contracts/subject-assets'
import type { StyleType } from '@super-app/contracts/style-assets'
import type { TemplateType } from '@super-app/contracts/template-assets'
import type { TextType } from '@super-app/contracts/text-assets'
import type {
  TextEditorState,
  SubjectEditorState,
  StyleEditorState,
  TemplateEditorState,
  EditorState,
} from '../../hooks/useAssetsData'
import {
  TEXT_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
  SUBJECT_TYPE_OPTIONS,
  CONSISTENCY_OPTIONS,
  STYLE_TYPE_OPTIONS,
  TEMPLATE_TYPE_OPTIONS,
  fieldClass,
  fieldLabel,
  fieldControl,
} from '../../utils/asset-helpers'

export function EditorPanel({
  editor,
  saving,
  setEditor,
  onCancel,
  onSave,
}: {
  editor: Exclude<EditorState, null>
  saving: boolean
  setEditor: (editor: Exclude<EditorState, null>) => void
  onCancel: () => void
  onSave: () => void
}) {
  const title =
    (editor.id ? '编辑' : '新建') +
    (editor.kind === 'text'
      ? '文本'
      : editor.kind === 'subject'
        ? '主体'
        : editor.kind === 'style'
          ? '风格'
          : '模板')

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="max-w-[680px] flex flex-col">
        <DialogHeader>
          <DialogKicker>创作编辑</DialogKicker>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-3.75">
            <label className={fieldClass}>
              <span className={fieldLabel}>标题</span>
              <input
                className={fieldControl}
                value={editor.title}
                onChange={(event) => setEditor({ ...editor, title: event.target.value })}
              />
            </label>

            {editor.kind === 'text' ? (
              <TextEditorFields editor={editor} setEditor={setEditor} />
            ) : editor.kind === 'subject' ? (
              <SubjectEditorFields editor={editor} setEditor={setEditor} />
            ) : editor.kind === 'style' ? (
              <StyleEditorFields editor={editor} setEditor={setEditor} />
            ) : (
              <TemplateEditorFields editor={editor} setEditor={setEditor} />
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" className="h-10 rounded-[10px] px-5 text-[13px] font-medium" onClick={onCancel} disabled={saving}>
            取消
          </Button>
          <Button className="h-10 rounded-[10px] px-5 text-sm font-semibold" onClick={onSave} disabled={saving}>
            <Save size={15} aria-hidden="true" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TextEditorFields({
  editor,
  setEditor,
}: {
  editor: TextEditorState
  setEditor: (editor: TextEditorState) => void
}) {
  return (
    <>
      <div className={fieldClass}>
        <span className={fieldLabel}>类型</span>
        <Select
          options={TEXT_TYPE_OPTIONS}
          value={editor.textType}
          onChange={(value) => setEditor({ ...editor, textType: value as TextType })}
        />
      </div>
      <div className={fieldClass}>
        <span className={fieldLabel}>语言</span>
        <Select
          options={LANGUAGE_OPTIONS}
          value={editor.language || 'zh'}
          onChange={(value) => setEditor({ ...editor, language: value })}
        />
      </div>
      <label className={fieldClass}>
        <span className={fieldLabel}>正文</span>
        <textarea
          className={`${fieldControl} leading-relaxed`}
          rows={12}
          value={editor.content}
          onChange={(event) => setEditor({ ...editor, content: event.target.value })}
        />
      </label>
    </>
  )
}

function SubjectEditorFields({
  editor,
  setEditor,
}: {
  editor: SubjectEditorState
  setEditor: (editor: SubjectEditorState) => void
}) {
  return (
    <>
      <div className={fieldClass}>
        <span className={fieldLabel}>主体类型</span>
        <Select
          options={SUBJECT_TYPE_OPTIONS}
          value={editor.subjectType}
          onChange={(value) => setEditor({ ...editor, subjectType: value as SubjectType })}
        />
      </div>
      <label className={fieldClass}>
        <span className={fieldLabel}>显示名称</span>
        <input
          className={fieldControl}
          value={editor.displayName}
          onChange={(event) => setEditor({ ...editor, displayName: event.target.value })}
        />
      </label>
      <label className={fieldClass}>
        <span className={fieldLabel}>身份提示词</span>
        <textarea
          className={`${fieldControl} leading-relaxed`}
          rows={3}
          value={editor.identityPrompt}
          onChange={(event) => setEditor({ ...editor, identityPrompt: event.target.value })}
        />
      </label>
      <label className={fieldClass}>
        <span className={fieldLabel}>外观提示词</span>
        <textarea
          className={`${fieldControl} leading-relaxed`}
          rows={3}
          value={editor.appearancePrompt}
          onChange={(event) => setEditor({ ...editor, appearancePrompt: event.target.value })}
        />
      </label>
      <label className={fieldClass}>
        <span className={fieldLabel}>负面提示词</span>
        <textarea
          className={`${fieldControl} leading-relaxed`}
          rows={3}
          value={editor.negativePrompt}
          onChange={(event) => setEditor({ ...editor, negativePrompt: event.target.value })}
        />
      </label>
      <div className={fieldClass}>
        <span className={fieldLabel}>一致性</span>
        <Select
          options={[...CONSISTENCY_OPTIONS]}
          value={editor.consistencyLevel}
          onChange={(value) =>
            setEditor({
              ...editor,
              consistencyLevel: value as 'low' | 'medium' | 'high',
            })
          }
        />
      </div>
    </>
  )
}

function StyleEditorFields({
  editor,
  setEditor,
}: {
  editor: StyleEditorState
  setEditor: (editor: StyleEditorState) => void
}) {
  return (
    <>
      <div className={fieldClass}>
        <span className={fieldLabel}>风格类型</span>
        <Select
          options={STYLE_TYPE_OPTIONS}
          value={editor.styleType}
          onChange={(value) => setEditor({ ...editor, styleType: value as StyleType })}
        />
      </div>
      <label className={fieldClass}>
        <span className={fieldLabel}>正向提示词</span>
        <textarea
          className={`${fieldControl} leading-relaxed`}
          rows={3}
          value={editor.positivePrompt}
          onChange={(event) => setEditor({ ...editor, positivePrompt: event.target.value })}
        />
      </label>
      <label className={fieldClass}>
        <span className={fieldLabel}>负面提示词</span>
        <textarea
          className={`${fieldControl} leading-relaxed`}
          rows={3}
          value={editor.negativePrompt}
          onChange={(event) => setEditor({ ...editor, negativePrompt: event.target.value })}
        />
      </label>
      <label className={fieldClass}>
        <span className={fieldLabel}>推荐模型（可选）</span>
        <input
          className={fieldControl}
          value={editor.recommendedModel}
          onChange={(event) => setEditor({ ...editor, recommendedModel: event.target.value })}
        />
      </label>
      <label className={fieldClass}>
        <span className={fieldLabel}>调色板 JSON（可选，如 {`{"warm":["#d4a574"]}`})</span>
        <textarea
          className={`${fieldControl} font-mono text-[13px] leading-relaxed`}
          rows={3}
          value={editor.colorPalette}
          onChange={(event) => setEditor({ ...editor, colorPalette: event.target.value })}
        />
      </label>
      <label className={fieldClass}>
        <span className={fieldLabel}>推荐参数 JSON（可选，如 {`{"steps":30}`})</span>
        <textarea
          className={`${fieldControl} font-mono text-[13px] leading-relaxed`}
          rows={3}
          value={editor.recommendedParams}
          onChange={(event) => setEditor({ ...editor, recommendedParams: event.target.value })}
        />
      </label>
    </>
  )
}

function TemplateEditorFields({
  editor,
  setEditor,
}: {
  editor: TemplateEditorState
  setEditor: (editor: TemplateEditorState) => void
}) {
  return (
    <>
      <div className={fieldClass}>
        <span className={fieldLabel}>模板类型</span>
        <Select
          options={TEMPLATE_TYPE_OPTIONS}
          value={editor.templateType}
          onChange={(value) => setEditor({ ...editor, templateType: value as TemplateType })}
        />
      </div>
      <label className={fieldClass}>
        <span className={fieldLabel}>模板数据 JSON（可选，如 {`{"nodes":[],"layers":[]}`})</span>
        <textarea
          className={`${fieldControl} font-mono text-[13px] leading-relaxed`}
          rows={8}
          value={editor.templateData}
          onChange={(event) => setEditor({ ...editor, templateData: event.target.value })}
        />
      </label>
    </>
  )
}

export function DeleteConfirm({
  asset,
  onCancel,
  onConfirm,
}: {
  asset: AssetDto
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogKicker>确认删除</DialogKicker>
          <DialogTitle>删除「{asset.title}」？</DialogTitle>
        </DialogHeader>
        <p className="text-sm leading-relaxed text-[#999999] px-6 pb-5">
          这个素材会从当前列表移除。之后的恢复能力会在资产回收站阶段加入。
        </p>
        <DialogFooter>
          <Button variant="ghost" className="h-10 rounded-[10px] px-5 text-[13px] font-medium" onClick={onCancel}>
            取消
          </Button>
          <Button variant="destructive" className="h-10 rounded-[10px] px-5 text-sm font-semibold" onClick={onConfirm}>
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
