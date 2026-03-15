import { useEffect, useRef, useCallback } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { cpp } from '@codemirror/lang-cpp'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { highlightSelectionMatches } from '@codemirror/search'

interface Props {
  code: string
  onChange?: (code: string) => void
  readOnly?: boolean
  height?: string
  language?: 'javascript' | 'glsl'
}

export default function CodeEditor({ code, onChange, readOnly = false, height = '300px', language = 'javascript' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Debounced onChange
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const handleChange = useCallback((newCode: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChangeRef.current?.(newCode)
    }, 300)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const extensions = [
      language === 'glsl' ? cpp() : javascript({ typescript: true }),
      oneDark,
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      bracketMatching(),
      closeBrackets(),
      foldGutter(),
      indentOnInput(),
      highlightSelectionMatches(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...closeBracketsKeymap]),
      EditorView.theme({
        '&': {
          fontSize: '12px',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        },
        '.cm-content': { padding: '8px 0' },
        '.cm-gutters': { background: '#0d0d1a', borderRight: '1px solid rgba(255,255,255,0.06)' },
        '.cm-activeLineGutter': { background: 'rgba(255,255,255,0.03)' },
        '&.cm-focused .cm-cursor': { borderLeftColor: '#6366f1' },
      }),
    ]

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true))
      extensions.push(EditorView.editable.of(false))
    } else {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            handleChange(update.state.doc.toString())
          }
        }),
      )
    }

    const state = EditorState.create({
      doc: code,
      extensions,
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Recreate editor when readOnly or language changes; code updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, language])

  // Update content if code prop changes externally (without recreating editor)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== code) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: code },
      })
    }
  }, [code])

  return (
    <div
      ref={containerRef}
      style={{ maxHeight: height, overflow: 'auto' }}
    />
  )
}
