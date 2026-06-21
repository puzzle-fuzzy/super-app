import { useReactFlow } from '@xyflow/react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'

import type { NodeProps } from '@xyflow/react'
import type { TextNodeType } from '@/types'
import { NodeLayout } from '../NodeLayout'
import { cn } from '@super-app/ui-react'

type TextPrimitiveProps = NodeProps<TextNodeType> & { title: string }

/**
 * 文本原始模式 — TipTap 富文本编辑器（与 tersa 1:1 对齐）
 */
export function TextPrimitive({ data, id, type, title }: TextPrimitiveProps) {
  const { updateNodeData } = useReactFlow()

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: '输入内容…',
      }),
    ],
    content: data.content,
    immediatelyRender: false,
    onUpdate: ({ editor: editorInstance }) => {
      const json = editorInstance.getJSON()
      const text = editorInstance.getText()
      updateNodeData(id, { content: json, text })
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-invert max-w-none focus:outline-none',
      },
    },
  })

  // 创建时聚焦
  useEffect(() => {
    if (editor) {
      editor.chain().focus().run()
    }
  }, [editor])

  return (
    <NodeLayout className="p-0" id={id} title={title} type={type}>
      <div className="nowheel max-h-[30rem] overflow-auto rounded-3xl">
        <div
          className={cn(
            'size-full p-4 text-[13px] leading-relaxed text-[#e5e5e5]',
            '[&_p:first-child]:mt-0',
            '[&_p:last-child]:mb-0',
            '[&_.ProseMirror]:outline-none',
            '[&_.ProseMirror]:min-h-[48px]',
            '[&_p.is-editor-empty:first-child]:before:pointer-events-none',
            '[&_p.is-editor-empty:first-child]:before:float-left',
            '[&_p.is-editor-empty:first-child]:before:h-0',
            '[&_p.is-editor-empty:first-child]:before:text-[#666666]',
            '[&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
          )}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </NodeLayout>
  )
}
