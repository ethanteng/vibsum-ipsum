import Image from 'next/image';

export default function Logo({ className = "h-8 w-auto" }) {
  return (
    <Image
      src="/vybescript-logo.svg"
      alt="Vybescript"
      width={160}
      height={32}
      className={className}
    />
  );
} 