import { AppSection } from "@/components/app-section";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { createSupportTicketAction } from "@/features/support/actions";
import { supportCategoryOptions } from "@/lib/options";

export default function NewSupportTicketPage() {
  return (
    <AppSection
      title="Create Support Ticket"
      description="Submit a new request for help with your account, deals, or other issues."
    >
      <Card className="max-w-2xl">
        <form action={createSupportTicketAction} className="grid gap-5">
          <Field label="Subject">
            <Input name="subject" placeholder="Briefly describe your issue" required />
          </Field>
          
          <Field label="Category">
            <Select name="category" required>
              <option value="">Select a category</option>
              {supportCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Message" hint="Provide as much detail as possible to help us resolve your issue quickly.">
            <Textarea name="message" placeholder="Describe your issue in detail..." required className="min-h-32" />
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="submit">Submit Ticket</Button>
          </div>
        </form>
      </Card>
    </AppSection>
  );
}
