import typeByMime from "@/utils/attachmentType.js";

export default function (type) {
  return typeByMime(type).icon;
}
