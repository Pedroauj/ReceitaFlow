import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-semibold text-white",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20 opacity-80 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-white/35 rounded-md w-9 font-medium text-[0.72rem] uppercase tracking-wider",
        row: "flex w-full mt-1",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-xl [&:has([aria-selected].day-outside)]:bg-violet-500/10 [&:has([aria-selected])]:bg-violet-500/10 first:[&:has([aria-selected])]:rounded-l-xl last:[&:has([aria-selected])]:rounded-r-xl focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal text-white/75 hover:bg-white/10 hover:text-white rounded-xl aria-selected:opacity-100 transition-all duration-150",
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-violet-600 text-white hover:bg-violet-500 hover:text-white focus:bg-violet-600 focus:text-white rounded-xl shadow-[0_4px_14px_rgba(139,92,246,0.4)]",
        day_today: "bg-white/10 text-white font-semibold rounded-xl",
        day_outside:
          "day-outside text-white/25 opacity-40 aria-selected:bg-violet-500/10 aria-selected:text-white/40 aria-selected:opacity-25",
        day_disabled: "text-white/20 opacity-40",
        day_range_middle:
          "aria-selected:bg-violet-500/15 aria-selected:text-white",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
