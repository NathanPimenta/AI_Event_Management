"use client"

import { toast as sonnerToast } from "sonner"

type ToastProps = {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

export function useToast() {
  const toast = (props: ToastProps) => {
    if (props.variant === "destructive") {
      sonnerToast.error(props.title, {
        description: props.description,
      })
    } else {
      sonnerToast.success(props.title, {
        description: props.description,
      })
    }
  }

  return { toast }
}

export { sonnerToast as toast }

