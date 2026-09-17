"use client"

import React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Image as ImageIcon, Paintbrush, Plus } from "@/components/ui/icons"

import {
  FloatingPanelBody,
  FloatingPanelButton,
  FloatingPanelCloseButton,
  FloatingPanelContent,
  FloatingPanelFooter,
  FloatingPanelForm,
  FloatingPanelLabel,
  FloatingPanelRoot,
  FloatingPanelSubmitButton,
  FloatingPanelTextarea,
  FloatingPanelTrigger,
} from "@/components/ui/floating-panel"

function FloatingPanelInput() {
  return (
    <FloatingPanelRoot>
      <FloatingPanelTrigger title="Add Note">
        <Plus className="size-4" />
        <span>Add Note</span>
      </FloatingPanelTrigger>
      <FloatingPanelContent className="w-80">
        <FloatingPanelForm onSubmit={(note) => console.log("Submitted note:", note)}>
          <FloatingPanelBody>
            <FloatingPanelLabel htmlFor="note-input">Note</FloatingPanelLabel>
            <FloatingPanelTextarea id="note-input" placeholder="Write a quick note…" />
          </FloatingPanelBody>
          <FloatingPanelFooter>
            <FloatingPanelCloseButton />
            <FloatingPanelSubmitButton />
          </FloatingPanelFooter>
        </FloatingPanelForm>
      </FloatingPanelContent>
    </FloatingPanelRoot>
  )
}

function ColorPickerFloatingPanel() {
  const colors = ["#7c3aed", "#9333ea", "#c026d3", "#4f46e5", "#a855f7", "#d946ef"]

  return (
    <FloatingPanelRoot>
      <FloatingPanelTrigger title="Choose Color">
        <Paintbrush className="size-4" />
        <span>Choose Color</span>
      </FloatingPanelTrigger>
      <FloatingPanelContent className="w-64">
        <FloatingPanelBody>
          <div className="grid grid-cols-3 gap-3">
            <AnimatePresence>
              {colors.map((color) => (
                <motion.button
                  key={color}
                  data-no-glass
                  type="button"
                  aria-label={`Choose ${color}`}
                  className="aspect-square w-full rounded-full border border-white/15 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  style={{ backgroundColor: color }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                />
              ))}
            </AnimatePresence>
          </div>
        </FloatingPanelBody>
        <FloatingPanelFooter>
          <FloatingPanelCloseButton />
        </FloatingPanelFooter>
      </FloatingPanelContent>
    </FloatingPanelRoot>
  )
}

function QuickActionsFloatingPanel() {
  const actions = [
    { icon: Plus, label: "New File" },
    { icon: ImageIcon, label: "Upload Image" },
    { icon: Paintbrush, label: "Edit Colors" },
  ]

  return (
    <FloatingPanelRoot>
      <FloatingPanelTrigger title="Quick Actions">
        <Plus className="size-4" />
        <span>Quick Actions</span>
      </FloatingPanelTrigger>
      <FloatingPanelContent className="w-60">
        <FloatingPanelBody className="space-y-1 p-2">
          {actions.map(({ icon: Icon, label }, index) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <FloatingPanelButton onClick={() => console.log(label)}>
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <span>{label}</span>
              </FloatingPanelButton>
            </motion.div>
          ))}
        </FloatingPanelBody>
        <FloatingPanelFooter>
          <FloatingPanelCloseButton />
        </FloatingPanelFooter>
      </FloatingPanelContent>
    </FloatingPanelRoot>
  )
}

function ImagePreviewFloatingPanel() {
  const imageUrl =
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80"

  return (
    <FloatingPanelRoot>
      <FloatingPanelTrigger title="Preview Image">
        <ImageIcon className="size-4" />
        <span>Preview Image</span>
      </FloatingPanelTrigger>
      <FloatingPanelContent className="w-80">
        <FloatingPanelBody>
          <motion.div
            role="img"
            aria-label="Mountain landscape preview"
            className="aspect-[3/2] w-full rounded-xl bg-cover bg-center"
            style={{ backgroundImage: `url(${imageUrl})` }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
          />
          <p className="mt-3 text-xs leading-5 text-slate-400">
            A responsive image preview inside the floating panel.
          </p>
        </FloatingPanelBody>
        <FloatingPanelFooter>
          <FloatingPanelCloseButton />
          <FloatingPanelButton className="w-auto px-3" onClick={() => console.log("Download clicked")}>
            Download
          </FloatingPanelButton>
        </FloatingPanelFooter>
      </FloatingPanelContent>
    </FloatingPanelRoot>
  )
}

function FloatingPanelExamples() {
  return (
    <div className="min-h-screen bg-card p-8 text-slate-100">
      <h1 className="mb-6 text-2xl font-semibold">Floating Panel Examples</h1>
      <div className="flex flex-wrap gap-4">
        <FloatingPanelInput />
        <ColorPickerFloatingPanel />
        <QuickActionsFloatingPanel />
        <ImagePreviewFloatingPanel />
      </div>
    </div>
  )
}

export { FloatingPanelExamples }
export default FloatingPanelExamples
