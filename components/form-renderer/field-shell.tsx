import { Label } from "@/components/ui/label";
import { FormField } from "@/lib/forms/types";

type FieldShellProps = {
    field: FormField;
    error?: string;
    children: React.ReactNode;
};

export function FieldShell({ field, error, children }: FieldShellProps) {
    return (
        <div className="space-y-2">
            <Label htmlFor={field.name}>
                {field.label}
                {field.required && <span aria-hidden> *</span>}
            </Label>
            {field.description && (
                <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
            {children}
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}