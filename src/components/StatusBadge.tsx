import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  connected: boolean;
  className?: string;
}

const StatusBadge = ({ connected, className }: StatusBadgeProps) => {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
        connected
          ? "bg-success/10 text-success border border-success/20"
          : "bg-destructive/10 text-destructive border border-destructive/20",
        className
      )}
    >
      {connected ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <XCircle className="w-4 h-4" />
      )}
      {connected ? "Connected" : "Disconnected"}
    </div>
  );
};

export default StatusBadge;
