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
        'bg-[#E8E4DE]/90 border border-[#1B2B36]/15 text-[#1B2B36] inline-flex min-h-[46px] h-auto w-fit items-center justify-center rounded-2xl p-1.5 gap-1.5 shadow-2xs',
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
        "inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#1B2B36]/15 bg-white/95 px-3 py-2 text-xs sm:text-sm font-semibold text-[#1B2B36] shadow-2xs whitespace-nowrap transition-all touch-manipulation select-none hover:bg-white hover:border-[#CEA369] hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CEA369] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#1B2B36] data-[state=active]:text-[#F2EFE9] data-[state=active]:border-2 data-[state=active]:border-[#CEA369] data-[state=active]:font-bold data-[state=active]:shadow-md data-[state=active]:[&_svg]:text-[#CEA369] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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
