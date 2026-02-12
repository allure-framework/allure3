import { allureIcons } from "@/components/SvgIcon";
import { Text } from "@/components/Typography";

type IconDisplayProps = {
  name: string;
  id: string;
};

const getAllureIcons = () => Object.entries(allureIcons).map(([name, id]) => ({ name, id }));

const IconDisplay = ({ name, id }: IconDisplayProps) => {
  return (
    <div style={{ textAlign: "center", margin: "16px", color: "var(--on-text-secondary)" }}>
      <svg width={24} height={24}>
        <use xlinkHref={`#${id}`} />
      </svg>
      <Text tag={"p"} style={{ marginTop: 8 }}>
        {name}
      </Text>
    </div>
  );
};

export default {
  title: "Icons",
};

export const AllIcons = () => {
  const icons = getAllureIcons();

  return (
    <div
      style={{
        display: "grid",
        flexWrap: "wrap",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "16px",
        justifyContent: "center",
      }}
    >
      {icons.map((icon) => (
        <IconDisplay key={icon.name} name={icon.name} id={icon.id} />
      ))}
    </div>
  );
};
