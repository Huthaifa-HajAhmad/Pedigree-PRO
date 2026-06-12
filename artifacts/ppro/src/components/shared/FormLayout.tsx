import type { ReactNode } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

interface FormLayoutProps<T extends FieldValues> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  form: UseFormReturn<T>;
  onSubmit: (data: T) => void;
  isSubmitting?: boolean;
  trigger?: ReactNode;
  children: ReactNode;
}

export function FormLayout<T extends FieldValues>({
  open,
  onOpenChange,
  title,
  submitLabel,
  form,
  onSubmit,
  isSubmitting = false,
  trigger,
  children,
}: FormLayoutProps<T>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="border border-slate-200 dark:border-slate-800 max-w-md bg-background/95 backdrop-blur-lg shadow-2xl rounded-xl sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-wider text-primary">{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {children}
            <Button type="submit" disabled={isSubmitting} size="default" className="w-full">
              {isSubmitting ? "Saving..." : submitLabel}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
