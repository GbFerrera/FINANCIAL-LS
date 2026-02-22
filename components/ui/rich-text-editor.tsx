 "use client"
 
 import { useEffect, useMemo, useRef } from "react"
 import { Button } from "@/components/ui/button"
 import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, WrapText, Strikethrough } from "lucide-react"
 import clsx from "clsx"
 
 type Props = {
   value: string
   onChange: (html: string) => void
   placeholder?: string
   className?: string
   height?: { min?: number | string; max?: number | string }
 }
 
 function isHtmlLike(s: string) {
   return /<\/?[a-z][\s\S]*>/i.test(s)
 }
 
 function escapeHtml(s: string) {
   return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
 }
 
 export default function RichTextEditor({ value, onChange, placeholder, className, height }: Props) {
   const ref = useRef<HTMLDivElement | null>(null)
   const savedRangeRef = useRef<Range | null>(null)
   const observerAttached = useRef(false)
 
   const initialHtml = useMemo(() => {
     if (!value) return ""
     if (isHtmlLike(value)) return value
     return escapeHtml(value).replace(/\n/g, "<br>")
   }, [value])
 
   useEffect(() => {
     if (!ref.current) return
     if (ref.current.innerHTML !== initialHtml) {
       ref.current.innerHTML = initialHtml
     }
   }, [initialHtml])
 
   function inEditor(node: Node | null) {
     return !!ref.current && !!node && ref.current.contains(node)
   }
 
   function saveSelection() {
     const sel = window.getSelection()
     if (sel && sel.rangeCount > 0 && inEditor(sel.anchorNode)) {
       savedRangeRef.current = sel.getRangeAt(0)
     }
   }
 
   function restoreSelection() {
     const sel = window.getSelection()
     if (!sel) return
     sel.removeAllRanges()
     if (savedRangeRef.current) {
       sel.addRange(savedRangeRef.current)
     }
   }
 
   function focusEditor() {
     if (ref.current) ref.current.focus()
   }
 
   function exec(cmd: string, arg?: string) {
     focusEditor()
     restoreSelection()
     document.execCommand(cmd, false, arg ?? "")
     if (ref.current) {
       onChange(ref.current.innerHTML)
     }
   }
 
   function handleInput() {
     if (ref.current) {
       onChange(ref.current.innerHTML)
     }
   }
 
   function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
     e.preventDefault()
     const text = e.clipboardData.getData("text/plain")
     document.execCommand("insertText", false, text)
   }
 
   function sanitizeLinks() {
     if (!ref.current) return
     const links = Array.from(ref.current.querySelectorAll("a"))
     links.forEach((a) => {
       a.setAttribute("target", "_blank")
       a.setAttribute("rel", "noopener noreferrer")
     })
   }
 
   function handleCreateLink(e: React.MouseEvent) {
     e.preventDefault()
     const input = prompt("URL")
     const url = (() => {
       if (!input) return ""
       const u = input.trim()
       if (/^(https?:|mailto:|\/|#)/i.test(u)) return u
       return `https://${u}`
     })()
     if (!url) return
     focusEditor()
     restoreSelection()
     const sel = window.getSelection()
     const hasSelection = sel && sel.rangeCount > 0 && !sel!.getRangeAt(0).collapsed
     if (hasSelection) {
       document.execCommand("createLink", false, url)
     } else {
       document.execCommand("insertHTML", false, `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
     }
     sanitizeLinks()
     if (ref.current) onChange(ref.current.innerHTML)
   }
 
   useEffect(() => {
     if (observerAttached.current) return
     const handler = () => {
       const sel = window.getSelection()
       if (!sel || sel.rangeCount === 0) return
       const node = sel.anchorNode
       if (inEditor(node)) {
         savedRangeRef.current = sel.getRangeAt(0)
       }
     }
     document.addEventListener("selectionchange", handler)
     observerAttached.current = true
     return () => {
       document.removeEventListener("selectionchange", handler)
       observerAttached.current = false
     }
   }, [])

   const minH = typeof height?.min !== "undefined" ? height?.min : 400
   const maxH = height?.max
 
  return (
    <div className={clsx("w-full h-full flex flex-col", className)}>
       <div className="flex items-center gap-1.5 mb-3">
         <Button type="button" variant="ghost" size="sm" onMouseDown={(e) => { e.preventDefault(); exec("bold") }} aria-label="Negrito">
           <Bold className="h-4 w-4" />
         </Button>
         <Button type="button" variant="ghost" size="sm" onMouseDown={(e) => { e.preventDefault(); exec("italic") }} aria-label="Itálico">
           <Italic className="h-4 w-4" />
         </Button>
         <Button type="button" variant="ghost" size="sm" onMouseDown={(e) => { e.preventDefault(); exec("underline") }} aria-label="Sublinhado">
           <Underline className="h-4 w-4" />
         </Button>
         <Button type="button" variant="ghost" size="sm" onMouseDown={(e) => { e.preventDefault(); exec("strikeThrough") }} aria-label="Tachado">
           <Strikethrough className="h-4 w-4" />
         </Button>
         <div className="w-px h-6 bg-border mx-1" />
         <Button type="button" variant="ghost" size="sm" onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList") }} aria-label="Lista">
           <List className="h-4 w-4" />
         </Button>
         <Button type="button" variant="ghost" size="sm" onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList") }} aria-label="Lista numerada">
           <ListOrdered className="h-4 w-4" />
         </Button>
         <div className="w-px h-6 bg-border mx-1" />
         <Button type="button" variant="ghost" size="sm" onMouseDown={handleCreateLink} aria-label="Link">
           <LinkIcon className="h-4 w-4" />
         </Button>
         <Button type="button" variant="ghost" size="sm" onMouseDown={(e) => { e.preventDefault(); exec("unlink"); exec("removeFormat") }} aria-label="Limpar formatação">
           <WrapText className="h-4 w-4" />
         </Button>
       </div>
      <div
         ref={ref}
         role="textbox"
         aria-multiline="true"
         contentEditable
         onKeyUp={saveSelection}
         onMouseUp={saveSelection}
         onInput={handleInput}
         onPaste={handlePaste}
         data-placeholder={placeholder || ""}
         className={clsx(
           "flex-1 min-h-0 rounded-lg border bg-muted/20 px-4 py-3 text-base leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring",
           "overflow-y-auto",
           "prose-headings:mt-4 prose-headings:mb-2 prose-ul:list-disc prose-ol:list-decimal prose-li:ml-4"
         )}
         style={{ minHeight: minH, ...(maxH ? { maxHeight: maxH } : {}) }}
         suppressContentEditableWarning
       />
     </div>
   )
 }
