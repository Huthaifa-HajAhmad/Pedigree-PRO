import * as React from "react";
import { format, parse, isValid, startOfMonth, endOfYear, startOfYear } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, useDayPicker, MonthCaption } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxDate?: Date;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

function CustomMonthCaption(props: React.ComponentProps<typeof MonthCaption>) {
  const { calendarMonth, displayIndex, children, className, ...divProps } = props;
  const { previousMonth, nextMonth, goToMonth, labels } = useDayPicker();

  return (
    <div
      {...divProps}
      className={cn(
        "flex items-center justify-between gap-2 px-3 pt-3 pb-2 border-b border-border",
        className
      )}
    >
      <button
        type="button"
        onClick={() => previousMonth && goToMonth(previousMonth)}
        disabled={!previousMonth}
        aria-label={labels.labelPrevious(previousMonth)}
        className="h-7 w-7 shrink-0 flex items-center justify-center rounded-sm border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1 text-xs min-w-0">
        {children}
      </div>

      <button
        type="button"
        onClick={() => nextMonth && goToMonth(nextMonth)}
        disabled={!nextMonth}
        aria-label={labels.labelNext(nextMonth)}
        className="h-7 w-7 shrink-0 flex items-center justify-center rounded-sm border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  maxDate,
  id,
  name,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : undefined;
  }, [value]);

  const handleSelect = React.useCallback(
    (date: Date | undefined) => {
      if (date) {
        onChange(format(date, "yyyy-MM-dd"));
        setOpen(false);
      }
    },
    [onChange]
  );

  const displayValue = React.useMemo(() => {
    if (!value) return "";
    const d = parse(value, "yyyy-MM-dd", new Date());
    return isValid(d) ? format(d, "MMM d, yyyy") : "";
  }, [value]);

  const startMonth = React.useMemo(() => startOfYear(new Date(1900, 0, 1)), []);
  const endMonth = React.useMemo(() => maxDate ? startOfMonth(maxDate) : endOfYear(new Date()), [maxDate]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          name={name}
          data-testid={testId}
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 text-sm transition-colors shadow-sm",
            "hover:bg-accent/50 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:border-muted-foreground/45 focus-visible:border-muted-foreground/45",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground/60" />
          {displayValue || (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-0 p-0 shadow-lg overflow-hidden"
        align="start"
        sideOffset={4}
      >
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={maxDate ? { after: maxDate } : undefined}
          showOutsideDays
          defaultMonth={selectedDate ?? maxDate ?? new Date()}
          startMonth={startMonth}
          endMonth={endMonth}
          captionLayout="dropdown"
          pagedNavigation
          hideNavigation
          className=""
          classNames={{
            months: "flex flex-col items-center",
            month: "flex flex-col self-center pb-3",
            month_caption: "",
            caption_label: "sr-only",
            dropdowns: "flex items-center gap-1 text-xs",
            dropdown: "bg-popover border border-border rounded-sm px-1 py-0.5 text-xs min-w-0 max-w-[80px] focus:outline-none focus:ring-1 focus:ring-ring",
            dropdown_root: "relative inline-flex",
            month_grid: "mt-3 border-collapse table-fixed self-center",
            weekdays: "flex mt-1",
            weekday: "text-muted-foreground rounded-md w-9 font-normal text-[10px]",
            week: "flex w-full mt-1",
            day: cn(
              "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
              "h-8 w-9"
            ),
            day_button: cn(
              buttonVariants({ variant: "ghost" }),
              "h-8 w-9 p-0 font-normal aria-selected:opacity-100"
            ),
            selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
            today: "rounded-md border border-primary/30 text-primary",
            outside:
              "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
            hidden: "invisible",
          }}
          components={{
            MonthCaption: CustomMonthCaption,
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
