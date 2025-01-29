import highlight from "highlight.js/lib/core.js";
import bash from "highlight.js/lib/languages/bash.js";
import diff from "highlight.js/lib/languages/diff.js";
import json from "highlight.js/lib/languages/json.js";
import md from "highlight.js/lib/languages/markdown.js";
import xml from "highlight.js/lib/languages/xml.js";

highlight.registerLanguage("xml", xml);
highlight.registerLanguage("bash", bash);
highlight.registerLanguage("markdown", md);
highlight.registerLanguage("diff", diff);
highlight.registerLanguage("json", json);

export default highlight;
