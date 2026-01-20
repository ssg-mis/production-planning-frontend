interface StageHeaderProps {
  title: string;
  description: string;
}

export default function StageHeader({ title, description }: StageHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
