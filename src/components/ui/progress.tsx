import * as React from "react"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  variant?: "default" | "success" | "warning" | "error"
  showValue?: boolean
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, variant = "default", showValue = false, ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
    
    const variantClasses = {
      default: "bg-primary",
      success: "bg-success-500",
      warning: "bg-warning-500",
      error: "bg-error-500",
    }

    return (
      <div
        ref={ref}
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-secondary", className)}
        {...props}
      >
        <div
          className={cn(
            "h-full w-full flex-1 transition-all duration-300 ease-out",
            variantClasses[variant]
          )}
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-foreground">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }