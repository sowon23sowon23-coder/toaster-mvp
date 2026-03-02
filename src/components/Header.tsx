import { useNavigate } from "react-router-dom";

type HeaderProps = {
  title: string;
  subtitle?: string;
  backTo?: string;
};

export default function Header({ title, subtitle, backTo }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="header">
      {backTo && (
        <button className="text-btn" onClick={() => navigate(backTo)} type="button">
          Back
        </button>
      )}
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}
