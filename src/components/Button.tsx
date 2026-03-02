import { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "danger";
    fullWidth?: boolean;
  }
>;

export default function Button({
  children,
  variant = "primary",
  fullWidth = true,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}${fullWidth ? " btn-full" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
