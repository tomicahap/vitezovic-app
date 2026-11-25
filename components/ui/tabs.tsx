'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from '@/lib/utils'

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'bg-[#ECE9E3] border border-[#1E3A5F]/15 text-[#1E3A5F] inline-flex min-h-[46px] h-auto w-fit items-center justify-center rounded-2xl p-1.5 gap-1.5 shadow-2xs',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#1E3A5F]/18 bg-white/95 px-3 py-2 text-xs sm:text-sm font-semibold text-[#1E3A5F] shadow-2xs whitespace-nowrap transition-all touch-manipulation select-none hover:bg-[#EFF5FB] hover:border-[#1F77C5]/60 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CEA369] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-b data-[state=active]:from-[#264E82] data-[state=active]:to-[#1E3A5F] data-[state=active]:text-white data-[state=active]:border-2 data-[state=active]:border-[#CEA369] data-[state=active]:font-bold data-[state=active]:shadow-md data-[state=active]:[&_svg]:text-[#F3D19C] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
