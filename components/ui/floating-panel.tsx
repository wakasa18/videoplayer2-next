"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { ModalPortal } from "./modal-portal"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { ArrowLeftIcon } from "@/components/ui/icons"

import { cn } from "@/lib/utils"

const TRANSITION = {
  type: "tween" as const,
  ease: "easeOut" as const,
  duration: 0.18,
}

interface FloatingPanelContextType {
  isOpen: boolean
  openFloatingPanel: (rect: DOMRect, trigger: HTMLButtonElement) => void
  closeFloatingPanel: () => void
  uniqueId: string
  note: string
  setNote: (note: string) => void
  triggerRect: DOMRect | null
  triggerElement: HTMLButtonElement | null
  title: string
  setTitle: (title: string) => void
}

const FloatingPanelContext = createContext<FloatingPanelContextType | undefined>(
  undefined
)

function useFloatingPanel() {
  const context = useContext(FloatingPanelContext)
  if (!context) {
    throw new Error(
      "useFloatingPanel must be used within a FloatingPanelProvider"
    )
  }
  return context
}

function useFloatingPanelLogic() {
  const uniqueId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [note, setNote] = useState("")
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null)
  const [triggerElement, setTriggerElement] =
    useState<HTMLButtonElement | null>(null)
  const [title, setTitle] = useState("")

  const openFloatingPanel = useCallback(
    (rect: DOMRect, trigger: HTMLButtonElement) => {
      setTriggerRect(rect)
      setTriggerElement(trigger)
      setIsOpen(true)
    },
    []
  )

  const closeFloatingPanel = useCallback(() => {
    setIsOpen(false)
    setNote("")
  }, [])

  return useMemo(
    () => ({
      isOpen,
      openFloatingPanel,
      closeFloatingPanel,
      uniqueId,
      note,
      setNote,
      triggerRect,
      triggerElement,
      title,
      setTitle,
    }),
    [
      closeFloatingPanel,
      isOpen,
      note,
      openFloatingPanel,
      title,
      triggerElement,
      triggerRect,
      uniqueId,
    ]
  )
}

interface FloatingPanelRootProps {
  children: React.ReactNode
  className?: string
}

export function FloatingPanelRoot({
  children,
  className,
}: FloatingPanelRootProps) {
  const floatingPanelLogic = useFloatingPanelLogic()

  return (
    <FloatingPanelContext.Provider value={floatingPanelLogic}>
      <MotionConfig transition={TRANSITION}>
        <div className={cn("relative", className)}>{children}</div>
      </MotionConfig>
    </FloatingPanelContext.Provider>
  )
}

interface FloatingPanelTriggerProps
  extends Omit<React.ComponentProps<typeof motion.button>, "title" | "onClick"> {
  children: React.ReactNode
  className?: string
  title: string
}

export function FloatingPanelTrigger({
  children,
  className,
  title,
  ...props
}: FloatingPanelTriggerProps) {
  const { isOpen, openFloatingPanel, uniqueId, setTitle } = useFloatingPanel()
  const triggerRef = useRef<HTMLButtonElement>(null)

  const handleClick = () => {
    if (!triggerRef.current) return
    openFloatingPanel(triggerRef.current.getBoundingClientRect(), triggerRef.current)
    setTitle(title)
  }

  return (
    <motion.button
      ref={triggerRef}

      data-no-glass
      data-liquid-glass
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-primary/15 bg-card/80 px-3 text-sm font-semibold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_10px_30px_rgba(7,1,13,.28)] backdrop-blur-xl transition-colors hover:border-primary/30 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className
      )}
      onClick={handleClick}

      whileTap={{ scale: 0.97 }}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-controls={`floating-panel-${uniqueId}`}
      {...props}
    >
      <motion.div

        className="flex items-center gap-2"
      >
        <motion.span

          className="inline-flex items-center gap-2"
        >
          {children}
        </motion.span>
      </motion.div>
    </motion.button>
  )
}

interface FloatingPanelContentProps {
  children: React.ReactNode
  className?: string
}

