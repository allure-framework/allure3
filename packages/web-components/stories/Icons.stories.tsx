import { SvgIcon, allureIcons } from "@/components/SvgIcon";
import { Text } from "@/components/Typography";

type IconDisplayProps = {
  name: string;
  id: string;
};

const getAllureIcons = () => Object.entries(allureIcons).map(([name, id]) => ({ name, id }));

const IconDisplay = ({ name, id }: IconDisplayProps) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        color: "var(--on-text-secondary)",
      }}
    >
      <SvgIcon id={id} size="l" />
      <Text tag={"p"} style={{ margin: 0, textAlign: "center" }}>
        {name}
      </Text>
    </div>
  );
};

export default {
  title: "Icons",
  parameters: { layout: "padded" },
};

export const AllIcons = () => {
  const icons = getAllureIcons();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "32px 16px",
        padding: "16px",
      }}
    >
      {icons.map((icon) => (
        <IconDisplay key={icon.name} name={icon.name} id={icon.id} />
      ))}
    </div>
  );
};
