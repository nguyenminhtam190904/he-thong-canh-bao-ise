import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function SelectField({ value, onChange, options = [], placeholder, className }) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger
                className={cn(
                    'h-9 w-full rounded-lg border-border/70 bg-white/[0.02] text-[12px] text-foreground/90 focus:ring-1 focus:ring-primary/40',
                    className
                )}
            >
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover">
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-[12px]">
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}