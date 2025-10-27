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
        "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-lg transition-all duration-300 hover:scale-105",
        connected
          ? "bg-gradient-to-r from-success to-success/80 text-white shadow-success/30"
          : "bg-gradient-to-r from-destructive to-destructive/80 text-white shadow-destructive/30",
        className
      )}
    >
      <div className={cn("h-2.5 w-2.5 rounded-full bg-white animate-pulse shadow-glow")} />
      {connected ? "Connected" : "Disconnected"}
    </div>
  );
};

export default StatusBadge;
