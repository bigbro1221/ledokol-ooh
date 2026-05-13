interface Props {
  title?: string;
  children: React.ReactNode;
}

export function PrintSection({ title, children }: Props) {
  return (
    <section className="pdf-section">
      {title && <h2 className="pdf-section-title">{title}</h2>}
      {children}
    </section>
  );
}