export function FloatingPanelContent({
  children,
  className,
}: FloatingPanelContentProps) {
  const {
    isOpen,
    closeFloatingPanel,
    uniqueId,
    triggerRect,
    triggerElement,
    title,
  } = useFloatingPanel()
  const contentRef = useRef<HTMLDivElement>(null)
  const updatePosition = useCallback(() => {
    const panel = contentRef.current
    if (!panel || typeof window === "undefined") return

    const rect = triggerElement?.getBoundingClientRect() ?? triggerRect
    if (!rect) return

    const margin = 12
    const gap = 10
    const panelRect = panel.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight

    let left = rect.left
    let top = rect.bottom + gap

    if (left + panelRect.width > viewportWidth - margin) {
      left = viewportWidth - panelRect.width - margin
    }
    left = Math.max(margin, left)

    if (top + panelRect.height > viewportHeight - margin) {
      top = rect.top - panelRect.height - gap
    }
    if (top < margin) {
      top = Math.max(margin, (viewportHeight - panelRect.height) / 2)
    }

    panel.style.left = `${left}px`
    panel.style.top = `${top}px`
    panel.style.visibility = "visible"
  }, [triggerElement, triggerRect])

  useEffect(() => {
    if (!isOpen) return
    const frame = window.requestAnimationFrame(updatePosition)
    return () => window.cancelAnimationFrame(frame)
  }, [isOpen, updatePosition, children])

  useEffect(() => {
    if (!isOpen) return
    const handleViewportChange = () => updatePosition()
    window.addEventListener("resize", handleViewportChange)
    window.visualViewport?.addEventListener("resize", handleViewportChange)
    window.addEventListener("scroll", handleViewportChange, true)
    return () => {
      window.removeEventListener("resize", handleViewportChange)
      window.visualViewport?.removeEventListener("resize", handleViewportChange)
      window.removeEventListener("scroll", handleViewportChange, true)
    }
  }, [isOpen, updatePosition])

  if (typeof document === "undefined") return null

  const panel = (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.button
            type="button"
            data-no-glass
            aria-label="Close floating panel"
            className="fixed inset-0 z-[145] cursor-default bg-black/5 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeFloatingPanel}
          />
          <motion.div
            ref={contentRef}
            data-floating-modal-surface
            id={`floating-panel-${uniqueId}`}

            className={cn(
              "liquid-glass-popover fixed z-[150] max-h-[min(34rem,calc(100dvh-1.5rem))] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-[20px] border text-slate-100 outline-none",
              className
            )}
            style={{
              left: triggerRect?.left ?? 12,
              top: triggerRect ? triggerRect.bottom + 10 : 12,
              transformOrigin: "top left",
              visibility: "hidden",
            }}
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`floating-panel-title-${uniqueId}`}
          >
            <FloatingPanelTitle>{title}</FloatingPanelTitle>
            {children}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )

  return <ModalPortal>{panel}</ModalPortal>
}

interface FloatingPanelTitleProps {
  children: React.ReactNode
}

function FloatingPanelTitle({ children }: FloatingPanelTitleProps) {
  const { uniqueId } = useFloatingPanel()

  return (
    <motion.div

      className="relative border-b border-white/[0.07] bg-white/[0.025] px-4 py-3"
    >
      <motion.div

        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80"
        id={`floating-panel-title-${uniqueId}`}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

interface FloatingPanelFormProps {
  children: React.ReactNode
  onSubmit?: (note: string) => void
  className?: string
}

export function FloatingPanelForm({
  children,
  onSubmit,
  className,
}: FloatingPanelFormProps) {
  const { note, closeFloatingPanel } = useFloatingPanel()

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSubmit?.(note)
    closeFloatingPanel()
  }

  return (
    <form
      className={cn("flex h-full flex-col", className)}
      onSubmit={handleSubmit}
    >
      {children}
    </form>
  )
}

interface FloatingPanelLabelProps {
  children: React.ReactNode
  htmlFor: string
  className?: string
}

export function FloatingPanelLabel({
  children,
  htmlFor,
  className,
}: FloatingPanelLabelProps) {
  const { note } = useFloatingPanel()

  return (
    <motion.label
      htmlFor={htmlFor}
      style={{ opacity: note ? 0.65 : 1 }}
      className={cn(
        "mb-2 block text-xs font-medium text-slate-300",
        className
      )}
    >
      {children}
    </motion.label>
  )
}

interface FloatingPanelTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  className?: string
  id?: string
}

