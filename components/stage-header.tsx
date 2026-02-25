interface StageHeaderProps {
  title: string;
  description: string;
}

export default function StageHeader({ title, description }: StageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-start gap-3">
        <div className="w-1 h-10 rounded-full bg-primary shrink-0 mt-0.5" />
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight leading-none">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1.5 leading-none">{description}</p>
        </div>
      </div>
      <div className="mt-4 border-b border-border" />
    </div>
  );
}
