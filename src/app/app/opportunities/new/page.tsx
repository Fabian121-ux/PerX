import { AppSection } from "@/components/app-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { createOpportunityAction } from "@/features/opportunities/actions";

export default function NewOpportunityPage() {
  return (
    <AppSection description="Create a job or freelance project that can move into proposals, deals, milestones, and trust." title="Create opportunity">
      <Card>
        <form action={createOpportunityAction} className="grid gap-4">
          <Field label="Title">
            <Input name="title" required />
          </Field>
          <Field label="Summary">
            <Input name="summary" required />
          </Field>
          <Field label="Description">
            <Textarea name="description" required />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Type">
              <Select name="type" required>
                <option value="FREELANCE_PROJECT">Freelance project</option>
                <option value="JOB">Job</option>
                <option value="SERVICE">Service</option>
                <option value="PROPERTY">Real Estate</option>
                <option value="PARTNERSHIP">Partnership</option>
                <option value="STARTUP">Startup</option>
                <option value="COFOUNDER">Cofounder</option>
                <option value="INVESTMENT">Investment</option>
              </Select>
            </Field>
            <Field label="Category">
              <Input name="category" placeholder="Software" required />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Currency">
              <Input defaultValue="NGN" maxLength={3} name="currency" required />
            </Field>
            <Field label="Budget min">
              <Input name="budgetMin" placeholder="250000.00" />
            </Field>
            <Field label="Budget max">
              <Input name="budgetMax" placeholder="1200000.00" />
            </Field>
          </div>
          <Field label="Skills">
            <Input name="skills" placeholder="Next.js, Prisma, Security" />
          </Field>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <input className="size-4 accent-emerald-600" defaultChecked name="remote" type="checkbox" />
            Remote supported
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button name="intent" type="submit" value="publish">
              Publish
            </Button>
            <Button name="intent" type="submit" value="draft" variant="secondary">
              Save draft
            </Button>
          </div>
        </form>
      </Card>
    </AppSection>
  );
}