export function FloatingPanelTextarea({
  className,
  id,
  ...props
}: FloatingPanelTextareaProps) {
  const { note, setNote } = useFloatingPanel()

  return (
    <textarea
      id={id}
      data-floating-panel-autofocus
      className={cn(
        "min-h-28 w-full resize-none rounded-xl border border-primary/10 bg-black/20 px-3.5 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-primary/30 focus:ring-2 focus:ring-primary/10",
        className
      )}
      value={note}
      onChange={(event) => setNote(event.target.value)}
      {...props}
    />
  )
}

interface FloatingPanelHeaderProps {
  children: React.ReactNode
  className?: string
}

export function FloatingPanelHeader({
  children,
  className,
}: FloatingPanelHeaderProps) {
  return (
    <motion.div
      className={cn(
        "px-4 pt-4 text-sm font-semibold text-slate-100",
        className
      )}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      {children}
    </motion.div>
  )
}

interface FloatingPanelBodyProps {
  children: React.ReactNode
  className?: string
}

export function FloatingPanelBody({
  children,
  className,
}: FloatingPanelBodyProps) {
  return (
    <motion.div
      className={cn("p-4", className)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
    >
      {children}
    </motion.div>
  )
}

interface FloatingPanelFooterProps {
  children: React.ReactNode
  className?: string
}

export function FloatingPanelFooter({
  children,
  className,
}: FloatingPanelFooterProps) {
  return (
    <motion.div
      className={cn(
        "flex items-center justify-between border-t border-white/[0.07] bg-white/[0.018] px-4 py-3",
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
    >
      {children}
    </motion.div>
  )
}

interface FloatingPanelCloseButtonProps {
  className?: string
  label?: string
}

export function FloatingPanelCloseButton({
  className,
  label = "Back",
}: FloatingPanelCloseButtonProps) {
  const { closeFloatingPanel } = useFloatingPanel()

  return (
    <motion.button
      type="button"
      data-no-glass
      data-liquid-glass
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        className
      )}
      onClick={closeFloatingPanel}
      aria-label="Close floating panel"

      whileTap={{ scale: 0.96 }}
    >
      <ArrowLeftIcon size={15} />
      <span>{label}</span>
    </motion.button>
  )
}

interface FloatingPanelSubmitButtonProps {
  className?: string
  children?: React.ReactNode
}

export function FloatingPanelSubmitButton({
  className,
  children = "Submit Note",
}: FloatingPanelSubmitButtonProps) {
  return (
    <motion.button
      data-no-glass
      data-liquid-glass
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:border-primary/35 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        className
      )}
      type="submit"

      whileTap={{ scale: 0.97 }}
    >
      {children}
    </motion.button>
  )
}

interface FloatingPanelButtonProps
  extends Omit<React.ComponentProps<typeof motion.button>, "children" | "onClick"> {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

export function FloatingPanelButton({
  children,
  onClick,
  className,
  ...props
}: FloatingPanelButtonProps) {
  return (
    <motion.button
      type="button"
      data-no-glass
      data-liquid-glass
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm text-slate-300 transition-colors hover:border-primary/10 hover:bg-primary/[0.07] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
        className
      )}
      onClick={onClick}

      whileTap={{ scale: 0.985 }}
      {...props}
    >
      {children}
    </motion.button>
  )
}

export {
  FloatingPanelRoot as Root,
  FloatingPanelTrigger as Trigger,
  FloatingPanelContent as Content,
  FloatingPanelForm as Form,
  FloatingPanelLabel as Label,
  FloatingPanelTextarea as Textarea,
  FloatingPanelHeader as Header,
  FloatingPanelBody as Body,
  FloatingPanelFooter as Footer,
  FloatingPanelCloseButton as CloseButton,
  FloatingPanelSubmitButton as SubmitButton,
  FloatingPanelButton as Button,
}
