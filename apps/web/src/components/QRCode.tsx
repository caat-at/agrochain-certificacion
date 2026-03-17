import QRCode from "qrcode";

interface Props {
  value: string;
  size?: number;
}

export default async function QRCodeImg({ value, size = 200 }: Props) {
  const svg = await QRCode.toString(value, {
    type:          "svg",
    width:         size,
    margin:        2,
    color: {
      dark:  "#1a7f4b",
      light: "#ffffff",
    },
  });

  return (
    <div
      className="inline-block rounded-xl overflow-hidden border border-gray-100 p-2 bg-white"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
