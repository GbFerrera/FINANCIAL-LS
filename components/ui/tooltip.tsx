 "use client"
 
 import * as React from "react"
 import * as TooltipPrimitive from "@radix-ui/react-tooltip"
 import { cn } from "@/lib/utils"
 
 function TooltipProvider({
   ...props
 }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
   return <TooltipPrimitive.Provider {...props} />
 }
 
 function Tooltip({
   ...props
 }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
   return <TooltipPrimitive.Root {...props} />
 }
 
 function TooltipTrigger({
   ...props
 }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
   return <TooltipPrimitive.Trigger {...props} />
 }
 
 function TooltipContent({
   className,
   sideOffset = 8,
   ...props
 }: React.ComponentProps<typeof TooltipPrimitive.Content>) {
   return (
     <TooltipPrimitive.Content
       sideOffset={sideOffset}
       className={cn(
         "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 rounded-md border px-2.5 py-1.5 text-xs shadow-md outline-none",
         className
       )}
       {...props}
     />
   )
 }
 
 export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }
