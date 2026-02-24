"use client"

import { toast as sonnerToast } from "sonner"

type ToastProps = {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

const toast = (props: ToastProps) => {
  const { title = '', description = '', variant = 'default' } = props
  
  if (variant === "destructive") {
    sonnerToast.error(title, {
      description: description,
    })
  } else {
    sonnerToast.success(title, {
      description: description,
    })
  }
}

export function useToast() {
  return { toast }
}

export { toast }

