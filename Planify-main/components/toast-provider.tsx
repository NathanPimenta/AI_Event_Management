"use client"

import { Toaster } from "sonner"

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      richColors
      theme="light"
      closeButton
      expand={true}
    />
  )
}
